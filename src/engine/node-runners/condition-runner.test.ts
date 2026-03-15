import { describe, it, expect } from "vitest";
import { runConditionNode } from "./condition-runner";
import { WorkflowNode, WorkflowEdge } from "../../types";

function makeConditionNode(code: string): WorkflowNode {
	return {
		id: "cond-node",
		filePath: "cond.md",
		config: { type: "condition", onError: "stop" },
		body: `\`\`\`js\n${code}\n\`\`\``,
	};
}

function makeOutEdges(): WorkflowEdge[] {
	return [
		{ id: "e1", fromNode: "cond-node", toNode: "yes-node", label: "yes" },
		{ id: "e2", fromNode: "cond-node", toNode: "no-node", label: "no" },
	];
}

describe("runConditionNode", () => {
	it("returns matched edge and passes input through", async () => {
		const node = makeConditionNode('return "yes";');
		const input = [{ data: 42 }];
		const result = await runConditionNode(node, input, {}, makeOutEdges());
		expect(result.status).toBe("success");
		expect(result.output).toEqual([{ data: 42 }]);
		expect(result.selectedEdgeId).toBe("e1");
	});

	it("matches second edge", async () => {
		const node = makeConditionNode('return "no";');
		const result = await runConditionNode(node, [{}], {}, makeOutEdges());
		expect(result.status).toBe("success");
		expect(result.selectedEdgeId).toBe("e2");
	});

	it("fails when return value matches no edge and no default edge", async () => {
		const node = makeConditionNode('return "maybe";');
		const result = await runConditionNode(node, [{}], {}, makeOutEdges());
		expect(result.status).toBe("failure");
		expect(result.error).toContain("No matching edge for 'maybe' and no default edge");
	});

	it("falls back to default edge when no label matches", async () => {
		const node = makeConditionNode('return "unknown";');
		const edges: WorkflowEdge[] = [
			{ id: "e1", fromNode: "cond-node", toNode: "yes-node", label: "yes" },
			{ id: "e2", fromNode: "cond-node", toNode: "no-node", label: "no" },
			{ id: "e-default", fromNode: "cond-node", toNode: "default-node" },
		];
		const result = await runConditionNode(node, [{}], {}, edges);
		expect(result.status).toBe("success");
		expect(result.selectedEdgeId).toBe("e-default");
	});

	it("prefers labeled edge over default edge", async () => {
		const node = makeConditionNode('return "yes";');
		const edges: WorkflowEdge[] = [
			{ id: "e1", fromNode: "cond-node", toNode: "yes-node", label: "yes" },
			{ id: "e-default", fromNode: "cond-node", toNode: "default-node" },
		];
		const result = await runConditionNode(node, [{}], {}, edges);
		expect(result.status).toBe("success");
		expect(result.selectedEdgeId).toBe("e1");
	});

	it("fails when no code block found", async () => {
		const node: WorkflowNode = {
			id: "cond-node",
			filePath: "cond.md",
			config: { type: "condition", onError: "stop" },
			body: "no code block",
		};
		const result = await runConditionNode(node, [{}], {}, makeOutEdges());
		expect(result.status).toBe("failure");
		expect(result.error).toContain("code block");
	});

	it("evaluates input-dependent conditions", async () => {
		const node = makeConditionNode('return input[0].count > 5 ? "yes" : "no";');
		const result = await runConditionNode(node, [{ count: 10 }], {}, makeOutEdges());
		expect(result.status).toBe("success");
		expect(result.selectedEdgeId).toBe("e1");
	});

	it("records duration", async () => {
		const node = makeConditionNode('return "yes";');
		const result = await runConditionNode(node, [{}], {}, makeOutEdges());
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("passes args to condition script", async () => {
		const node = makeConditionNode("return args.threshold > 5 ? 'high' : 'low';");
		const edges = [
			{ id: "e1", fromNode: "cond", toNode: "a", label: "high" },
			{ id: "e2", fromNode: "cond", toNode: "b", label: "low" },
		];
		const result = await runConditionNode(node, [], {}, edges, {}, { threshold: 10 });
		expect(result.status).toBe("success");
		expect(result.selectedEdgeId).toBe("e1");
	});
});
