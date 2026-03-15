import { describe, it, expect } from "vitest";
import { validate } from "./validator";
import { ParsedGraph, WorkflowNode, WorkflowEdge } from "../types";

function makeNode(id: string, type: "exec" | "script" | "condition", body = ""): WorkflowNode {
	return {
		id,
		filePath: `${id}.md`,
		config: { type, onError: "stop" },
		body,
	};
}

function makeEdge(id: string, from: string, to: string, label?: string): WorkflowEdge {
	return { id, fromNode: from, toNode: to, ...(label ? { label } : {}) };
}

function makeGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]): ParsedGraph {
	return {
		nodes: new Map(nodes.map((n) => [n.id, n])),
		edges,
	};
}

describe("validate", () => {
	it("succeeds for a simple linear graph", () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b")],
		);
		const result = validate(graph);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.graph.startNodeId).toBe("a");
		}
	});

	it("fails when there are no start nodes", () => {
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

	it("fails when there are multiple start nodes", () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec"), makeNode("c", "exec")],
			[makeEdge("e1", "a", "c")],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
	});

	it("fails when condition node has no labeled edges", () => {
		const graph = makeGraph(
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
		const graph = makeGraph(
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
		const graph = makeGraph(
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
		const graph = makeGraph(
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
		const graph = makeGraph(
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
		const graph = makeGraph(
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

	it("fails when start node uses template syntax", () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b")],
		);
		const aNode = graph.nodes.get("a")!;
		const modified = new Map(graph.nodes);
		modified.set("a", { ...aNode, body: "echo {{input[0].name}}" });
		const result = validate({ ...graph, nodes: modified });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("template") || e.includes("input"))).toBe(true);
		}
	});

	it("fails when start node uses template syntax in exec config", () => {
		const node: WorkflowNode = {
			id: "a",
			filePath: "a.md",
			config: { type: "exec", onError: "stop", exec: { workdir: "{{input[0].dir}}" } },
			body: "echo hi",
		};
		const graph = makeGraph([node, makeNode("b", "exec")], [makeEdge("e1", "a", "b")]);
		const result = validate(graph);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes("template") || e.includes("input"))).toBe(true);
		}
	});

	it("fails when edge references non-existent node", () => {
		const graph = makeGraph(
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
		const graph = makeGraph(
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
		const graph = makeGraph(
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

	it("fails for cycle without condition exit", () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b"), makeEdge("e2", "b", "a")],
		);
		const result = validate(graph);
		expect(result.ok).toBe(false);
	});
});
