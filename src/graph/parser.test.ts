import { describe, it, expect } from "vitest";
import {
	parseCanvasJson,
	parseRunestoneConfig,
	extractCodeBlock,
} from "./parser";

describe("parseCanvasJson", () => {
	it("parses nodes and edges from valid canvas JSON", () => {
		const json = JSON.stringify({
			nodes: [
				{ id: "n1", type: "file", file: "note1.md", x: 0, y: 0, width: 100, height: 100 },
				{ id: "n2", type: "text", text: "hello", x: 200, y: 0, width: 100, height: 100 },
			],
			edges: [
				{ id: "e1", fromNode: "n1", toNode: "n2" },
			],
		});
		const result = parseCanvasJson(json);
		expect(result.nodes).toHaveLength(2);
		expect(result.edges).toHaveLength(1);
	});

	it("throws on invalid JSON", () => {
		expect(() => parseCanvasJson("not json")).toThrow();
	});
});

describe("parseRunestoneConfig", () => {
	it("parses exec config", () => {
		const frontmatter = {
			"runestone.type": "exec",
		};
		const config = parseRunestoneConfig(frontmatter);
		expect(config).toEqual({ type: "exec", onError: "stop" });
	});

	it("parses onError: continue", () => {
		const frontmatter = {
			"runestone.type": "exec",
			"runestone.onError": "continue",
		};
		const config = parseRunestoneConfig(frontmatter);
		expect(config).toEqual({ type: "exec", onError: "continue" });
	});

	it("parses exec environment config", () => {
		const frontmatter = {
			"runestone.type": "exec",
			"runestone.exec.workdir": "/tmp",
			"runestone.exec.shell": "/bin/bash",
			"runestone.exec.env.API_KEY": "secret",
		};
		const config = parseRunestoneConfig(frontmatter);
		expect(config).toEqual({
			type: "exec",
			onError: "stop",
			exec: {
				workdir: "/tmp",
				shell: "/bin/bash",
				env: { API_KEY: "secret" },
			},
		});
	});

	it("returns null for note without runestone.type", () => {
		const config = parseRunestoneConfig({});
		expect(config).toBeNull();
	});

	it("returns null for invalid runestone.type", () => {
		const config = parseRunestoneConfig({ "runestone.type": "invalid" });
		expect(config).toBeNull();
	});
});

describe("extractCodeBlock", () => {
	it("extracts first code block", () => {
		const body = "Some text\n```js\nconsole.log('hi');\n```\nMore text";
		expect(extractCodeBlock(body)).toBe("console.log('hi');");
	});

	it("extracts first code block when multiple exist", () => {
		const body = "```\nfirst\n```\n```\nsecond\n```";
		expect(extractCodeBlock(body)).toBe("first");
	});

	it("returns null when no code block", () => {
		expect(extractCodeBlock("no code block here")).toBeNull();
	});

	it("handles code block with no language specifier", () => {
		const body = "```\ncode here\n```";
		expect(extractCodeBlock(body)).toBe("code here");
	});
});
