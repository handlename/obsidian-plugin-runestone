import { GraphNode, ParsedGraph, WorkflowGraph, isMarkerNode, isWorkflowNode } from "../types";
import { extractCodeBlock } from "./parser";

const TEMPLATE_RE = /\{\{(?:input|args)/;

export type ValidationResult =
	| { readonly ok: true; readonly graph: WorkflowGraph }
	| { readonly ok: false; readonly errors: readonly string[] };

export function validate(graph: ParsedGraph): ValidationResult {
	const errors: string[] = [];

	const incomingCount = new Map<string, number>();
	for (const node of graph.nodes.values()) {
		incomingCount.set(node.id, 0);
	}
	for (const edge of graph.edges) {
		incomingCount.set(edge.toNode, (incomingCount.get(edge.toNode) ?? 0) + 1);
	}

	const outgoingEdges = new Map<string, typeof graph.edges[number][]>();
	for (const edge of graph.edges) {
		const list = outgoingEdges.get(edge.fromNode) ?? [];
		list.push(edge);
		outgoingEdges.set(edge.fromNode, list);
	}

	// Edge endpoint validity
	for (const edge of graph.edges) {
		if (!graph.nodes.has(edge.fromNode)) {
			errors.push(`Edge "${edge.id}" references non-existent source node "${edge.fromNode}"`);
		}
		if (!graph.nodes.has(edge.toNode)) {
			errors.push(`Edge "${edge.id}" references non-existent target node "${edge.toNode}"`);
		}
	}

	// Locate marker nodes
	const startMarkers: GraphNode[] = [];
	const endMarkers: GraphNode[] = [];
	for (const node of graph.nodes.values()) {
		if (!isMarkerNode(node)) continue;
		if (node.type === "start") startMarkers.push(node);
		if (node.type === "end") endMarkers.push(node);
	}

	if (startMarkers.length === 0) {
		errors.push(
			"No start node found. Add a Canvas text node with the content `runestone:start`.",
		);
	} else if (startMarkers.length > 1) {
		const ids = startMarkers.map((n) => n.id).join(", ");
		errors.push(`Multiple start nodes found: ${ids}. Exactly one is required.`);
	}

	for (const startNode of startMarkers) {
		const incoming = incomingCount.get(startNode.id) ?? 0;
		if (incoming > 0) {
			errors.push(`Start node "${startNode.id}" must not have incoming edges`);
		}
		const out = outgoingEdges.get(startNode.id) ?? [];
		if (out.length === 0) {
			errors.push(`Start node "${startNode.id}" must have at least one outgoing edge`);
		}
	}

	for (const endNode of endMarkers) {
		const incoming = incomingCount.get(endNode.id) ?? 0;
		if (incoming === 0) {
			errors.push(`End node "${endNode.id}" must have at least one incoming edge`);
		}
		const out = outgoingEdges.get(endNode.id) ?? [];
		if (out.length > 0) {
			errors.push(`End node "${endNode.id}" must not have outgoing edges`);
		}
	}

	// Template reference validity (immediate successors of start have no input)
	if (startMarkers.length === 1) {
		const startNode = startMarkers[0]!;
		const startOut = outgoingEdges.get(startNode.id) ?? [];
		for (const edge of startOut) {
			const target = graph.nodes.get(edge.toNode);
			if (!target || !isWorkflowNode(target)) continue;
			const targetIncoming = incomingCount.get(target.id) ?? 0;
			// Only flag successors whose ONLY incoming edge is from the start marker
			if (targetIncoming !== 1) continue;
			const textsToCheck = [target.body];
			if (target.config.exec?.workdir) textsToCheck.push(target.config.exec.workdir);
			if (target.config.exec?.env) {
				textsToCheck.push(...Object.values(target.config.exec.env));
			}
			for (const text of textsToCheck) {
				if (TEMPLATE_RE.test(text)) {
					errors.push(
						`Node "${target.id}" (${target.filePath}) is immediately downstream of the start marker and has no input, but uses template syntax`,
					);
					break;
				}
			}
		}
	}

	// Per-node checks (workflow nodes only)
	for (const node of graph.nodes.values()) {
		if (!isWorkflowNode(node)) continue;

		if (node.config.type === "condition") {
			const outEdges = outgoingEdges.get(node.id) ?? [];

			const labeled = outEdges.filter((e) => !!e.label);
			const unlabeled = outEdges.filter((e) => !e.label);

			if (labeled.length < 1) {
				errors.push(
					`Condition node "${node.id}" (${node.filePath}) must have at least one labeled edge`,
				);
			}
			if (unlabeled.length > 1) {
				errors.push(
					`Condition node "${node.id}" (${node.filePath}) must have at most one default (unlabeled) edge`,
				);
			}

			if (!extractCodeBlock(node.body)) {
				errors.push(
					`Condition node "${node.id}" (${node.filePath}) must have a code block in the note body`,
				);
			}
		}

		if (node.config.type === "args") {
			const incoming = incomingCount.get(node.id) ?? 0;
			if (incoming > 0) {
				errors.push(
					`Args node "${node.id}" (${node.filePath}) must not have incoming edges`,
				);
			}

			const outEdges = outgoingEdges.get(node.id) ?? [];
			if (outEdges.length === 0) {
				errors.push(
					`Args node "${node.id}" (${node.filePath}) must have at least one outgoing edge`,
				);
			}

			for (const edge of outEdges) {
				const targetNode = graph.nodes.get(edge.toNode);
				if (targetNode && isWorkflowNode(targetNode) && targetNode.config.type === "args") {
					errors.push(
						`Args node "${node.id}" (${node.filePath}) must not connect to another args node "${edge.toNode}"`,
					);
				}
			}

			if (!extractCodeBlock(node.body)) {
				errors.push(
					`Args node "${node.id}" (${node.filePath}) must have a code block in the note body`,
				);
			}
		}
	}

	// Cycle exit
	const cycles = findCycles(graph);
	for (const cycle of cycles) {
		const hasConditionExit = cycle.some((nodeId) => {
			const node = graph.nodes.get(nodeId);
			if (!node || !isWorkflowNode(node) || node.config.type !== "condition") return false;
			const outEdges = outgoingEdges.get(nodeId) ?? [];
			return outEdges.some((e) => !cycle.includes(e.toNode));
		});
		if (!hasConditionExit) {
			errors.push(`Cycle [${cycle.join(" → ")}] has no exit via a condition node`);
		}
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}

	return {
		ok: true,
		graph: { ...graph, startNodeId: startMarkers[0]!.id },
	};
}

function findCycles(graph: ParsedGraph): string[][] {
	const cycles: string[][] = [];
	const visited = new Set<string>();
	const inStack = new Set<string>();
	const stack: string[] = [];

	const adjacency = new Map<string, string[]>();
	for (const edge of graph.edges) {
		const list = adjacency.get(edge.fromNode) ?? [];
		list.push(edge.toNode);
		adjacency.set(edge.fromNode, list);
	}

	function dfs(nodeId: string): void {
		visited.add(nodeId);
		inStack.add(nodeId);
		stack.push(nodeId);

		for (const neighbor of adjacency.get(nodeId) ?? []) {
			if (!visited.has(neighbor)) {
				dfs(neighbor);
			} else if (inStack.has(neighbor)) {
				const cycleStart = stack.indexOf(neighbor);
				cycles.push(stack.slice(cycleStart));
			}
		}

		stack.pop();
		inStack.delete(nodeId);
	}

	for (const nodeId of graph.nodes.keys()) {
		if (!visited.has(nodeId)) {
			dfs(nodeId);
		}
	}

	return cycles;
}
