import { describe, it, expect } from "vitest";
import { runScriptNode } from "./script-runner";
import { WorkflowNode } from "../../types";

function makeScriptNode(code: string): WorkflowNode {
	return {
		id: "test-node",
		filePath: "test.md",
		config: { type: "script", onError: "stop" },
		body: `Some text\n\`\`\`js\n${code}\n\`\`\`\nMore text`,
	};
}

describe("runScriptNode", () => {
	it("executes code and returns result", async () => {
		const node = makeScriptNode('return { result: "ok" };');
		const result = await runScriptNode(node, [], {});
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ result: "ok" });
	});

	it("passes input to script", async () => {
		const node = makeScriptNode("return { name: input[0].name };");
		const result = await runScriptNode(node, [{ name: "Alice" }], {});
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ name: "Alice" });
	});

	it("supports async code", async () => {
		const node = makeScriptNode("const x = await Promise.resolve(42); return { value: x };");
		const result = await runScriptNode(node, [], {});
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ value: 42 });
	});

	it("coerces undefined return to null", async () => {
		const node = makeScriptNode("// no return");
		const result = await runScriptNode(node, [], {});
		expect(result.status).toBe("success");
		expect(result.output).toBeNull();
	});

	it("fails on thrown error", async () => {
		const node = makeScriptNode('throw new Error("boom");');
		const result = await runScriptNode(node, [], {});
		expect(result.status).toBe("failure");
		expect(result.error).toContain("boom");
	});

	it("fails when no code block found", async () => {
		const node: WorkflowNode = {
			id: "test-node",
			filePath: "test.md",
			config: { type: "script", onError: "stop" },
			body: "no code block here",
		};
		const result = await runScriptNode(node, [], {});
		expect(result.status).toBe("failure");
		expect(result.error).toContain("code block");
	});

	it("resolves templates in code before execution", async () => {
		const node = makeScriptNode('return { greeting: "Hello {{input[0].name}}" };');
		const result = await runScriptNode(node, [{ name: "Bob" }], {});
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ greeting: "Hello Bob" });
	});

	it("records duration", async () => {
		const node = makeScriptNode("return {};");
		const result = await runScriptNode(node, [], {});
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("passes args to script", async () => {
		const node = makeScriptNode("return { combined: input[0].x + args.y };");
		const result = await runScriptNode(node, [{ x: 1 }], {}, {}, { y: 2 });
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ combined: 3 });
	});

	it("provides empty args by default", async () => {
		const node = makeScriptNode("return { keys: Object.keys(args) };");
		const result = await runScriptNode(node, [], {}, {});
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ keys: [] });
	});
});
