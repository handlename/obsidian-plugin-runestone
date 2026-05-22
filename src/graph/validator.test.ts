import { describe, it, expect } from "vitest";
import { validate } from "./validator";
import { GraphNode, MarkerNode, ParsedGraph, WorkflowNode, WorkflowEdge } from "../types";

function makeNode(id: string, type: "exec" | "script" | "condition", body = ""): WorkflowNode {
	return {
		id,
		filePath: `${id}.md`,
		config: { type, onError: "stop" },
		body,
	};
}

function makeMarker(id: string, type: "start" | "end"): MarkerNode {
	return { id, type };
}

function makeEdge(id: string, from: string, to: string, label?: string): WorkflowEdge {
	return { id, fromNode: from, toNode: to, ...(label ? { label } : {}) };
}

function makeGraph(nodes: GraphNode[], edges: WorkflowEdge[]): ParsedGraph {
	return {
		nodes: new Map(nodes.map((n) => [n.id, n])),
		edges,
	};
}

// Convenience: create a graph with an implicit start marker pointing at firstNodeId.
function makeGraphWithStart(firstNodeId: string, nodes: GraphNode[], edges: WorkflowEdge[]): ParsedGraph {
	return makeGraph(
		[makeMarker("__start__", "start"), ...nodes],
		[makeEdge("__start_edge__", "__start__", firstNodeId), ...edges],
	);
}

describe("validate", () => {
	it("succeeds for a simple linear graph", () => {
		const graph = makeGraphWithStart(
			"a",
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b")],
		);
		const result = validate(graph);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.graph.startNodeId).toBe("__start__");
		}
	});

	it("fails when there is no start marker", () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b"), makeEdge("e2", "b", "a")],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("No start node"))).toBe(true);
		}
	});

	it("fails when there are multiple start markers", () => {
		const graph = makeGraph(
			[
				makeMarker("s1", "start"),
				makeMarker("s2", "start"),
				makeNode("a", "exec"),
			],
			[
				makeEdge("e1", "s1", "a"),
				makeEdge("e2", "s2", "a"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("Multiple start nodes"))).toBe(true);
		}
	});

	it("fails when start marker has incoming edge", () => {
		const graph = makeGraph(
			[
				makeMarker("s", "start"),
				makeNode("a", "exec"),
				makeNode("b", "exec"),
			],
			[
				makeEdge("e1", "s", "a"),
				makeEdge("e2", "a", "s"),
				makeEdge("e3", "a", "b"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("Start node") && e.includes("incoming"))).toBe(true);
		}
	});

	it("fails when start marker has no outgoing edge", () => {
		const graph = makeGraph(
			[makeMarker("s", "start"), makeNode("a", "exec")],
			[],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("Start node") && e.includes("outgoing"))).toBe(true);
		}
	});

	it("succeeds with multiple end markers (zero or more)", () => {
		const graph = makeGraph(
			[
				makeMarker("s", "start"),
				makeNode("a", "exec"),
				makeNode("b", "exec"),
				makeMarker("e1", "end"),
				makeMarker("e2", "end"),
			],
			[
				makeEdge("se1", "s", "a"),
				makeEdge("se2", "a", "b"),
				makeEdge("se3", "a", "e1"),
				makeEdge("se4", "b", "e2"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(true);
	});

	it("succeeds with zero end markers (optional)", () => {
		const graph = makeGraphWithStart(
			"a",
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b")],
		);
		const result = validate(graph);
		expect(result.ok).toBe(true);
	});

	it("fails when end marker has no incoming edges", () => {
		const graph = makeGraph(
			[
				makeMarker("s", "start"),
				makeNode("a", "exec"),
				makeMarker("end1", "end"),
			],
			[
				makeEdge("e1", "s", "a"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("End node") && e.includes("incoming"))).toBe(true);
		}
	});

	it("fails when end marker has outgoing edge", () => {
		const graph = makeGraph(
			[
				makeMarker("s", "start"),
				makeNode("a", "exec"),
				makeMarker("end1", "end"),
				makeNode("b", "exec"),
			],
			[
				makeEdge("e1", "s", "a"),
				makeEdge("e2", "a", "end1"),
				makeEdge("e3", "end1", "b"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("End node") && e.includes("outgoing"))).toBe(true);
		}
	});

	it("fails when condition node has no labeled edges", () => {
		const graph = makeGraphWithStart(
			"a",
			[
				makeNode("a", "exec"),
				{ ...makeNode("b", "condition", "```js\nreturn 'yes';\n```"), config: { type: "condition", onError: "stop" } },
				makeNode("c", "exec"),
			],
			[
				makeEdge("e1", "a", "b"),
				makeEdge("e2", "b", "c"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("at least one labeled edge"))).toBe(true);
		}
	});

	it("fails when condition node has more than one unlabeled edge", () => {
		const graph = makeGraphWithStart(
			"a",
			[
				makeNode("a", "exec"),
				{ ...makeNode("b", "condition", "```js\nreturn 'yes';\n```"), config: { type: "condition", onError: "stop" } },
				makeNode("c", "exec"),
				makeNode("d", "exec"),
				makeNode("e", "exec"),
			],
			[
				makeEdge("e1", "a", "b"),
				makeEdge("e2", "b", "c", "yes"),
				makeEdge("e3", "b", "d"),
				makeEdge("e4", "b", "e"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("at most one default (unlabeled) edge"))).toBe(true);
		}
	});

	it("succeeds for condition node with labeled + one default edge", () => {
		const graph = makeGraphWithStart(
			"a",
			[
				makeNode("a", "exec"),
				{ ...makeNode("b", "condition", "```js\nreturn 'yes';\n```"), config: { type: "condition", onError: "stop" } },
				makeNode("c", "exec"),
				makeNode("d", "exec"),
			],
			[
				makeEdge("e1", "a", "b"),
				makeEdge("e2", "b", "c", "yes"),
				makeEdge("e3", "b", "d"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(true);
	});

	it("succeeds for condition node with only labeled edges and no default", () => {
		const graph = makeGraphWithStart(
			"a",
			[
				makeNode("a", "exec"),
				{ ...makeNode("b", "condition", "```js\nreturn 'yes';\n```"), config: { type: "condition", onError: "stop" } },
				makeNode("c", "exec"),
				makeNode("d", "exec"),
			],
			[
				makeEdge("e1", "a", "b"),
				makeEdge("e2", "b", "c", "yes"),
				makeEdge("e3", "b", "d", "no"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(true);
	});

	it("succeeds for condition node with single labeled edge only", () => {
		const graph = makeGraphWithStart(
			"a",
			[
				makeNode("a", "exec"),
				{ ...makeNode("b", "condition", "```js\nreturn 'yes';\n```"), config: { type: "condition", onError: "stop" } },
				makeNode("c", "exec"),
			],
			[
				makeEdge("e1", "a", "b"),
				makeEdge("e2", "b", "c", "yes"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(true);
	});

	it("fails when condition node has no code block", () => {
		const graph = makeGraphWithStart(
			"a",
			[
				makeNode("a", "exec"),
				{ ...makeNode("b", "condition", "no code block"), config: { type: "condition", onError: "stop" } },
				makeNode("c", "exec"),
				makeNode("d", "exec"),
			],
			[
				makeEdge("e1", "a", "b"),
				makeEdge("e2", "b", "c", "yes"),
				makeEdge("e3", "b", "d", "no"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("code block"))).toBe(true);
		}
	});

	it("fails when start-adjacent node uses input template syntax", () => {
		const graph = makeGraphWithStart(
			"a",
			[
				{ ...makeNode("a", "exec"), body: "echo {{input[0].name}}" },
				makeNode("b", "exec"),
			],
			[makeEdge("e1", "a", "b")],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("template") || e.includes("input"))).toBe(true);
		}
	});



	it("fails when start-adjacent node uses template syntax in exec config", () => {
		const node: WorkflowNode = {
			id: "a",
			filePath: "a.md",
			config: { type: "exec", onError: "stop", exec: { workdir: "{{input[0].dir}}" } },
			body: "echo hi",
		};
		const graph = makeGraphWithStart("a", [node, makeNode("b", "exec")], [makeEdge("e1", "a", "b")]);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("template") || e.includes("input"))).toBe(true);
		}
	});

	it("fails when edge references non-existent node", () => {
		const graph = makeGraphWithStart(
			"a",
			[makeNode("a", "exec")],
			[makeEdge("e1", "a", "nonexistent")],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("nonexistent"))).toBe(true);
		}
	});

	it("succeeds for valid condition node", () => {
		const graph = makeGraphWithStart(
			"a",
			[
				makeNode("a", "exec"),
				{ ...makeNode("b", "condition", "```js\nreturn 'yes';\n```"), config: { type: "condition", onError: "stop" } },
				makeNode("c", "exec"),
				makeNode("d", "exec"),
			],
			[
				makeEdge("e1", "a", "b"),
				makeEdge("e2", "b", "c", "yes"),
				makeEdge("e3", "b", "d", "no"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(true);
	});

	it("succeeds for cycle with condition exit", () => {
		const graph = makeGraphWithStart(
			"start",
			[
				makeNode("start", "exec"),
				makeNode("a", "exec"),
				{ ...makeNode("b", "condition", "```js\nreturn 'loop';\n```"), config: { type: "condition", onError: "stop" } },
				makeNode("c", "exec"),
			],
			[
				makeEdge("e0", "start", "a"),
				makeEdge("e1", "a", "b"),
				makeEdge("e2", "b", "a", "loop"),
				makeEdge("e3", "b", "c", "exit"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(true);
	});

	it("validates correctly when nondirectional edges are pre-filtered by builder", () => {
		const graph = makeGraphWithStart(
			"a",
			[
				makeNode("a", "exec"),
				{ ...makeNode("b", "condition", "```js\nreturn 'yes';\n```"), config: { type: "condition", onError: "stop" } },
				makeNode("c", "exec"),
			],
			[
				makeEdge("e1", "a", "b"),
				makeEdge("e2", "b", "c", "yes"),
			],
		);
		const result = validate(graph);
		expect(result.ok).toBe(true);
	});

	it("fails for cycle without condition exit", () => {
		const graph = makeGraphWithStart(
			"a",
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b"), makeEdge("e2", "b", "a")],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
	});


});
