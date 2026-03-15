import { ParsedGraph, WorkflowGraph } from "../types";
import { extractCodeBlock } from "./parser";

const TEMPLATE_RE = /\{\{input/;

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

	// Edge endpoint validity
	for (const edge of graph.edges) {
		if (!graph.nodes.has(edge.fromNode)) {
			errors.push(`Edge "${edge.id}" references non-existent source node "${edge.fromNode}"`);
		}
		if (!graph.nodes.has(edge.toNode)) {
			errors.push(`Edge "${edge.id}" references non-existent target node "${edge.toNode}"`);
		}
	}

	// Single start node (exclude args nodes)
	const startNodes: string[] = [];
	for (const [nodeId, count] of incomingCount) {
		const node = graph.nodes.get(nodeId);
		if (count === 0 && node?.config.type !== "args") startNodes.push(nodeId);
	}

	if (startNodes.length === 0) {
		errors.push("No start node found (a node with no incoming edges is required)");
	} else if (startNodes.length > 1) {
		errors.push(`Multiple start nodes found: ${startNodes.join(", ")}. Exactly one is required`);
	}

	// Template reference validity (start nodes must not use templates)
	for (const startId of startNodes) {
		const node = graph.nodes.get(startId);
		if (!node) continue;
		const textsToCheck = [node.body];
		if (node.config.exec?.workdir) textsToCheck.push(node.config.exec.workdir);
		if (node.config.exec?.env) {
			textsToCheck.push(...Object.values(node.config.exec.env));
		}
		for (const text of textsToCheck) {
			if (TEMPLATE_RE.test(text)) {
				errors.push(`Start node "${startId}" (${node.filePath}) uses template syntax but has no input`);
				break;
			}
		}
	}

	// Per-node checks
	const outgoingEdges = new Map<string, typeof graph.edges[number][]>();
	for (const edge of graph.edges) {
		const list = outgoingEdges.get(edge.fromNode) ?? [];
		list.push(edge);
		outgoingEdges.set(edge.fromNode, list);
	}

	for (const node of graph.nodes.values()) {
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
				if (targetNode?.config.type === "args") {
					errors.push(
						`Args node "${node.id}" (${node.filePath}) must not connect to another args node "${edge.toNode}"`,
					);
				}
				if (targetNode?.config.type === "exec") {
					errors.push(
						`Args node "${node.id}" (${node.filePath}) must not connect to exec node "${edge.toNode}"`,
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
			if (node?.config.type !== "condition") return false;
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
		graph: { ...graph, startNodeId: startNodes[0]! },
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
