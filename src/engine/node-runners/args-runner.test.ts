import { describe, it, expect } from "vitest";
import { runArgsNode } from "./args-runner";
import { WorkflowNode } from "../../types";

function makeArgsNode(code: string, onError: "stop" | "continue" = "stop"): WorkflowNode {
	return {
		id: "test-args",
		filePath: "test-args.md",
		config: { type: "args", onError },
		body: `\`\`\`js\n${code}\n\`\`\``,
	};
}

describe("runArgsNode", () => {
	it("executes code and returns object result", async () => {
		const node = makeArgsNode('return { items: ["a", "b"] };');
		const result = await runArgsNode(node, {}, {});
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ items: ["a", "b"] });
	});

	it("has access to app parameter", async () => {
		const node = makeArgsNode("return { hasApp: typeof app !== 'undefined' };");
		const result = await runArgsNode(node, { mock: true }, {});
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ hasApp: true });
	});

	it("fails when return value is not an object", async () => {
		const node = makeArgsNode('return "not an object";');
		const result = await runArgsNode(node, {}, {});
		expect(result.status).toBe("failure");
		expect(result.error).toContain("object");
	});

	it("fails when return value is an array", async () => {
		const node = makeArgsNode("return [1, 2, 3];");
		const result = await runArgsNode(node, {}, {});
		expect(result.status).toBe("failure");
		expect(result.error).toContain("object");
	});

	it("fails when return value is null", async () => {
		const node = makeArgsNode("return null;");
		const result = await runArgsNode(node, {}, {});
		expect(result.status).toBe("failure");
		expect(result.error).toContain("object");
	});

	it("fails when no code block found", async () => {
		const node: WorkflowNode = {
			id: "test-args",
			filePath: "test-args.md",
			config: { type: "args", onError: "stop" },
			body: "no code block",
		};
		const result = await runArgsNode(node, {}, {});
		expect(result.status).toBe("failure");
		expect(result.error).toContain("code block");
	});

	it("fails on thrown error", async () => {
		const node = makeArgsNode('throw new Error("boom");');
		const result = await runArgsNode(node, {}, {});
		expect(result.status).toBe("failure");
		expect(result.error).toContain("boom");
	});

	it("supports async code", async () => {
		const node = makeArgsNode("const x = await Promise.resolve(42); return { value: x };");
		const result = await runArgsNode(node, {}, {});
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ value: 42 });
	});

	it("records duration", async () => {
		const node = makeArgsNode("return {};");
		const result = await runArgsNode(node, {}, {});
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});
});
