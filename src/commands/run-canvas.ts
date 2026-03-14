import { App, Notice } from "obsidian";
import { RunestoneSettings } from "../settings";
import { buildParsedGraph } from "../graph/builder";
import { validate } from "../graph/validator";
import { executeWorkflow } from "../engine/executor";
import { runExecNode, ExecContext } from "../engine/node-runners/exec-runner";
import { runScriptNode } from "../engine/node-runners/script-runner";
import { runConditionNode } from "../engine/node-runners/condition-runner";
import { NodeStatus, NodeResult, WorkflowNode, WorkflowEdge, ConditionResult } from "../types";
import { createExecutionState, updateExecutionState } from "../ui/execution-state";
import { CanvasVisualizer } from "../ui/canvas-visualizer";
import { activateLogPanel } from "../ui/log-panel-view";

const LOG_PREFIX = "[Runestone]";

let isRunning = false;
let activeVisualizer: CanvasVisualizer | null = null;

export function cleanupVisualizer(): void {
	activeVisualizer?.cleanup();
	activeVisualizer = null;
}

export async function runCurrentCanvas(app: App, settings: RunestoneSettings): Promise<void> {
	if (isRunning) {
		new Notice("Runestone: A workflow is already running");
		return;
	}

	const activeFile = app.workspace.getActiveFile();
	if (!activeFile || !activeFile.path.endsWith(".canvas")) {
		new Notice("Runestone: no canvas file is currently open");
		return;
	}

	const canvasPath = activeFile.path;
	const canvasName = activeFile.basename;

	isRunning = true;

	console.debug(`${LOG_PREFIX} Starting workflow: ${canvasName}`);
	new Notice(`Runestone: Running ${canvasName}`);

	activeVisualizer?.cleanup();
	const visualizer = new CanvasVisualizer();
	activeVisualizer = visualizer;
	const logPanel = await activateLogPanel(app);

	try {
		const parsed = await buildParsedGraph(app, canvasPath);

		const validationResult = validate(parsed);
		if (!validationResult.ok) {
			const errorSummary = validationResult.errors.join("\n");
			console.error(`${LOG_PREFIX} Validation failed:\n${errorSummary}`);
			new Notice(`Runestone: Validation failed — ${validationResult.errors[0]}`);
			return;
		}

		const graph = validationResult.graph;
		const vaultPath = (app.vault.adapter as unknown as { basePath?: string }).basePath ?? "";

		const execContext: ExecContext = {
			vaultPath,
			defaultWorkdir: settings.defaultWorkdir || undefined,
			defaultShell: settings.defaultShell || undefined,
		};

		const executionState = createExecutionState(canvasName, graph.nodes);
		visualizer.initialize(app, canvasPath);

		if (logPanel) {
			logPanel.refresh(executionState);
		}

		const results = await executeWorkflow(
			graph,
			{
				runNode: async (node: WorkflowNode, input: readonly unknown[]) => {
					console.debug(`${LOG_PREFIX} Running node: ${node.filePath} (${node.config.type})`);
					if (node.config.type === "exec") {
						return runExecNode(node, input, execContext);
					}
					return runScriptNode(node, input, app);
				},
				runConditionNode: async (node: WorkflowNode, input: readonly unknown[], outEdges: readonly WorkflowEdge[]): Promise<ConditionResult> => {
					console.debug(`${LOG_PREFIX} Evaluating condition: ${node.filePath}`);
					return runConditionNode(node, input, app, outEdges);
				},
				onNodeStatusChange: (nodeId: string, status: NodeStatus, result?: NodeResult) => {
					const node = graph.nodes.get(nodeId);
					console.debug(`${LOG_PREFIX} ${node?.filePath ?? nodeId}: ${status}`);

					updateExecutionState(executionState, nodeId, status, result);
					visualizer.updateNode(nodeId, executionState);
					if (logPanel) {
						logPanel.refresh(executionState);
					}
				},
			},
			{ maxCycleIterations: settings.maxCycleIterations },
		);

		for (const result of results) {
			const node = graph.nodes.get(result.nodeId);
			const name = node?.filePath ?? result.nodeId;
			console.debug(`${LOG_PREFIX} ${name}: ${result.status} (${result.durationMs}ms)`);
			if (result.stdout) console.debug(`${LOG_PREFIX} ${name} stdout: ${result.stdout}`);
			if (result.stderr) console.error(`${LOG_PREFIX} ${name} stderr: ${result.stderr}`);
			if (result.error) console.error(`${LOG_PREFIX} ${name} error: ${result.error}`);
		}

		const successCount = results.filter((r) => r.status === "success").length;
		const failedResult = results.find((r) => r.status === "failure");

		if (failedResult) {
			const failedNode = graph.nodes.get(failedResult.nodeId);
			new Notice(`Runestone: Failed at ${failedNode?.filePath ?? failedResult.nodeId} — ${failedResult.error}`);
		} else {
			new Notice(`Runestone: Completed (${successCount} nodes executed)`);
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error(`${LOG_PREFIX} Workflow error: ${message}`);
		new Notice(`Runestone: Error — ${message}`);
	} finally {
		isRunning = false;
	}
}
