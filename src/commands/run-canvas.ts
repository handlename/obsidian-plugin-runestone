import { App, Notice } from "obsidian";
import * as obsidian from "obsidian";
import { RunestoneSettings } from "../settings";
import { buildParsedGraph } from "../graph/builder";
import { validate } from "../graph/validator";
import { executeWorkflow, MarkerLifecycleEvent } from "../engine/executor";
import { runExecNode, ExecContext } from "../engine/node-runners/exec-runner";
import { runScriptNode } from "../engine/node-runners/script-runner";
import { runConditionNode } from "../engine/node-runners/condition-runner";
import { runArgsNode } from "../engine/node-runners/args-runner";
import { NodeStatus, NodeResult, WorkflowNode, WorkflowEdge, ConditionResult, isWorkflowNode } from "../types";
import { createExecutionState, updateExecutionState } from "../ui/execution-state";
import { CanvasVisualizer } from "../ui/canvas-visualizer";
import { activateLogPanel } from "../ui/log-panel-view";

const MARKER_EVENT_COLOR: Record<MarkerLifecycleEvent, string> = {
	"start-begin": "5",
	"start-end": "4",
	"end-reached": "4",
	"end-unreached": "0",
};

const LOG_PREFIX = "[Runestone]";

let isRunning = false;
let activeVisualizer: CanvasVisualizer | null = null;

export function cleanupVisualizer(): void {
	activeVisualizer?.cleanup();
	activeVisualizer = null;
}

interface ExecuteOptions {
	readonly startNodeIdOverride?: string;
}

async function executeCanvasWorkflow(
	app: App,
	settings: RunestoneSettings,
	canvasPath: string,
	canvasName: string,
	options: ExecuteOptions = {},
): Promise<void> {
	activeVisualizer?.cleanup();
	const visualizer = new CanvasVisualizer();
	activeVisualizer = visualizer;
	const logPanel = await activateLogPanel(app);

	const parsed = await buildParsedGraph(app, canvasPath);

	const validationResult = validate(parsed);
	if (!validationResult.ok) {
		const errorSummary = validationResult.errors.join("\n");
		console.error(`${LOG_PREFIX} Validation failed:\n${errorSummary}`);
		new Notice(`Runestone: Validation failed — ${validationResult.errors[0]}`);
		return;
	}

	const graph = validationResult.graph;

	if (options.startNodeIdOverride && !graph.nodes.has(options.startNodeIdOverride)) {
		new Notice(`Runestone: Node "${options.startNodeIdOverride}" not found in workflow`);
		return;
	}

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
			runNode: async (node: WorkflowNode, input: readonly unknown[], args: Readonly<Record<string, unknown>>) => {
				console.debug(`${LOG_PREFIX} Running node: ${node.filePath} (${node.config.type})`);
				if (node.config.type === "exec") {
					return runExecNode(node, input, execContext, args);
				}
				if (node.config.type === "args") {
					return runArgsNode(node, app, obsidian);
				}
				return runScriptNode(node, input, app, obsidian, args);
			},
			runConditionNode: async (node: WorkflowNode, input: readonly unknown[], outEdges: readonly WorkflowEdge[], args: Readonly<Record<string, unknown>>): Promise<ConditionResult> => {
				console.debug(`${LOG_PREFIX} Evaluating condition: ${node.filePath}`);
				return runConditionNode(node, input, app, outEdges, obsidian, args);
			},
			onEdgeCompleted: (edgeId: string) => {
				visualizer.updateEdge(edgeId);
			},
			onNodeStatusChange: (nodeId: string, status: NodeStatus, result?: NodeResult) => {
				const node = graph.nodes.get(nodeId);
				const label = node && isWorkflowNode(node) ? node.filePath : nodeId;
				console.debug(`${LOG_PREFIX} ${label}: ${status}`);

				updateExecutionState(executionState, nodeId, status, result);
				visualizer.updateNode(nodeId, executionState);
				if (logPanel) {
					logPanel.refresh(executionState);
				}
			},
			onMarkerStateChange: (nodeId: string, event: MarkerLifecycleEvent) => {
				visualizer.updateMarkerNode(nodeId, MARKER_EVENT_COLOR[event]);
			},
		},
		{
			maxCycleIterations: settings.maxCycleIterations,
			startNodeIdOverride: options.startNodeIdOverride,
		},
	);

	for (const result of results) {
		const node = graph.nodes.get(result.nodeId);
		const name = node && isWorkflowNode(node) ? node.filePath : result.nodeId;
		console.debug(`${LOG_PREFIX} ${name}: ${result.status} (${result.durationMs}ms)`);
		if (result.stdout) console.debug(`${LOG_PREFIX} ${name} stdout: ${result.stdout}`);
		if (result.stderr) console.error(`${LOG_PREFIX} ${name} stderr: ${result.stderr}`);
		if (result.error) console.error(`${LOG_PREFIX} ${name} error: ${result.error}`);
	}

	const successCount = results.filter((r) => r.status === "success").length;
	const failedResult = results.find((r) => r.status === "failure");

	if (failedResult) {
		const failedNode = graph.nodes.get(failedResult.nodeId);
		const failedName = failedNode && isWorkflowNode(failedNode) ? failedNode.filePath : failedResult.nodeId;
		new Notice(`Runestone: Failed at ${failedName} — ${failedResult.error}`);
	} else {
		new Notice(`Runestone: Completed (${successCount} nodes executed)`);
	}
}

export async function runWorkflow(
	app: App,
	settings: RunestoneSettings,
	canvasPath: string,
	canvasName: string,
): Promise<void> {
	if (isRunning) {
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- plugin name
		new Notice("Runestone: A workflow is already running");
		return;
	}

	isRunning = true;
	console.debug(`${LOG_PREFIX} Starting workflow: ${canvasName}`);
	new Notice(`Runestone: Running ${canvasName}`);

	try {
		await executeCanvasWorkflow(app, settings, canvasPath, canvasName);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error(`${LOG_PREFIX} Workflow error: ${message}`);
		new Notice(`Runestone: Error — ${message}`);
	} finally {
		isRunning = false;
	}
}

export async function runWorkflowFromNode(
	app: App,
	settings: RunestoneSettings,
	canvasPath: string,
	canvasName: string,
	startNodeId: string,
): Promise<void> {
	if (isRunning) {
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- plugin name
		new Notice("Runestone: A workflow is already running");
		return;
	}

	isRunning = true;
	console.debug(`${LOG_PREFIX} Starting workflow from node ${startNodeId}: ${canvasName}`);
	new Notice(`Runestone: Running ${canvasName} from node`);

	try {
		await executeCanvasWorkflow(app, settings, canvasPath, canvasName, { startNodeIdOverride: startNodeId });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error(`${LOG_PREFIX} Workflow error: ${message}`);
		new Notice(`Runestone: Error — ${message}`);
	} finally {
		isRunning = false;
	}
}

export async function runCurrentCanvas(app: App, settings: RunestoneSettings): Promise<void> {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile || !activeFile.path.endsWith(".canvas")) {
		new Notice("Runestone: no canvas file is currently open");
		return;
	}

	await runWorkflow(app, settings, activeFile.path, activeFile.basename);
}
