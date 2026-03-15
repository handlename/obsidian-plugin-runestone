import { WorkflowGraph, WorkflowNode, WorkflowEdge, NodeResult, NodeStatus, ConditionResult } from "../types";

export interface WorkflowCallbacks {
	runNode: (node: WorkflowNode, input: readonly unknown[], args: Readonly<Record<string, unknown>>) => Promise<NodeResult>;
	runConditionNode: (
		node: WorkflowNode,
		input: readonly unknown[],
		outgoingEdges: readonly WorkflowEdge[],
		args: Readonly<Record<string, unknown>>,
	) => Promise<ConditionResult>;
	onNodeStatusChange: (nodeId: string, status: NodeStatus, result?: NodeResult) => void;
	onEdgeCompleted?: (edgeId: string) => void;
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
	const nodeArgs = new Map<string, Record<string, unknown>>();
	const completedEdges = new Set<string>();
	const dismissedEdges = new Set<string>();

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
		const args: Readonly<Record<string, unknown>> = nodeArgs.get(nodeId) ?? {};

		if (node.config.type === "condition") {
			const edges = outgoingEdges.get(nodeId) ?? [];
			const condResult = await callbacks.runConditionNode(node, input, edges, args);
			result = condResult;
			selectedEdgeId = condResult.selectedEdgeId;
		} else {
			result = await callbacks.runNode(node, input, args);
		}

		results.set(nodeId, result);
		callbacks.onNodeStatusChange(nodeId, result.status, result);

		if (result.status === "failure") {
			if (node.config.onError === "stop") {
				aborted = true;
				skipAllPending(graph, results, callbacks);
				return;
			}

			if (node.config.type === "args") {
				// Dismiss outgoing edges so join logic skips the target
				const edges = outgoingEdges.get(nodeId) ?? [];
				for (const edge of edges) {
					dismissedEdges.add(edge.id);
				}
				// Check if any target can now proceed (all incoming satisfied)
				for (const edge of edges) {
					const targetId = edge.toNode;
					const targetIncoming = incomingEdges.get(targetId) ?? [];
					const allSatisfied = targetIncoming.every((e) => completedEdges.has(e.id) || dismissedEdges.has(e.id));
					if (allSatisfied) {
						const anyArgsEdgeDismissed = targetIncoming.some((e) => {
							const sourceNode = graph.nodes.get(e.fromNode);
							if (sourceNode?.config.type !== "args") return false;
							return dismissedEdges.has(e.id);
						});
						if (anyArgsEdgeDismissed) {
							const skipResult: NodeResult = {
								nodeId: targetId,
								status: "skipped",
								durationMs: 0,
							};
							results.set(targetId, skipResult);
							callbacks.onNodeStatusChange(targetId, "skipped", skipResult);
							skipDownstream(targetId, graph, outgoingEdges, results, callbacks);
						}
					}
				}
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
				for (const e of edges) {
					if (e.id !== selectedEdgeId) {
						dismissedEdges.add(e.id);
					}
				}
			} else {
				return;
			}
		} else {
			activeEdges = edges;
		}

		const promises: Promise<void>[] = [];
		for (const edge of activeEdges) {
			completedEdges.add(edge.id);
			callbacks.onEdgeCompleted?.(edge.id);
			const targetId = edge.toNode;
			const targetIncoming = incomingEdges.get(targetId) ?? [];

			if (node.config.type === "args") {
				// Merge args output into target's args object
				const currentArgs = nodeArgs.get(targetId) ?? {};
				const argsOutput = result.output as Record<string, unknown> ?? {};
				const existingKeys = Object.keys(currentArgs);
				for (const key of Object.keys(argsOutput)) {
					if (existingKeys.includes(key)) {
						console.warn(`[Runestone] Args key "${key}" overwritten for node "${targetId}"`);
					}
				}
				nodeArgs.set(targetId, { ...currentArgs, ...argsOutput });
			} else {
				const inputs = nodeInputs.get(targetId) ?? [];
				inputs.push(result.output);
				nodeInputs.set(targetId, inputs);
			}

			// If target was previously executed (not just skipped), this is a cycle re-entry
			const isCycleReentry = (executionCounts.get(targetId) ?? 0) > 0;
			const allSatisfied = isCycleReentry || targetIncoming.every((e) => completedEdges.has(e.id) || dismissedEdges.has(e.id));
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

					const anyArgsEdgeDismissed = targetIncoming.some((e) => {
						const sourceNode = graph.nodes.get(e.fromNode);
						if (sourceNode?.config.type !== "args") return false;
						return dismissedEdges.has(e.id);
					});

					if (anyFailed || anyArgsEdgeDismissed) {
						const skipResult: NodeResult = {
							nodeId: targetId,
							status: "skipped",
							durationMs: 0,
						};
						results.set(targetId, skipResult);
						callbacks.onNodeStatusChange(targetId, "skipped", skipResult);
						skipDownstream(targetId, graph, outgoingEdges, results, callbacks);
					} else {
						const inputs = nodeInputs.get(targetId) ?? [];
						promises.push(executeNode(targetId, inputs));
					}
				}
			}
		}

		await Promise.all(promises);
	}

	const effectiveStartNodeId = options.startNodeIdOverride ?? graph.startNodeId;

	const argsNodeIds: string[] = [];
	for (const node of graph.nodes.values()) {
		if (node.config.type === "args") {
			argsNodeIds.push(node.id);
		}
	}

	const startPromises: Promise<void>[] = [executeNode(effectiveStartNodeId, [])];
	for (const argsId of argsNodeIds) {
		startPromises.push(executeNode(argsId, []));
	}
	await Promise.all(startPromises);

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
