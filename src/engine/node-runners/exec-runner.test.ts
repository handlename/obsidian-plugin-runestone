import { describe, it, expect } from "vitest";
import { runExecNode } from "./exec-runner";
import { WorkflowNode } from "../../types";

function makeExecNode(code: string, config?: Partial<WorkflowNode["config"]>): WorkflowNode {
	return {
		id: "test-node",
		filePath: "test.md",
		config: { type: "exec", onError: "stop", ...config },
		body: `Some text\n\`\`\`shell\n${code}\n\`\`\`\nMore text`,
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

	it("fails when no code block found", async () => {
		const node: WorkflowNode = {
			id: "test-node",
			filePath: "test.md",
			config: { type: "exec", onError: "stop" },
			body: "no code block here",
		};
		const result = await runExecNode(node, [], { vaultPath: "/tmp" });
		expect(result.status).toBe("failure");
		expect(result.error).toContain("code block");
	});

	it("resolves args templates in command body", async () => {
		const node = makeExecNode('echo \'{"greeting": "hello {{args.name}}"}\'');
		const result = await runExecNode(node, [], { vaultPath: "/tmp" }, { name: "Bob" });
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ greeting: "hello Bob" });
	});

	it("resolves args templates in env values", async () => {
		const node = makeExecNode('echo "{\\"val\\": \\"$MY_VAR\\"}"', {
			type: "exec",
			onError: "stop",
			exec: { env: { MY_VAR: "{{args.value}}" } },
		});
		const result = await runExecNode(node, [], { vaultPath: "/tmp" }, { value: "from-args" });
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ val: "from-args" });
	});

	it("resolves args templates in workdir", async () => {
		const node = makeExecNode('echo \'{"cwd": "ok"}\'', {
			type: "exec",
			onError: "stop",
			exec: { workdir: "{{args.dir}}" },
		});
		const result = await runExecNode(node, [], { vaultPath: "/tmp" }, { dir: "/tmp" });
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ cwd: "ok" });
	});

	it("fails when args template references missing key", async () => {
		const node = makeExecNode('echo \'{"ok": "{{args.missing}}"}\'');
		const result = await runExecNode(node, [], { vaultPath: "/tmp" }, { name: "Bob" });
		expect(result.status).toBe("failure");
		expect(result.error).toContain("missing");
	});

	it("resolves mixed input and args templates", async () => {
		const node = makeExecNode('echo \'{"result": "{{input[0].x}}-{{args.y}}"}\'');
		const result = await runExecNode(node, [{ x: "1" }], { vaultPath: "/tmp" }, { y: "2" });
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ result: "1-2" });
	});

	it("works without args (backward compatibility)", async () => {
		const node = makeExecNode('echo \'{"result": "ok"}\'');
		const result = await runExecNode(node, [], { vaultPath: "/tmp" });
		expect(result.status).toBe("success");
		expect(result.output).toEqual({ result: "ok" });
	});
});
