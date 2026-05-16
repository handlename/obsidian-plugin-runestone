import { describe, it, expect } from "vitest";
import { formatOutput, formatDuration, truncate } from "./format";

describe("formatDuration", () => {
	it("formats sub-minute durations in seconds", () => {
		expect(formatDuration(0)).toBe("0s");
		expect(formatDuration(1500)).toBe("1s");
		expect(formatDuration(59_000)).toBe("59s");
	});

	it("formats over-minute durations as minutes and seconds", () => {
		expect(formatDuration(60_000)).toBe("1m 0s");
		expect(formatDuration(125_000)).toBe("2m 5s");
	});
});

describe("truncate", () => {
	it("returns text unchanged when within max length", () => {
		expect(truncate("hello", 10)).toBe("hello");
	});

	it("appends an ellipsis when truncated", () => {
		expect(truncate("hello world", 5)).toBe("hello…");
	});
});

describe("formatOutput", () => {
	it("returns null when output is undefined", () => {
		expect(formatOutput(undefined)).toBeNull();
	});

	it("renders null as the literal string 'null'", () => {
		expect(formatOutput(null)).toBe("null");
	});

	it("pretty-prints objects with two-space indentation", () => {
		expect(formatOutput({ a: 1, b: [2, 3] })).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
	});

	it("pretty-prints arrays", () => {
		expect(formatOutput([1, 2, 3])).toBe("[\n  1,\n  2,\n  3\n]");
	});

	it("renders string primitives as JSON-quoted values", () => {
		expect(formatOutput("hello")).toBe('"hello"');
	});

	it("renders numeric primitives", () => {
		expect(formatOutput(42)).toBe("42");
	});

	it("renders boolean primitives", () => {
		expect(formatOutput(true)).toBe("true");
		expect(formatOutput(false)).toBe("false");
	});

	it("renders empty string with JSON quoting", () => {
		expect(formatOutput("")).toBe('""');
	});
});
