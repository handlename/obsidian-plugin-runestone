import { describe, it, expect } from "vitest";
import { executeWorkflow, WorkflowCallbacks } from "./executor";
import { WorkflowGraph, WorkflowNode, WorkflowEdge } from "../types";

function makeNode(id: string, type: "exec" | "script" | "condition", body = "", onError: "stop" | "continue" = "stop"): WorkflowNode {
	return { id, filePath: `${id}.md`, config: { type, onError }, body };
}

function makeEdge(id: string, from: string, to: string, label?: string): WorkflowEdge {
	return { id, fromNode: from, toNode: to, ...(label ? { label } : {}) };
}

function makeGraph(nodes: WorkflowNode[], edges: WorkflowEdge[], startNodeId: string): WorkflowGraph {
	return {
		nodes: new Map(nodes.map((n) => [n.id, n])),
		edges,
		startNodeId,
	};
}

function mockCallbacks(overrides?: Partial<WorkflowCallbacks>): WorkflowCallbacks {
	return {
		runNode: async (node, input) => ({
			nodeId: node.id,
			status: "success",
			output: { from: node.id },
			durationMs: 1,
		}),
		runConditionNode: async (node, input, outEdges) => ({
			nodeId: node.id,
			status: "success",
			output: input,
			selectedEdgeId: outEdges[0]?.id,
			durationMs: 1,
		}),
		onNodeStatusChange: () => {},
		...overrides,
	};
}

describe("executeWorkflow", () => {
	it("executes a single node", async () => {
		const graph = makeGraph(
			[makeNode("a", "exec")],
			[],
			"a",
		);
		const results = await executeWorkflow(graph, mockCallbacks(), { maxCycleIterations: 1000 });
		expect(results).toHaveLength(1);
		expect(results[0]!.status).toBe("success");
	});

	it("executes a linear chain", async () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b")],
			"a",
		);
		const order: string[] = [];
		const results = await executeWorkflow(graph, mockCallbacks({
			runNode: async (node, input) => {
				order.push(node.id);
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
		}), { maxCycleIterations: 1000 });

		expect(results).toHaveLength(2);
		expect(order).toEqual(["a", "b"]);
	});

	it("executes parallel branches", async () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec"), makeNode("c", "exec")],
			[makeEdge("e1", "a", "b"), makeEdge("e2", "a", "c")],
			"a",
		);
		const results = await executeWorkflow(graph, mockCallbacks(), { maxCycleIterations: 1000 });
		expect(results).toHaveLength(3);
		expect(results.every((r) => r.status === "success")).toBe(true);
	});

	it("joins multiple inputs", async () => {
		const graph2 = makeGraph(
			[makeNode("start", "exec"), makeNode("a", "exec"), makeNode("b", "exec"), makeNode("c", "exec")],
			[
				makeEdge("e0", "start", "a"),
				makeEdge("e1", "start", "b"),
				makeEdge("e2", "a", "c"),
				makeEdge("e3", "b", "c"),
			],
			"start",
		);
		const inputsReceived: unknown[][] = [];
		const results = await executeWorkflow(graph2, mockCallbacks({
			runNode: async (node, input) => {
				if (node.id === "c") inputsReceived.push([...input]);
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
		}), { maxCycleIterations: 1000 });

		expect(results).toHaveLength(4);
		expect(inputsReceived).toHaveLength(1);
		expect(inputsReceived[0]).toHaveLength(2);
	});

	it("stops workflow on failure with onError: stop", async () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b")],
			"a",
		);
		const results = await executeWorkflow(graph, mockCallbacks({
			runNode: async (node) => ({
				nodeId: node.id,
				status: "failure",
				error: "boom",
				durationMs: 1,
			}),
		}), { maxCycleIterations: 1000 });

		expect(results).toHaveLength(2);
		expect(results.find((r) => r.nodeId === "a")!.status).toBe("failure");
		expect(results.find((r) => r.nodeId === "b")!.status).toBe("skipped");
	});

	it("continues other paths on failure with onError: continue", async () => {
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("a", "exec", "", "continue"),
				makeNode("b", "exec"),
				makeNode("a-child", "exec"),
			],
			[
				makeEdge("e1", "start", "a"),
				makeEdge("e2", "start", "b"),
				makeEdge("e3", "a", "a-child"),
			],
			"start",
		);
		const results = await executeWorkflow(graph, mockCallbacks({
			runNode: async (node, input) => {
				if (node.id === "a") {
					return { nodeId: node.id, status: "failure", error: "boom", durationMs: 1 };
				}
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
		}), { maxCycleIterations: 1000 });

		expect(results.find((r) => r.nodeId === "a")!.status).toBe("failure");
		expect(results.find((r) => r.nodeId === "a-child")!.status).toBe("skipped");
		expect(results.find((r) => r.nodeId === "b")!.status).toBe("success");
	});

	it("skips join node when any input is failed/skipped", async () => {
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("a", "exec", "", "continue"),
				makeNode("b", "exec"),
				makeNode("join", "exec"),
			],
			[
				makeEdge("e1", "start", "a"),
				makeEdge("e2", "start", "b"),
				makeEdge("e3", "a", "join"),
				makeEdge("e4", "b", "join"),
			],
			"start",
		);
		const results = await executeWorkflow(graph, mockCallbacks({
			runNode: async (node) => {
				if (node.id === "a") {
					return { nodeId: node.id, status: "failure", error: "boom", durationMs: 1 };
				}
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
		}), { maxCycleIterations: 1000 });

		expect(results.find((r) => r.nodeId === "join")!.status).toBe("skipped");
	});

	it("routes condition node by selected edge", async () => {
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("cond", "condition", "```js\nreturn 'b';\n```"),
				makeNode("a", "exec"),
				makeNode("b", "exec"),
			],
			[
				makeEdge("e1", "start", "cond"),
				makeEdge("e2", "cond", "a", "a"),
				makeEdge("e3", "cond", "b", "b"),
			],
			"start",
		);
		const executed: string[] = [];
		await executeWorkflow(graph, mockCallbacks({
			runNode: async (node, input) => {
				executed.push(node.id);
				return { nodeId: node.id, status: "success", output: {}, durationMs: 1 };
			},
			runConditionNode: async (node, input, outEdges) => ({
				nodeId: node.id,
				status: "success",
				output: input,
				selectedEdgeId: outEdges.find((e) => e.label === "b")?.id,
				durationMs: 1,
			}),
		}), { maxCycleIterations: 1000 });

		expect(executed).toContain("b");
		expect(executed).not.toContain("a");
	});

	it("passes NodeResult to onNodeStatusChange for terminal states", async () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b")],
			"a",
		);
		const statusChanges: { nodeId: string; status: string; hasResult: boolean }[] = [];
		const results = await executeWorkflow(graph, mockCallbacks({
			onNodeStatusChange: (nodeId, status, result) => {
				statusChanges.push({ nodeId, status, hasResult: result !== undefined });
			},
		}), { maxCycleIterations: 1000 });

		// "pending" and "running" should NOT have result
		const pendingA = statusChanges.find((s) => s.nodeId === "a" && s.status === "pending");
		expect(pendingA?.hasResult).toBe(false);
		const runningA = statusChanges.find((s) => s.nodeId === "a" && s.status === "running");
		expect(runningA?.hasResult).toBe(false);

		// "success" SHOULD have result
		const successA = statusChanges.find((s) => s.nodeId === "a" && s.status === "success");
		expect(successA?.hasResult).toBe(true);
	});

	it("starts execution from overridden start node", async () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec"), makeNode("c", "exec")],
			[makeEdge("e1", "a", "b"), makeEdge("e2", "b", "c")],
			"a",
		);
		const executed: string[] = [];
		const results = await executeWorkflow(graph, mockCallbacks({
			runNode: async (node) => {
				executed.push(node.id);
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
		}), { maxCycleIterations: 1000, startNodeIdOverride: "b" });

		expect(executed).toEqual(["b", "c"]);
		expect(executed).not.toContain("a");
	});

	it("stops on max cycle iterations", async () => {
		const graph = makeGraph(
			[
				makeNode("a", "exec"),
				makeNode("cond", "condition", "```js\nreturn 'loop';\n```"),
			],
			[
				makeEdge("e1", "a", "cond"),
				makeEdge("e2", "cond", "a", "loop"),
				makeEdge("e3", "cond", "a", "exit"),
			],
			"a",
		);
		let callCount = 0;
		const results = await executeWorkflow(graph, mockCallbacks({
			runNode: async (node) => {
				callCount++;
				return { nodeId: node.id, status: "success", output: {}, durationMs: 1 };
			},
			runConditionNode: async (node, input, outEdges) => ({
				nodeId: node.id,
				status: "success",
				output: input,
				selectedEdgeId: outEdges.find((e) => e.label === "loop")?.id,
				durationMs: 1,
			}),
		}), { maxCycleIterations: 5 });

		expect(callCount).toBeLessThanOrEqual(6);
		expect(results.some((r) => r.status === "failure" && r.error?.includes("iteration"))).toBe(true);
	});
});
