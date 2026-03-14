import { WorkflowGraph, WorkflowNode, WorkflowEdge, NodeResult, NodeStatus, ConditionResult } from "../types";

export interface WorkflowCallbacks {
	runNode: (node: WorkflowNode, input: readonly unknown[]) => Promise<NodeResult>;
	runConditionNode: (
		node: WorkflowNode,
		input: readonly unknown[],
		outgoingEdges: readonly WorkflowEdge[],
	) => Promise<ConditionResult>;
	onNodeStatusChange: (nodeId: string, status: NodeStatus, result?: NodeResult) => void;
}

export interface ExecutorOptions {
	readonly maxCycleIterations: number;
	readonly startNodeIdOverride?: string;
}

export async function executeWorkflow(
	graph: WorkflowGraph,
	callbacks: WorkflowCallbacks,
	options: ExecutorOptions,
): Promise<readonly NodeResult[]> {
	const results = new Map<string, NodeResult>();
	const executionCounts = new Map<string, number>();
	const nodeInputs = new Map<string, unknown[]>();
	const completedEdges = new Set<string>();

	const outgoingEdges = new Map<string, WorkflowEdge[]>();
	const incomingEdges = new Map<string, WorkflowEdge[]>();
	for (const edge of graph.edges) {
		const out = outgoingEdges.get(edge.fromNode) ?? [];
		out.push(edge);
		outgoingEdges.set(edge.fromNode, out);

		const inc = incomingEdges.get(edge.toNode) ?? [];
		inc.push(edge);
		incomingEdges.set(edge.toNode, inc);
	}

	for (const nodeId of graph.nodes.keys()) {
		callbacks.onNodeStatusChange(nodeId, "pending");
	}

	let aborted = false;

	async function executeNode(nodeId: string, input: readonly unknown[]): Promise<void> {
		if (aborted) return;

		const node = graph.nodes.get(nodeId);
		if (!node) return;

		const count = (executionCounts.get(nodeId) ?? 0) + 1;
		executionCounts.set(nodeId, count);
		if (count > options.maxCycleIterations) {
			const errorResult: NodeResult = {
				nodeId,
				status: "failure",
				error: `Node "${nodeId}" exceeded max cycle iteration count (${options.maxCycleIterations})`,
				durationMs: 0,
			};
			results.set(nodeId, errorResult);
			callbacks.onNodeStatusChange(nodeId, "failure", errorResult);
			aborted = true;
			return;
		}

		callbacks.onNodeStatusChange(nodeId, "running");

		let result: NodeResult;
		let selectedEdgeId: string | undefined;

		if (node.config.type === "condition") {
			const edges = outgoingEdges.get(nodeId) ?? [];
			const condResult = await callbacks.runConditionNode(node, input, edges);
			result = condResult;
			selectedEdgeId = condResult.selectedEdgeId;
		} else {
			result = await callbacks.runNode(node, input);
		}

		results.set(nodeId, result);
		callbacks.onNodeStatusChange(nodeId, result.status, result);

		if (result.status === "failure") {
			if (node.config.onError === "stop") {
				aborted = true;
				skipAllPending(graph, results, callbacks);
				return;
			}
			skipDownstream(nodeId, graph, outgoingEdges, results, callbacks);
			return;
		}

		const edges = outgoingEdges.get(nodeId) ?? [];
		let activeEdges: WorkflowEdge[];

		if (node.config.type === "condition") {
			if (selectedEdgeId) {
				activeEdges = edges.filter((e) => e.id === selectedEdgeId);
			} else {
				return;
			}
		} else {
			activeEdges = edges;
		}

		const promises: Promise<void>[] = [];
		for (const edge of activeEdges) {
			completedEdges.add(edge.id);
			const targetId = edge.toNode;
			const targetIncoming = incomingEdges.get(targetId) ?? [];

			const inputs = nodeInputs.get(targetId) ?? [];
			inputs.push(result.output);
			nodeInputs.set(targetId, inputs);

			// If target was previously executed (not just skipped), this is a cycle re-entry
			const isCycleReentry = (executionCounts.get(targetId) ?? 0) > 0;
			const allSatisfied = isCycleReentry || targetIncoming.every((e) => completedEdges.has(e.id));
			if (allSatisfied) {
				if (isCycleReentry) {
					// Reset inputs for cycle re-entry
					nodeInputs.set(targetId, [result.output]);
					promises.push(executeNode(targetId, [result.output]));
				} else {
					const anyFailed = targetIncoming.some((e) => {
						const upstreamResult = results.get(e.fromNode);
						return upstreamResult && (upstreamResult.status === "failure" || upstreamResult.status === "skipped");
					});

					if (anyFailed) {
						const skipResult: NodeResult = {
							nodeId: targetId,
							status: "skipped",
							durationMs: 0,
						};
						results.set(targetId, skipResult);
						callbacks.onNodeStatusChange(targetId, "skipped", skipResult);
						skipDownstream(targetId, graph, outgoingEdges, results, callbacks);
					} else {
						promises.push(executeNode(targetId, inputs));
					}
				}
			}
		}

		await Promise.all(promises);
	}

	const effectiveStartNodeId = options.startNodeIdOverride ?? graph.startNodeId;
	await executeNode(effectiveStartNodeId, []);

	for (const nodeId of graph.nodes.keys()) {
		if (!results.has(nodeId)) {
			results.set(nodeId, { nodeId, status: "skipped", durationMs: 0 });
		}
	}

	return Array.from(results.values());
}

function skipAllPending(
	graph: WorkflowGraph,
	results: Map<string, NodeResult>,
	callbacks: WorkflowCallbacks,
): void {
	for (const nodeId of graph.nodes.keys()) {
		if (!results.has(nodeId)) {
			const skipResult: NodeResult = { nodeId, status: "skipped", durationMs: 0 };
			results.set(nodeId, skipResult);
			callbacks.onNodeStatusChange(nodeId, "skipped", skipResult);
		}
	}
}

function skipDownstream(
	nodeId: string,
	graph: WorkflowGraph,
	outgoingEdges: Map<string, WorkflowEdge[]>,
	results: Map<string, NodeResult>,
	callbacks: WorkflowCallbacks,
): void {
	const edges = outgoingEdges.get(nodeId) ?? [];
	for (const edge of edges) {
		if (!results.has(edge.toNode)) {
			const skipResult: NodeResult = { nodeId: edge.toNode, status: "skipped", durationMs: 0 };
			results.set(edge.toNode, skipResult);
			callbacks.onNodeStatusChange(edge.toNode, "skipped", skipResult);
			skipDownstream(edge.toNode, graph, outgoingEdges, results, callbacks);
		}
	}
}
