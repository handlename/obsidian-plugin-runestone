import { CanvasData, MarkerNodeType, RunestoneConfig, RunestoneNodeType } from "../types";

const VALID_NODE_TYPES: readonly string[] = ["exec", "script", "condition"];
const CODE_BLOCK_RE = /```[^\n]*\n([\s\S]*?)```/;

const START_MARKER = "runestone:start";
const END_MARKER = "runestone:end";

export function parseTextMarker(text: string | undefined): MarkerNodeType | null {
	if (typeof text !== "string") return null;
	const trimmed = text.trim();
	if (trimmed === START_MARKER) return "start";
	if (trimmed === END_MARKER) return "end";
	return null;
}

export function parseCanvasJson(json: string): CanvasData {
	try {
		const data = JSON.parse(json) as CanvasData;
		if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
			throw new Error("Invalid canvas data: missing nodes or edges array");
		}
		return data;
	} catch (e) {
		if (e instanceof SyntaxError) {
			throw new Error(`Failed to parse canvas JSON: ${e.message}`);
		}
		throw e;
	}
}

export function parseRunestoneConfig(
	frontmatter: Readonly<Record<string, unknown>>,
): RunestoneConfig | null {
	const typeValue = frontmatter["runestone.type"];
	if (typeof typeValue !== "string" || !VALID_NODE_TYPES.includes(typeValue)) {
		return null;
	}

	const nodeType = typeValue as RunestoneNodeType;
	const onError = frontmatter["runestone.onError"] === "continue" ? "continue" as const : "stop" as const;

	const execConfig = parseExecConfig(frontmatter);

	return {
		type: nodeType,
		onError,
		...(execConfig ? { exec: execConfig } : {}),
	};
}

function parseExecConfig(
	frontmatter: Readonly<Record<string, unknown>>,
): RunestoneConfig["exec"] | null {
	const workdir = frontmatter["runestone.exec.workdir"];
	const shell = frontmatter["runestone.exec.shell"];

	const envPrefix = "runestone.exec.env.";
	const env: Record<string, string> = {};
	let hasEnv = false;
	for (const [key, value] of Object.entries(frontmatter)) {
		if (key.startsWith(envPrefix) && typeof value === "string") {
			env[key.slice(envPrefix.length)] = value;
			hasEnv = true;
		}
	}

	const hasWorkdir = typeof workdir === "string";
	const hasShell = typeof shell === "string";

	if (!hasWorkdir && !hasShell && !hasEnv) return null;

	return {
		...(hasWorkdir ? { workdir: workdir } : {}),
		...(hasShell ? { shell: shell } : {}),
		...(hasEnv ? { env } : {}),
	};
}

export function extractCodeBlock(body: string): string | null {
	const match = CODE_BLOCK_RE.exec(body);
	if (!match?.[1]) return null;
	return match[1].replace(/\n$/, "");
}
