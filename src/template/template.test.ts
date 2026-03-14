import { describe, it, expect } from "vitest";
import { resolveTemplates } from "./template";

describe("resolveTemplates", () => {
	it("resolves simple property access", () => {
		const input = [{ name: "Alice" }];
		expect(resolveTemplates("Hello {{input[0].name}}", input)).toBe("Hello Alice");
	});

	it("resolves nested property access", () => {
		const input = [{ result: { status: "ok" } }];
		expect(resolveTemplates("{{input[0].result.status}}", input)).toBe("ok");
	});

	it("resolves multiple templates in one string", () => {
		const input = [{ a: "1", b: "2" }];
		expect(resolveTemplates("{{input[0].a}}-{{input[0].b}}", input)).toBe("1-2");
	});

	it("resolves array index in the middle of path", () => {
		const input = [{ items: ["x", "y", "z"] }];
		expect(resolveTemplates("{{input[0].items[1]}}", input)).toBe("y");
	});

	it("resolves nested array access", () => {
		const input = [{ rows: [{ name: "Bob" }] }];
		expect(resolveTemplates("{{input[0].rows[0].name}}", input)).toBe("Bob");
	});

	it("resolves multiple inputs", () => {
		const input = [{ x: "1" }, { y: "2" }];
		expect(resolveTemplates("{{input[0].x}}-{{input[1].y}}", input)).toBe("1-2");
	});

	it("stringifies non-string values", () => {
		const input = [{ count: 42 }];
		expect(resolveTemplates("{{input[0].count}}", input)).toBe("42");
	});

	it("stringifies object values as JSON", () => {
		const input = [{ data: { a: 1 } }];
		expect(resolveTemplates("{{input[0].data}}", input)).toBe('{"a":1}');
	});

	it("returns string as-is when no templates", () => {
		expect(resolveTemplates("no templates here", [{}])).toBe("no templates here");
	});

	it("throws on undefined property", () => {
		const input = [{ name: "Alice" }];
		expect(() => resolveTemplates("{{input[0].missing}}", input)).toThrow();
	});

	it("throws on out-of-bounds index", () => {
		const input = [{ name: "Alice" }];
		expect(() => resolveTemplates("{{input[5].name}}", input)).toThrow();
	});

	it("throws on invalid expression (not starting with input)", () => {
		expect(() => resolveTemplates("{{foo.bar}}", [{}])).toThrow();
	});

	it("resolves input element without property access", () => {
		const input = [{ name: "Alice" }];
		expect(resolveTemplates("{{input[0]}}", input)).toBe('{"name":"Alice"}');
	});

	it("throws when traversing through null", () => {
		const input = [{ data: null }];
		expect(() => resolveTemplates("{{input[0].data.name}}", input)).toThrow();
	});
});
