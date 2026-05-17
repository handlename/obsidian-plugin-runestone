import {
	GraphNode,
	WorkflowGraph,
	WorkflowNode,
	WorkflowEdge,
	NodeResult,
	NodeStatus,
	ConditionResult,
	isMarkerNode,
	isWorkflowNode,
} from "../types";

export type MarkerLifecycleEvent = "start-begin" | "start-end" | "end-reached" | "end-unreached";

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
	onMarkerStateChange?: (nodeId: string, event: MarkerLifecycleEvent) => void;
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
	const reachedEndIds = new Set<string>();

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

	for (const node of graph.nodes.values()) {
		if (!isWorkflowNode(node)) continue;
		callbacks.onNodeStatusChange(node.id, "pending");
	}

	let aborted = false;
	let halted = false;

	function propagateFromMarkerStart(nodeId: string): Promise<void[]> {
		const edges = outgoingEdges.get(nodeId) ?? [];
		const promises: Promise<void>[] = [];
		for (const edge of edges) {
			completedEdges.add(edge.id);
			callbacks.onEdgeCompleted?.(edge.id);
			const targetId = edge.toNode;
			const targetIncoming = incomingEdges.get(targetId) ?? [];
			// Start carries no output; successors receive whatever non-start
			// edges contribute, or [] when start is the only source.
			const allSatisfied = targetIncoming.every((e) => completedEdges.has(e.id) || dismissedEdges.has(e.id));
			if (allSatisfied) {
				const inputs = nodeInputs.get(targetId) ?? [];
				promises.push(executeNode(targetId, inputs));
			}
		}
		return Promise.all(promises);
	}

	async function executeNode(nodeId: string, input: readonly unknown[]): Promise<void> {
		if (aborted || halted) return;

		const node = graph.nodes.get(nodeId);
		if (!node) return;

		if (isMarkerNode(node)) {
			if (node.type === "start") {
				callbacks.onMarkerStateChange?.(nodeId, "start-begin");
				await propagateFromMarkerStart(nodeId);
				return;
			}
			// end marker
			reachedEndIds.add(nodeId);
			callbacks.onMarkerStateChange?.(nodeId, "end-reached");
			halted = true;
			return;
		}

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
				const edges = outgoingEdges.get(nodeId) ?? [];
				for (const edge of edges) {
					dismissedEdges.add(edge.id);
				}
				for (const edge of edges) {
					const targetId = edge.toNode;
					const targetIncoming = incomingEdges.get(targetId) ?? [];
					const allSatisfied = targetIncoming.every((e) => completedEdges.has(e.id) || dismissedEdges.has(e.id));
					if (allSatisfied) {
						const anyArgsEdgeDismissed = targetIncoming.some((e) => {
							const sourceNode = graph.nodes.get(e.fromNode);
							if (!sourceNode || !isWorkflowNode(sourceNode)) return false;
							if (sourceNode.config.type !== "args") return false;
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
				propagateConditionDismissals(
					edges.filter((e) => e.id !== selectedEdgeId),
					graph, outgoingEdges, incomingEdges, dismissedEdges, completedEdges,
					results, callbacks,
				);
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
				const currentArgs = nodeArgs.get(targetId) ?? {};
				const argsOutput = result.output as Record<string, unknown> ?? {};
				const existingKeys = Object.keys(currentArgs);
				for (const key of Object.keys(argsOutput)) {
					if (existingKeys.includes(key)) {
						console.warn(`[Runestone] Args key "${key}" overwritten for node "${targetId}"`);
					}
				}
				nodeArgs.set(targetId, { ...currentArgs, ...argsOutput });
			} else if (node.config.type === "condition" && Array.isArray(result.output)) {
				const inputs = nodeInputs.get(targetId) ?? [];
				inputs.push(...(result.output as unknown[]));
				nodeInputs.set(targetId, inputs);
			} else {
				const inputs = nodeInputs.get(targetId) ?? [];
				inputs.push(result.output);
				nodeInputs.set(targetId, inputs);
			}

			const isCycleReentry = (executionCounts.get(targetId) ?? 0) > 0;
			const allSatisfied = isCycleReentry || targetIncoming.every((e) => completedEdges.has(e.id) || dismissedEdges.has(e.id));
			if (allSatisfied) {
				if (isCycleReentry) {
					nodeInputs.set(targetId, [result.output]);
					promises.push(executeNode(targetId, [result.output]));
				} else {
					const anyFailed = targetIncoming.some((e) => {
						if (dismissedEdges.has(e.id)) return false;
						const upstreamResult = results.get(e.fromNode);
						return upstreamResult && (upstreamResult.status === "failure" || upstreamResult.status === "skipped");
					});

					const anyArgsEdgeDismissed = targetIncoming.some((e) => {
						const sourceNode = graph.nodes.get(e.fromNode);
						if (!sourceNode || !isWorkflowNode(sourceNode)) return false;
						if (sourceNode.config.type !== "args") return false;
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
	const startMarker = graph.nodes.get(graph.startNodeId);
	const isStartMarker = !!startMarker && isMarkerNode(startMarker) && startMarker.type === "start";
	const usingMarkerAsEntry = isStartMarker && effectiveStartNodeId === graph.startNodeId;

	const argsNodeIds: string[] = [];
	for (const node of graph.nodes.values()) {
		if (!isWorkflowNode(node)) continue;
		if (node.config.type === "args") {
			argsNodeIds.push(node.id);
		}
	}

	const startPromises: Promise<void>[] = [];
	if (usingMarkerAsEntry) {
		callbacks.onMarkerStateChange?.(graph.startNodeId, "start-begin");
		startPromises.push(propagateFromMarkerStart(graph.startNodeId).then(() => undefined));
	} else {
		startPromises.push(executeNode(effectiveStartNodeId, []));
	}
	for (const argsId of argsNodeIds) {
		startPromises.push(executeNode(argsId, []));
	}
	await Promise.all(startPromises);

	if (usingMarkerAsEntry) {
		callbacks.onMarkerStateChange?.(graph.startNodeId, "start-end");
	}

	for (const node of graph.nodes.values()) {
		if (!isMarkerNode(node) || node.type !== "end") continue;
		if (!reachedEndIds.has(node.id)) {
			callbacks.onMarkerStateChange?.(node.id, "end-unreached");
		}
	}

	for (const node of graph.nodes.values()) {
		if (!isWorkflowNode(node)) continue;
		if (!results.has(node.id)) {
			results.set(node.id, { nodeId: node.id, status: "skipped", durationMs: 0 });
		}
	}

	return Array.from(results.values());
}

function skipAllPending(
	graph: WorkflowGraph,
	results: Map<string, NodeResult>,
	callbacks: WorkflowCallbacks,
): void {
	for (const node of graph.nodes.values()) {
		if (!isWorkflowNode(node)) continue;
		if (!results.has(node.id)) {
			const skipResult: NodeResult = { nodeId: node.id, status: "skipped", durationMs: 0 };
			results.set(node.id, skipResult);
			callbacks.onNodeStatusChange(node.id, "skipped", skipResult);
		}
	}
}

function propagateConditionDismissals(
	dismissedConditionEdges: WorkflowEdge[],
	graph: WorkflowGraph,
	outgoingEdges: Map<string, WorkflowEdge[]>,
	incomingEdges: Map<string, WorkflowEdge[]>,
	dismissedEdges: Set<string>,
	completedEdges: Set<string>,
	results: Map<string, NodeResult>,
	callbacks: WorkflowCallbacks,
): void {
	const queue = dismissedConditionEdges.map((e) => e.toNode);
	while (queue.length > 0) {
		const targetId = queue.shift()!;
		if (results.has(targetId)) continue;

		const target = graph.nodes.get(targetId);
		// Markers don't have execution status; skip without touching results
		if (target && !isWorkflowNode(target)) {
			const targetIncoming = incomingEdges.get(targetId) ?? [];
			const allDismissed = targetIncoming.every((e) => dismissedEdges.has(e.id));
			if (!allDismissed) continue;
			const targetOutgoing = outgoingEdges.get(targetId) ?? [];
			for (const e of targetOutgoing) {
				dismissedEdges.add(e.id);
				queue.push(e.toNode);
			}
			continue;
		}

		const targetIncoming = incomingEdges.get(targetId) ?? [];
		const allExecutionEdgesDismissed = targetIncoming.every((e) => {
			const sourceNode = graph.nodes.get(e.fromNode);
			if (sourceNode && isWorkflowNode(sourceNode) && sourceNode.config.type === "args") return true;
			return dismissedEdges.has(e.id);
		});
		if (!allExecutionEdgesDismissed) continue;

		const skipResult: NodeResult = { nodeId: targetId, status: "skipped", durationMs: 0 };
		results.set(targetId, skipResult);
		callbacks.onNodeStatusChange(targetId, "skipped", skipResult);

		const targetOutgoing = outgoingEdges.get(targetId) ?? [];
		for (const e of targetOutgoing) {
			dismissedEdges.add(e.id);
			queue.push(e.toNode);
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
		if (results.has(edge.toNode)) continue;
		const targetNode = graph.nodes.get(edge.toNode);
		if (targetNode && !isWorkflowNode(targetNode)) {
			// Skip marker propagation without modifying results
			skipDownstream(edge.toNode, graph, outgoingEdges, results, callbacks);
			continue;
		}
		const skipResult: NodeResult = { nodeId: edge.toNode, status: "skipped", durationMs: 0 };
		results.set(edge.toNode, skipResult);
		callbacks.onNodeStatusChange(edge.toNode, "skipped", skipResult);
		skipDownstream(edge.toNode, graph, outgoingEdges, results, callbacks);
	}
}

// Re-export GraphNode for callers that need the union type
export type { GraphNode };
