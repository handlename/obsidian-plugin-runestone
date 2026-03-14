import { describe, it, expect } from "vitest";
import { createExecutionState, updateExecutionState } from "./execution-state";
import { NodeResult } from "../types";

function makeNodeMap(ids: string[]): ReadonlyMap<string, { id: string; filePath: string }> {
	return new Map(ids.map((id) => [id, { id, filePath: `${id}.md` }]));
}

describe("createExecutionState", () => {
	it("initializes with all nodes as pending", () => {
		const state = createExecutionState("test-workflow", makeNodeMap(["a", "b", "c"]));
		expect(state.workflowName).toBe("test-workflow");
		expect(state.totalNodes).toBe(3);
		expect(state.completedCount).toBe(0);
		expect(state.entries.get("a")?.status).toBe("pending");
	});
});

describe("updateExecutionState", () => {
	it("records startTime when status becomes running", () => {
		const state = createExecutionState("test", makeNodeMap(["a"]));
		updateExecutionState(state, "a", "running");
		expect(state.entries.get("a")?.status).toBe("running");
		expect(state.entries.get("a")?.startTime).toBeGreaterThan(0);
	});

	it("stores result and increments completedCount on terminal state", () => {
		const state = createExecutionState("test", makeNodeMap(["a", "b"]));
		const result: NodeResult = { nodeId: "a", status: "success", output: { x: 1 }, durationMs: 100 };
		updateExecutionState(state, "a", "success", result);
		expect(state.entries.get("a")?.result).toBe(result);
		expect(state.completedCount).toBe(1);
	});

	it("does not increment completedCount for non-terminal states", () => {
		const state = createExecutionState("test", makeNodeMap(["a"]));
		updateExecutionState(state, "a", "running");
		expect(state.completedCount).toBe(0);
	});

	it("tracks execution ordering", () => {
		const state = createExecutionState("test", makeNodeMap(["a", "b", "c"]));
		updateExecutionState(state, "b", "running");
		updateExecutionState(state, "a", "running");
		expect(state.executionOrder).toEqual(["b", "a"]);
	});

	it("appends skipped nodes not in execution order", () => {
		const state = createExecutionState("test", makeNodeMap(["a", "b", "c"]));
		updateExecutionState(state, "a", "running");
		const skipResult: NodeResult = { nodeId: "c", status: "skipped", durationMs: 0 };
		updateExecutionState(state, "c", "skipped", skipResult);
		expect(state.executionOrder).toEqual(["a"]);
		expect(state.getOrderedEntries().map((e) => e.nodeId)).toEqual(["a", "c"]);
	});
});
