// Canvas JSON types (raw .canvas file structure)

export interface CanvasData {
	readonly nodes: readonly CanvasNode[];
	readonly edges: readonly CanvasEdge[];
}

export interface CanvasNode {
	readonly id: string;
	readonly type: string;
	readonly file?: string;
	readonly text?: string;
	readonly url?: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly color?: string;
}

export interface CanvasEdge {
	readonly id: string;
	readonly fromNode: string;
	readonly toNode: string;
	readonly fromSide?: string;
	readonly toSide?: string;
	readonly fromEnd?: "none" | "arrow";
	readonly toEnd?: "none" | "arrow";
	readonly label?: string;
}

// Internal types

export type RunestoneNodeType = "exec" | "script" | "condition" | "args" | "start" | "end";

export type MarkerNodeType = "start" | "end";

export interface RunestoneConfig {
	readonly type: RunestoneNodeType;
	readonly onError: "stop" | "continue";
	readonly exec?: {
		readonly workdir?: string;
		readonly shell?: string;
		readonly env?: Readonly<Record<string, string>>;
	};
}

export interface WorkflowNode {
	readonly id: string;
	readonly filePath: string;
	readonly config: RunestoneConfig;
	readonly body: string;
}

export interface MarkerNode {
	readonly id: string;
	readonly type: MarkerNodeType;
}

export type GraphNode = WorkflowNode | MarkerNode;

export function isMarkerNode(node: GraphNode): node is MarkerNode {
	return (node as MarkerNode).type === "start" || (node as MarkerNode).type === "end";
}

export function isWorkflowNode(node: GraphNode): node is WorkflowNode {
	return !isMarkerNode(node);
}

export interface WorkflowEdge {
	readonly id: string;
	readonly fromNode: string;
	readonly toNode: string;
	readonly label?: string;
}

export interface ParsedGraph {
	readonly nodes: ReadonlyMap<string, GraphNode>;
	readonly edges: readonly WorkflowEdge[];
}

export interface WorkflowGraph extends ParsedGraph {
	readonly startNodeId: string;
}

export type NodeStatus = "pending" | "running" | "success" | "failure" | "skipped";

export interface NodeResult {
	readonly nodeId: string;
	readonly status: NodeStatus;
	readonly output?: unknown;
	readonly error?: string;
	readonly stdout?: string;
	readonly stderr?: string;
	readonly durationMs: number;
}

export interface ConditionResult extends NodeResult {
	readonly selectedEdgeId?: string;
}
