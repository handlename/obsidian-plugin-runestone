import { describe, it, expect } from "vitest";
import { runExecNode } from "./exec-runner";
import { WorkflowNode } from "../../types";

function makeExecNode(body: string, config?: Partial<WorkflowNode["config"]>): WorkflowNode {
	return {
		id: "test-node",
		filePath: "test.md",
		config: { type: "exec", onError: "stop", ...config },
		body,
	};
}

describe("runExecNode", () => {
	it("executes a command and parses JSON stdout", async () => {
		const node = makeExecNode('echo \'{"result": "ok"}\'');
		const result = await runExecNode(node, [], { vaultPath: "/tmp" });
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ result: "ok" });
	});

	it("fails when stdout is not valid JSON", async () => {
		const node = makeExecNode("echo 'not json'");
		const result = await runExecNode(node, [], { vaultPath: "/tmp" });
		expect(result.status).toBe("failure");
		expect(result.error).toContain("JSON");
	});

	it("fails when stdout is empty", async () => {
		const node = makeExecNode("true");
		const result = await runExecNode(node, [], { vaultPath: "/tmp" });
		expect(result.status).toBe("failure");
		expect(result.error).toContain("JSON");
	});

	it("fails when command exits with non-zero", async () => {
		const node = makeExecNode("exit 1");
		const result = await runExecNode(node, [], { vaultPath: "/tmp" });
		expect(result.status).toBe("failure");
	});

	it("uses custom workdir from config", async () => {
		const node = makeExecNode("pwd", {
			type: "exec",
			onError: "stop",
			exec: { workdir: "/tmp" },
		});
		const result = await runExecNode(node, [], { vaultPath: "/home" });
		expect(result.status).toBe("failure"); // pwd outputs a path, not JSON
		expect(result.stdout).toContain("/tmp");
	});

	it("resolves templates in command body", async () => {
		const node = makeExecNode('echo \'{"name": "{{input[0].name}}"}\'');
		const result = await runExecNode(node, [{ name: "Alice" }], { vaultPath: "/tmp" });
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ name: "Alice" });
	});

	it("records duration", async () => {
		const node = makeExecNode('echo \'{"ok":true}\'');
		const result = await runExecNode(node, [], { vaultPath: "/tmp" });
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});
});
