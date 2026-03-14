import { describe, it, expect } from "vitest";
import { sanitizeFileName } from "./new-workflow";

describe("sanitizeFileName", () => {
	it("returns valid name unchanged", () => {
		expect(sanitizeFileName("my-workflow")).toBe("my-workflow");
	});

	it("returns empty string for empty input", () => {
		expect(sanitizeFileName("")).toBe("");
	});

	it("returns empty string for whitespace-only input", () => {
		expect(sanitizeFileName("   ")).toBe("");
	});

	it("trims whitespace", () => {
		expect(sanitizeFileName("  hello  ")).toBe("hello");
	});

	it("rejects names with path separators", () => {
		expect(sanitizeFileName("foo/bar")).toBe("");
		expect(sanitizeFileName("foo\\bar")).toBe("");
	});

	it("rejects names with filesystem-problematic characters", () => {
		expect(sanitizeFileName("foo:bar")).toBe("");
		expect(sanitizeFileName("foo*bar")).toBe("");
		expect(sanitizeFileName("foo?bar")).toBe("");
		expect(sanitizeFileName('foo"bar')).toBe("");
		expect(sanitizeFileName("foo<bar")).toBe("");
		expect(sanitizeFileName("foo>bar")).toBe("");
		expect(sanitizeFileName("foo|bar")).toBe("");
	});
});
