import { GraphNode, NodeResult, NodeStatus, isWorkflowNode } from "../types";

export interface NodeExecutionEntry {
	readonly nodeId: string;
	readonly filePath: string;
	status: NodeStatus;
	startTime?: number;
	result?: NodeResult;
}

export interface ExecutionState {
	readonly workflowName: string;
	readonly totalNodes: number;
	readonly entries: Map<string, NodeExecutionEntry>;
	readonly executionOrder: string[];
	completedCount: number;
	getOrderedEntries(): NodeExecutionEntry[];
}

export function createExecutionState(
	workflowName: string,
	nodes: ReadonlyMap<string, GraphNode>,
): ExecutionState {
	const entries = new Map<string, NodeExecutionEntry>();
	for (const node of nodes.values()) {
		if (!isWorkflowNode(node)) continue;
		entries.set(node.id, { nodeId: node.id, filePath: node.filePath, status: "pending" });
	}

	const executionOrder: string[] = [];

	return {
		workflowName,
		totalNodes: entries.size,
		entries,
		executionOrder,
		completedCount: 0,
		getOrderedEntries() {
			const ordered = executionOrder
				.map((id) => entries.get(id))
				.filter((e): e is NodeExecutionEntry => e !== undefined);
			const remaining = Array.from(entries.values())
				.filter((e) => !executionOrder.includes(e.nodeId) && e.status !== "pending");
			return [...ordered, ...remaining];
		},
	};
}

const TERMINAL_STATUSES: readonly NodeStatus[] = ["success", "failure", "skipped"];

export function updateExecutionState(
	state: ExecutionState,
	nodeId: string,
	status: NodeStatus,
	result?: NodeResult,
): void {
	const entry = state.entries.get(nodeId);
	if (!entry) return;

	entry.status = status;

	if (status === "running") {
		entry.startTime = Date.now();
		if (!state.executionOrder.includes(nodeId)) {
			state.executionOrder.push(nodeId);
		}
	}

	if (TERMINAL_STATUSES.includes(status)) {
		if (result) {
			entry.result = result;
		}
		state.completedCount++;
	}
}
