import { NodeResult, WorkflowNode } from "../../types";
import { extractCodeBlock } from "../../graph/parser";

export async function runArgsNode(
	node: WorkflowNode,
	app: unknown,
	obsidianModule: unknown = {},
): Promise<NodeResult> {
	const startTime = Date.now();
	try {
		const code = extractCodeBlock(node.body);
		if (!code) {
			return {
				nodeId: node.id,
				status: "failure",
				error: `No code block found in args node "${node.id}" (${node.filePath})`,
				durationMs: Date.now() - startTime,
			};
		}

		const AsyncFunction = (async function () {}).constructor as
			new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;

		const fn = new AsyncFunction("app", "obsidian", code);
		const result = await fn(app, obsidianModule);

		if (result === null || result === undefined || typeof result !== "object" || Array.isArray(result)) {
			return {
				nodeId: node.id,
				status: "failure",
				error: `Args node "${node.id}" (${node.filePath}) must return a plain object, got ${Array.isArray(result) ? "array" : String(result)}`,
				durationMs: Date.now() - startTime,
			};
		}

		return {
			nodeId: node.id,
			status: "success",
			output: result,
			durationMs: Date.now() - startTime,
		};
	} catch (e) {
		return {
			nodeId: node.id,
			status: "failure",
			error: e instanceof Error ? e.message : String(e),
			durationMs: Date.now() - startTime,
		};
	}
}
