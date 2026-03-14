import { App, Notice } from "obsidian";
import { RunestoneSettings } from "../settings";
import { buildParsedGraph } from "../graph/builder";
import { validate } from "../graph/validator";
import { executeWorkflow } from "../engine/executor";
import { runExecNode, ExecContext } from "../engine/node-runners/exec-runner";
import { runScriptNode } from "../engine/node-runners/script-runner";
import { runConditionNode } from "../engine/node-runners/condition-runner";
import { NodeStatus, WorkflowNode, WorkflowEdge, ConditionResult } from "../types";

const LOG_PREFIX = "[Runestone]";

export async function runCurrentCanvas(app: App, settings: RunestoneSettings): Promise<void> {
	const activeLeaf = app.workspace.activeLeaf;
	const viewType = (activeLeaf?.view as { getViewType?: () => string } | undefined)?.getViewType?.();
	if (viewType !== "canvas") {
		new Notice("Runestone: No canvas is currently open");
		return;
	}

	const activeFile = app.workspace.getActiveFile();
	if (!activeFile || !activeFile.path.endsWith(".canvas")) {
		new Notice("Runestone: No canvas file is currently open");
		return;
	}

	const canvasPath = activeFile.path;
	const canvasName = activeFile.basename;

	console.log(`${LOG_PREFIX} Starting workflow: ${canvasName}`);
	new Notice(`Runestone: Running ${canvasName}`);

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

		const results = await executeWorkflow(
			graph,
			{
				runNode: async (node: WorkflowNode, input: readonly unknown[]) => {
					console.log(`${LOG_PREFIX} Running node: ${node.filePath} (${node.config.type})`);
					if (node.config.type === "exec") {
						return runExecNode(node, input, execContext);
					}
					return runScriptNode(node, input, app);
				},
				runConditionNode: async (node: WorkflowNode, input: readonly unknown[], outEdges: readonly WorkflowEdge[]): Promise<ConditionResult> => {
					console.log(`${LOG_PREFIX} Evaluating condition: ${node.filePath}`);
					return runConditionNode(node, input, app, outEdges);
				},
				onNodeStatusChange: (nodeId: string, status: NodeStatus) => {
					const node = graph.nodes.get(nodeId);
					console.log(`${LOG_PREFIX} ${node?.filePath ?? nodeId}: ${status}`);
				},
			},
			{ maxCycleIterations: settings.maxCycleIterations },
		);

		for (const result of results) {
			const node = graph.nodes.get(result.nodeId);
			const name = node?.filePath ?? result.nodeId;
			console.log(`${LOG_PREFIX} ${name}: ${result.status} (${result.durationMs}ms)`);
			if (result.stdout) console.log(`${LOG_PREFIX} ${name} stdout: ${result.stdout}`);
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
	}
}
