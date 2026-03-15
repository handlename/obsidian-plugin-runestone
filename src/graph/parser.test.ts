import { describe, it, expect } from "vitest";
import {
	parseCanvasJson,
	parseRunestoneConfig,
	extractCodeBlock,
} from "./parser";
import { extractFrontmatterBody } from "./builder";

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

	it("preserves fromEnd and toEnd fields on edges", () => {
		const json = JSON.stringify({
			nodes: [
				{ id: "n1", type: "file", file: "a.md", x: 0, y: 0, width: 100, height: 100 },
				{ id: "n2", type: "file", file: "b.md", x: 200, y: 0, width: 100, height: 100 },
			],
			edges: [
				{ id: "e1", fromNode: "n1", toNode: "n2", fromEnd: "none", toEnd: "none" },
				{ id: "e2", fromNode: "n1", toNode: "n2", fromEnd: "none", toEnd: "arrow" },
				{ id: "e3", fromNode: "n1", toNode: "n2" },
			],
		});
		const result = parseCanvasJson(json);
		expect(result.edges[0]!.fromEnd).toBe("none");
		expect(result.edges[0]!.toEnd).toBe("none");
		expect(result.edges[1]!.fromEnd).toBe("none");
		expect(result.edges[1]!.toEnd).toBe("arrow");
		expect(result.edges[2]!.fromEnd).toBeUndefined();
		expect(result.edges[2]!.toEnd).toBeUndefined();
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

describe("extractFrontmatterBody", () => {
	it("extracts body after frontmatter", () => {
		expect(extractFrontmatterBody("---\ntype: exec\n---\nbody here")).toBe("body here");
	});

	it("returns full content when no frontmatter", () => {
		expect(extractFrontmatterBody("just a body")).toBe("just a body");
	});

	it("handles frontmatter with trailing newline", () => {
		expect(extractFrontmatterBody("---\nkey: val\n---\n\nbody")).toBe("\nbody");
	});
});
