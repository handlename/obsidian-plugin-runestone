import { NodeResult, WorkflowNode } from "../../types";
import { resolveTemplates } from "../../template/template";
import { extractCodeBlock } from "../../graph/parser";

export async function runScriptNode(
	node: WorkflowNode,
	input: readonly unknown[],
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
				error: `No code block found in script node "${node.id}" (${node.filePath})`,
				durationMs: Date.now() - startTime,
			};
		}

		const resolvedCode = resolveTemplates(code, input);

		const AsyncFunction = (async function () {}).constructor as
			new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;

		const fn = new AsyncFunction("app", "input", "obsidian", resolvedCode);
		const result = await fn(app, input, obsidianModule);
		const output = result === undefined ? null : result;

		return {
			nodeId: node.id,
			status: "success",
			output,
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
