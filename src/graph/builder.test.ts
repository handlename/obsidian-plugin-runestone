import { describe, it, expect } from "vitest";
import { isNondirectionalEdge } from "./builder";
import { CanvasEdge } from "../types";

describe("isNondirectionalEdge", () => {
	it("returns true when both fromEnd and toEnd are 'none'", () => {
		const edge: CanvasEdge = {
			id: "e1", fromNode: "a", toNode: "b",
			fromEnd: "none", toEnd: "none",
		};
		expect(isNondirectionalEdge(edge)).toBe(true);
	});

	it("returns false when toEnd is 'arrow'", () => {
		const edge: CanvasEdge = {
			id: "e1", fromNode: "a", toNode: "b",
			fromEnd: "none", toEnd: "arrow",
		};
		expect(isNondirectionalEdge(edge)).toBe(false);
	});

	it("returns false when fromEnd is 'arrow' and toEnd is 'none'", () => {
		const edge: CanvasEdge = {
			id: "e1", fromNode: "a", toNode: "b",
			fromEnd: "arrow", toEnd: "none",
		};
		expect(isNondirectionalEdge(edge)).toBe(false);
	});

	it("returns false when toEnd is undefined (defaults to arrow)", () => {
		const edge: CanvasEdge = {
			id: "e1", fromNode: "a", toNode: "b",
		};
		expect(isNondirectionalEdge(edge)).toBe(false);
	});

	it("returns false when only fromEnd is 'none' and toEnd is undefined", () => {
		const edge: CanvasEdge = {
			id: "e1", fromNode: "a", toNode: "b",
			fromEnd: "none",
		};
		expect(isNondirectionalEdge(edge)).toBe(false);
	});
});
