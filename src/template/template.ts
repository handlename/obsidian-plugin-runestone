const TEMPLATE_RE = /\{\{(.+?)\}\}/g;

// Matches property path segments: .key or [n]
const SEGMENT_RE = /\.([a-zA-Z_$][a-zA-Z0-9_$]*)|(\[(\d+)\])/g;

export function resolveTemplates(text: string, input: readonly unknown[]): string {
	return text.replace(TEMPLATE_RE, (match, expr: string) => {
		const value = evaluateExpression(expr.trim(), input);
		if (typeof value === "string") return value;
		if (typeof value === "number" || typeof value === "boolean") return String(value);
		return JSON.stringify(value);
	});
}

function evaluateExpression(expr: string, input: readonly unknown[]): unknown {
	if (!expr.startsWith("input")) {
		throw new Error(`Template expression must start with "input": {{${expr}}}`);
	}

	const path = expr.slice("input".length);
	const segments = parseSegments(path, expr);

	let current: unknown = input;
	for (const segment of segments) {
		if (current === null || current === undefined) {
			throw new Error(`Cannot access "${segment.key}" on ${current} in {{${expr}}}`);
		}
		if (segment.type === "index") {
			if (!Array.isArray(current)) {
				throw new Error(`Cannot use index [${segment.key}] on non-array in {{${expr}}}`);
			}
			const idx = segment.key as number;
			if (idx < 0 || idx >= current.length) {
				throw new Error(`Index [${idx}] out of bounds (length ${current.length}) in {{${expr}}}`);
			}
			current = current[idx];
		} else {
			const obj = current as Record<string, unknown>;
			const key = segment.key as string;
			if (!(key in obj)) {
				throw new Error(`Property "${key}" not found in {{${expr}}}`);
			}
			current = obj[key];
		}
	}
	return current;
}

interface PathSegment {
	readonly type: "property" | "index";
	readonly key: string | number;
}

function parseSegments(path: string, fullExpr: string): readonly PathSegment[] {
	const segments: PathSegment[] = [];
	let lastIndex = 0;

	SEGMENT_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = SEGMENT_RE.exec(path)) !== null) {
		if (m.index !== lastIndex) {
			throw new Error(`Invalid path syntax in {{${fullExpr}}}`);
		}
		if (m[1] !== undefined) {
			segments.push({ type: "property", key: m[1] });
		} else if (m[3] !== undefined) {
			segments.push({ type: "index", key: parseInt(m[3], 10) });
		}
		lastIndex = SEGMENT_RE.lastIndex;
	}

	if (lastIndex !== path.length) {
		throw new Error(`Invalid path syntax in {{${fullExpr}}}`);
	}

	return segments;
}
