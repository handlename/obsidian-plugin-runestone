import { describe, it, expect } from "vitest";
import { executeWorkflow, MarkerLifecycleEvent, WorkflowCallbacks } from "./executor";
import { GraphNode, MarkerNode, WorkflowGraph, WorkflowNode, WorkflowEdge } from "../types";

function makeNode(id: string, type: "exec" | "script" | "condition" | "args", body = "", onError: "stop" | "continue" = "stop"): WorkflowNode {
	return { id, filePath: `${id}.md`, config: { type, onError }, body };
}

function makeMarker(id: string, type: "start" | "end"): MarkerNode {
	return { id, type };
}

function makeEdge(id: string, from: string, to: string, label?: string): WorkflowEdge {
	return { id, fromNode: from, toNode: to, ...(label ? { label } : {}) };
}

function makeGraph(nodes: GraphNode[], edges: WorkflowEdge[], startNodeId: string): WorkflowGraph {
	return {
		nodes: new Map(nodes.map((n) => [n.id, n])),
		edges,
		startNodeId,
	};
}

function mockCallbacks(overrides?: Partial<WorkflowCallbacks>): WorkflowCallbacks {
	return {
		runNode: async (node, input, args) => ({
			nodeId: node.id,
			status: "success",
			output: { from: node.id },
			durationMs: 1,
		}),
		runConditionNode: async (node, input, outEdges, args) => ({
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

	it("passes condition input through to downstream node without double-nesting", async () => {
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("cond", "condition", "```js\nreturn 'a';\n```"),
				makeNode("a", "script"),
			],
			[
				makeEdge("e1", "start", "cond"),
				makeEdge("e2", "cond", "a", "a"),
			],
			"start",
		);
		let downstreamInput: readonly unknown[] = [];
		await executeWorkflow(graph, mockCallbacks({
			runNode: async (node, input) => {
				if (node.id === "a") {
					downstreamInput = input;
				}
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
			runConditionNode: async (node, input, outEdges) => ({
				nodeId: node.id,
				status: "success",
				output: input,
				selectedEdgeId: outEdges.find((e) => e.label === "a")?.id,
				durationMs: 1,
			}),
		}), { maxCycleIterations: 1000 });

		// input[0] should be the start node's output, not a nested array
		expect(downstreamInput).toHaveLength(1);
		expect(downstreamInput[0]).toEqual({ from: "start" });
	});

	it("executes join node after condition when non-selected branches are skipped", async () => {
		// Workflow: start → cond → (a | b) → join
		// When cond selects "a", node "b" should be skipped,
		// and "join" should still execute (not wait forever for "b")
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("cond", "condition", "```js\nreturn 'a';\n```"),
				makeNode("a", "script"),
				makeNode("b", "script"),
				makeNode("join", "script"),
			],
			[
				makeEdge("e1", "start", "cond"),
				makeEdge("e2", "cond", "a", "a"),
				makeEdge("e3", "cond", "b", "b"),
				makeEdge("e4", "a", "join"),
				makeEdge("e5", "b", "join"),
			],
			"start",
		);
		const executed: string[] = [];
		const skipped: string[] = [];
		await executeWorkflow(graph, mockCallbacks({
			runNode: async (node, input) => {
				executed.push(node.id);
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
			runConditionNode: async (node, input, outEdges) => ({
				nodeId: node.id,
				status: "success",
				output: input,
				selectedEdgeId: outEdges.find((e) => e.label === "a")?.id,
				durationMs: 1,
			}),
			onNodeStatusChange: (nodeId, status) => {
				if (status === "skipped") skipped.push(nodeId);
			},
		}), { maxCycleIterations: 1000 });

		expect(executed).toContain("a");
		expect(executed).toContain("join");
		expect(executed).not.toContain("b");
		expect(skipped).toContain("b");
	});

	it("executes join after condition when non-selected branches have args edges", async () => {
		// Workflow: start → cond → (a | b) → join, with args → a and args → b
		// When cond selects "a", node "b" has a dismissed condition edge
		// AND a completed args edge. "b" should still be skipped.
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("cond", "condition", "```js\nreturn 'a';\n```"),
				makeNode("cfg", "args", "```js\nreturn {x:1};\n```"),
				makeNode("a", "script"),
				makeNode("b", "script"),
				makeNode("join", "script"),
			],
			[
				makeEdge("e1", "start", "cond"),
				makeEdge("e2", "cond", "a", "a"),
				makeEdge("e3", "cond", "b", "b"),
				makeEdge("e4", "a", "join"),
				makeEdge("e5", "b", "join"),
				makeEdge("e6", "cfg", "a"),
				makeEdge("e7", "cfg", "b"),
			],
			"start",
		);
		const executed: string[] = [];
		const skipped: string[] = [];
		await executeWorkflow(graph, mockCallbacks({
			runNode: async (node, input) => {
				executed.push(node.id);
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
			runConditionNode: async (node, input, outEdges) => ({
				nodeId: node.id,
				status: "success",
				output: input,
				selectedEdgeId: outEdges.find((e) => e.label === "a")?.id,
				durationMs: 1,
			}),
			onNodeStatusChange: (nodeId, status) => {
				if (status === "skipped") skipped.push(nodeId);
			},
		}), { maxCycleIterations: 1000 });

		expect(executed).toContain("a");
		expect(executed).toContain("join");
		expect(executed).not.toContain("b");
		expect(skipped).toContain("b");
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

	it("executes target when condition has multiple edges to same node", async () => {
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("cond", "condition", "```js\nreturn 'a';\n```"),
				makeNode("target", "exec"),
			],
			[
				makeEdge("e1", "start", "cond"),
				makeEdge("e2", "cond", "target", "a"),
				makeEdge("e3", "cond", "target", "b"),
			],
			"start",
		);
		const executed: string[] = [];
		const results = await executeWorkflow(graph, mockCallbacks({
			runNode: async (node) => {
				executed.push(node.id);
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
			runConditionNode: async (node, input, outEdges) => ({
				nodeId: node.id,
				status: "success",
				output: input,
				selectedEdgeId: outEdges.find((e) => e.label === "a")?.id,
				durationMs: 1,
			}),
		}), { maxCycleIterations: 1000 });

		expect(executed).toContain("target");
		expect(results.find((r) => r.nodeId === "target")!.status).toBe("success");
	});

	it("dismissed edges do not block join", async () => {
		// start -> cond, start -> B
		// cond -> A (selected), cond -> join (dismissed)
		// B -> join
		// join has incoming [dismissed, completed] → should execute
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("cond", "condition", "```js\nreturn 'a';\n```"),
				makeNode("A", "exec"),
				makeNode("B", "exec"),
				makeNode("join", "exec"),
			],
			[
				makeEdge("e1", "start", "cond"),
				makeEdge("e2", "start", "B"),
				makeEdge("e3", "cond", "A", "a"),
				makeEdge("e4", "cond", "join", "b"),
				makeEdge("e5", "B", "join"),
			],
			"start",
		);
		const executed: string[] = [];
		const results = await executeWorkflow(graph, mockCallbacks({
			runNode: async (node) => {
				executed.push(node.id);
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
			runConditionNode: async (node, input, outEdges) => ({
				nodeId: node.id,
				status: "success",
				output: input,
				selectedEdgeId: outEdges.find((e) => e.label === "a")?.id,
				durationMs: 1,
			}),
		}), { maxCycleIterations: 1000 });

		expect(executed).toContain("join");
		expect(results.find((r) => r.nodeId === "join")!.status).toBe("success");
	});

	it("skips node reachable only via dismissed edge", async () => {
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("cond", "condition", "```js\nreturn 'a';\n```"),
				makeNode("a-target", "exec"),
				makeNode("b-target", "exec"),
			],
			[
				makeEdge("e1", "start", "cond"),
				makeEdge("e2", "cond", "a-target", "a"),
				makeEdge("e3", "cond", "b-target", "b"),
			],
			"start",
		);
		const results = await executeWorkflow(graph, mockCallbacks({
			runConditionNode: async (node, input, outEdges) => ({
				nodeId: node.id,
				status: "success",
				output: input,
				selectedEdgeId: outEdges.find((e) => e.label === "a")?.id,
				durationMs: 1,
			}),
		}), { maxCycleIterations: 1000 });

		expect(results.find((r) => r.nodeId === "a-target")!.status).toBe("success");
		expect(results.find((r) => r.nodeId === "b-target")!.status).toBe("skipped");
	});

	it("default edge fallback with dismissed edges", async () => {
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("cond", "condition", "```js\nreturn 'unknown';\n```"),
				makeNode("a-target", "exec"),
				makeNode("default-target", "exec"),
			],
			[
				makeEdge("e1", "start", "cond"),
				makeEdge("e2", "cond", "a-target", "a"),
				makeEdge("e3", "cond", "default-target"),
			],
			"start",
		);
		const executed: string[] = [];
		const results = await executeWorkflow(graph, mockCallbacks({
			runNode: async (node) => {
				executed.push(node.id);
				return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
			},
			runConditionNode: async (node, input, outEdges) => ({
				nodeId: node.id,
				status: "success",
				output: input,
				// Simulate default edge selection (unlabeled edge)
				selectedEdgeId: outEdges.find((e) => !e.label)?.id,
				durationMs: 1,
			}),
		}), { maxCycleIterations: 1000 });

		expect(executed).toContain("default-target");
		expect(executed).not.toContain("a-target");
		expect(results.find((r) => r.nodeId === "a-target")!.status).toBe("skipped");
	});

	it("calls onEdgeCompleted for each completed edge", async () => {
		const graph = makeGraph(
			[makeNode("a", "exec"), makeNode("b", "exec")],
			[makeEdge("e1", "a", "b")],
			"a",
		);
		const completedEdgeIds: string[] = [];
		await executeWorkflow(graph, mockCallbacks({
			onEdgeCompleted: (edgeId) => {
				completedEdgeIds.push(edgeId);
			},
		}), { maxCycleIterations: 1000 });

		expect(completedEdgeIds).toEqual(["e1"]);
	});

	it("calls onEdgeCompleted only for selected condition edge", async () => {
		const graph = makeGraph(
			[
				makeNode("start", "exec"),
				makeNode("cond", "condition", "```js\nreturn 'a';\n```"),
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
		const completedEdgeIds: string[] = [];
		await executeWorkflow(graph, mockCallbacks({
			runConditionNode: async (node, input, outEdges) => ({
				nodeId: node.id,
				status: "success",
				output: input,
				selectedEdgeId: outEdges.find((e) => e.label === "a")?.id,
				durationMs: 1,
			}),
			onEdgeCompleted: (edgeId) => {
				completedEdgeIds.push(edgeId);
			},
		}), { maxCycleIterations: 1000 });

		expect(completedEdgeIds).toContain("e1");
		expect(completedEdgeIds).toContain("e2");
		expect(completedEdgeIds).not.toContain("e3");
	});

	describe("args node execution", () => {
		it("executes args node in parallel with start node", async () => {
			const graph = makeGraph(
				[
					makeNode("start", "exec"),
					makeNode("myargs", "args", "```js\nreturn { x: 1 };\n```"),
					makeNode("target", "script"),
				],
				[
					makeEdge("e1", "start", "target"),
					makeEdge("e2", "myargs", "target"),
				],
				"start",
			);
			const executed: string[] = [];
			const results = await executeWorkflow(graph, mockCallbacks({
				runNode: async (node, input, args) => {
					executed.push(node.id);
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(executed).toContain("start");
			expect(executed).toContain("myargs");
			expect(executed).toContain("target");
			expect(results.every((r) => r.status === "success")).toBe(true);
		});

		it("passes args as separate parameter, not in input array", async () => {
			const graph = makeGraph(
				[
					makeNode("start", "exec"),
					makeNode("myargs", "args", "```js\nreturn { x: 1 };\n```"),
					makeNode("target", "script"),
				],
				[
					makeEdge("e1", "start", "target"),
					makeEdge("e2", "myargs", "target"),
				],
				"start",
			);
			let capturedInput: readonly unknown[] = [];
			let capturedArgs: Record<string, unknown> = {};
			await executeWorkflow(graph, mockCallbacks({
				runNode: async (node, input, args) => {
					if (node.id === "target") {
						capturedInput = input;
						capturedArgs = args;
					}
					if (node.id === "myargs") return { nodeId: node.id, status: "success", output: { x: 1 }, durationMs: 1 };
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(capturedInput).toHaveLength(1);
			expect(capturedInput[0]).toEqual({ from: "start" });
			expect(capturedArgs).toEqual({ x: 1 });
		});

		it("merges multiple args nodes into single object", async () => {
			const graph = makeGraph(
				[
					makeNode("start", "exec"),
					makeNode("args1", "args"),
					makeNode("args2", "args"),
					makeNode("target", "script"),
				],
				[
					makeEdge("e1", "start", "target"),
					makeEdge("e2", "args1", "target"),
					makeEdge("e3", "args2", "target"),
				],
				"start",
			);
			let capturedArgs: Record<string, unknown> = {};
			await executeWorkflow(graph, mockCallbacks({
				runNode: async (node, input, args) => {
					if (node.id === "args1") return { nodeId: node.id, status: "success", output: { x: 1 }, durationMs: 1 };
					if (node.id === "args2") return { nodeId: node.id, status: "success", output: { y: 2 }, durationMs: 1 };
					if (node.id === "target") capturedArgs = args;
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(capturedArgs).toEqual({ x: 1, y: 2 });
		});

		it("passes empty args when no args node is connected", async () => {
			const graph = makeGraph(
				[makeNode("a", "exec"), makeNode("b", "exec")],
				[makeEdge("e1", "a", "b")],
				"a",
			);
			let capturedArgs: Record<string, unknown> = {};
			await executeWorkflow(graph, mockCallbacks({
				runNode: async (node, input, args) => {
					if (node.id === "b") capturedArgs = args;
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(capturedArgs).toEqual({});
		});

		it("skips target when args node fails with onError: continue", async () => {
			const graph = makeGraph(
				[
					makeNode("start", "exec"),
					makeNode("myargs", "args", "", "continue"),
					makeNode("target", "script"),
				],
				[
					makeEdge("e1", "start", "target"),
					makeEdge("e2", "myargs", "target"),
				],
				"start",
			);
			const results = await executeWorkflow(graph, mockCallbacks({
				runNode: async (node, input, args) => {
					if (node.id === "myargs") {
						return { nodeId: node.id, status: "failure", error: "args failed", durationMs: 1 };
					}
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(results.find((r) => r.nodeId === "myargs")!.status).toBe("failure");
			expect(results.find((r) => r.nodeId === "target")!.status).toBe("skipped");
		});

		it("stops entire workflow when args node fails with onError: stop", async () => {
			const graph = makeGraph(
				[
					makeNode("start", "exec"),
					makeNode("myargs", "args"),
					makeNode("target", "script"),
				],
				[
					makeEdge("e1", "start", "target"),
					makeEdge("e2", "myargs", "target"),
				],
				"start",
			);
			const results = await executeWorkflow(graph, mockCallbacks({
				runNode: async (node, input, args) => {
					if (node.id === "myargs") {
						return { nodeId: node.id, status: "failure", error: "args failed", durationMs: 1 };
					}
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(results.find((r) => r.nodeId === "myargs")!.status).toBe("failure");
			expect(results.find((r) => r.nodeId === "target")!.status).toBe("skipped");
		});

		it("executes args nodes for startNodeIdOverride target", async () => {
			const graph = makeGraph(
				[
					makeNode("a", "exec"),
					makeNode("b", "exec"),
					makeNode("myargs", "args"),
					makeNode("c", "script"),
				],
				[
					makeEdge("e1", "a", "b"),
					makeEdge("e2", "b", "c"),
					makeEdge("e3", "myargs", "c"),
				],
				"a",
			);
			const executed: string[] = [];
			await executeWorkflow(graph, mockCallbacks({
				runNode: async (node, input, args) => {
					executed.push(node.id);
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000, startNodeIdOverride: "b" });

			expect(executed).toContain("myargs");
			expect(executed).toContain("b");
			expect(executed).toContain("c");
			expect(executed).not.toContain("a");
		});

		it("passes args to condition node callback", async () => {
			const graph = makeGraph(
				[
					makeNode("start", "exec"),
					makeNode("myargs", "args"),
					makeNode("cond", "condition", "```js\nreturn 'yes';\n```"),
					makeNode("target", "exec"),
				],
				[
					makeEdge("e1", "start", "cond"),
					makeEdge("e2", "myargs", "cond"),
					makeEdge("e3", "cond", "target", "yes"),
				],
				"start",
			);
			let capturedArgs: Record<string, unknown> = {};
			await executeWorkflow(graph, mockCallbacks({
				runNode: async (node, input, args) => {
					if (node.id === "myargs") return { nodeId: node.id, status: "success", output: { x: 1 }, durationMs: 1 };
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
				runConditionNode: async (node, input, outEdges, args) => {
					capturedArgs = args;
					return {
						nodeId: node.id,
						status: "success",
						output: input,
						selectedEdgeId: outEdges.find((e) => e.label === "yes")?.id,
						durationMs: 1,
					};
				},
			}), { maxCycleIterations: 1000 });

			expect(capturedArgs).toEqual({ x: 1 });
		});
	});

	describe("start/end marker nodes", () => {
		// C1: start marker as entry, orphan ignored
		it("starts execution from start marker and ignores orphans", async () => {
			const graph = makeGraph(
				[
					makeMarker("s", "start"),
					makeNode("a", "exec"),
					makeNode("b", "exec"),
					makeNode("orphan", "exec"),
				],
				[
					makeEdge("e1", "s", "a"),
					makeEdge("e2", "a", "b"),
				],
				"s",
			);
			const executed: string[] = [];
			const results = await executeWorkflow(graph, mockCallbacks({
				runNode: async (node) => {
					executed.push(node.id);
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(executed).toEqual(["a", "b"]);
			expect(executed).not.toContain("orphan");
			expect(results.find((r) => r.nodeId === "orphan")!.status).toBe("skipped");
		});

		// C2: start marker has no payload and is not in onNodeStatusChange stream for workflow nodes
		it("does not call onNodeStatusChange for the start marker", async () => {
			const graph = makeGraph(
				[
					makeMarker("s", "start"),
					makeNode("a", "exec"),
				],
				[makeEdge("e1", "s", "a")],
				"s",
			);
			const statusNodeIds: string[] = [];
			await executeWorkflow(graph, mockCallbacks({
				onNodeStatusChange: (nodeId) => {
					statusNodeIds.push(nodeId);
				},
			}), { maxCycleIterations: 1000 });

			expect(statusNodeIds).not.toContain("s");
		});

		// Successor of start receives [] as input
		it("passes empty input to immediate successors of start", async () => {
			const graph = makeGraph(
				[makeMarker("s", "start"), makeNode("a", "exec")],
				[makeEdge("e1", "s", "a")],
				"s",
			);
			let captured: readonly unknown[] = [];
			await executeWorkflow(graph, mockCallbacks({
				runNode: async (node, input) => {
					if (node.id === "a") captured = input;
					return { nodeId: node.id, status: "success", output: {}, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(captured).toEqual([]);
		});

		// C3, C5: end node halts workflow gracefully
		it("halts workflow on end marker reach and completes successfully", async () => {
			const graph = makeGraph(
				[
					makeMarker("s", "start"),
					makeNode("a", "exec"),
					makeMarker("end", "end"),
					makeNode("downstream", "exec"),
				],
				[
					makeEdge("e1", "s", "a"),
					makeEdge("e2", "a", "end"),
					makeEdge("e3", "end", "downstream"), // invalid in validator, but executor tolerates
				],
				"s",
			);
			const executed: string[] = [];
			const results = await executeWorkflow(graph, mockCallbacks({
				runNode: async (node) => {
					executed.push(node.id);
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(executed).toContain("a");
			expect(executed).not.toContain("downstream");
			expect(results.find((r) => r.nodeId === "a")!.status).toBe("success");
			// No failed results overall
			expect(results.find((r) => r.status === "failure")).toBeUndefined();
		});

		// C3: end halts other parallel branches (new scheduling stops)
		it("stops scheduling new parallel branches after end reach", async () => {
			// start -> a -> end
			// start -> b -> c
			// When end is reached, c should not be scheduled.
			const graph = makeGraph(
				[
					makeMarker("s", "start"),
					makeNode("a", "exec"),
					makeNode("b", "exec"),
					makeNode("c", "exec"),
					makeMarker("end", "end"),
				],
				[
					makeEdge("e1", "s", "a"),
					makeEdge("e2", "s", "b"),
					makeEdge("e3", "a", "end"),
					makeEdge("e4", "b", "c"),
				],
				"s",
			);
			const executed: string[] = [];
			await executeWorkflow(graph, mockCallbacks({
				runNode: async (node) => {
					executed.push(node.id);
					// Make "a" resolve before "b" to ensure end is reached first
					if (node.id === "b") await new Promise((r) => setTimeout(r, 10));
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(executed).toContain("a");
			// b may complete in-flight, but c (scheduled after b completes) is blocked by halt
			expect(executed).not.toContain("c");
		});

		// C6: args nodes execute independently of start marker
		it("executes args nodes alongside start marker", async () => {
			const graph = makeGraph(
				[
					makeMarker("s", "start"),
					makeNode("myargs", "args"),
					makeNode("target", "script"),
				],
				[
					makeEdge("e1", "s", "target"),
					makeEdge("e2", "myargs", "target"),
				],
				"s",
			);
			const executed: string[] = [];
			let capturedArgs: Record<string, unknown> = {};
			await executeWorkflow(graph, mockCallbacks({
				runNode: async (node, input, args) => {
					executed.push(node.id);
					if (node.id === "myargs") {
						return { nodeId: node.id, status: "success", output: { x: 1 }, durationMs: 1 };
					}
					if (node.id === "target") capturedArgs = args;
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(executed).toContain("myargs");
			expect(executed).toContain("target");
			expect(capturedArgs).toEqual({ x: 1 });
		});

		// C7: start marker with multiple outgoing edges => parallel execution
		it("schedules multiple successors of start in parallel", async () => {
			const graph = makeGraph(
				[
					makeMarker("s", "start"),
					makeNode("a", "exec"),
					makeNode("b", "exec"),
				],
				[
					makeEdge("e1", "s", "a"),
					makeEdge("e2", "s", "b"),
				],
				"s",
			);
			const executed: string[] = [];
			await executeWorkflow(graph, mockCallbacks({
				runNode: async (node) => {
					executed.push(node.id);
					return { nodeId: node.id, status: "success", output: { from: node.id }, durationMs: 1 };
				},
			}), { maxCycleIterations: 1000 });

			expect(executed).toContain("a");
			expect(executed).toContain("b");
		});

		// Marker lifecycle events
		it("emits start-begin, start-end, and end-reached marker events", async () => {
			const graph = makeGraph(
				[
					makeMarker("s", "start"),
					makeNode("a", "exec"),
					makeMarker("end", "end"),
				],
				[
					makeEdge("e1", "s", "a"),
					makeEdge("e2", "a", "end"),
				],
				"s",
			);
			const events: { id: string; event: MarkerLifecycleEvent }[] = [];
			await executeWorkflow(graph, mockCallbacks({
				onMarkerStateChange: (id, event) => events.push({ id, event }),
			}), { maxCycleIterations: 1000 });

			expect(events).toContainEqual({ id: "s", event: "start-begin" });
			expect(events).toContainEqual({ id: "s", event: "start-end" });
			expect(events).toContainEqual({ id: "end", event: "end-reached" });
		});

		it("emits end-unreached for end markers not reached", async () => {
			const graph = makeGraph(
				[
					makeMarker("s", "start"),
					makeNode("cond", "condition", "```js\nreturn 'a';\n```"),
					makeMarker("end_a", "end"),
					makeMarker("end_b", "end"),
				],
				[
					makeEdge("e1", "s", "cond"),
					makeEdge("e2", "cond", "end_a", "a"),
					makeEdge("e3", "cond", "end_b", "b"),
				],
				"s",
			);
			const events: { id: string; event: MarkerLifecycleEvent }[] = [];
			await executeWorkflow(graph, mockCallbacks({
				runConditionNode: async (node, input, outEdges) => ({
					nodeId: node.id,
					status: "success",
					output: input,
					selectedEdgeId: outEdges.find((e) => e.label === "a")?.id,
					durationMs: 1,
				}),
				onMarkerStateChange: (id, event) => events.push({ id, event }),
			}), { maxCycleIterations: 1000 });

			expect(events).toContainEqual({ id: "end_a", event: "end-reached" });
			expect(events).toContainEqual({ id: "end_b", event: "end-unreached" });
		});
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
