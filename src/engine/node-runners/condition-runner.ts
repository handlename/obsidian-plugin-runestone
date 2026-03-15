import { ConditionResult, WorkflowNode, WorkflowEdge } from "../../types";
import { resolveTemplates } from "../../template/template";
import { extractCodeBlock } from "../../graph/parser";

export async function runConditionNode(
	node: WorkflowNode,
	input: readonly unknown[],
	app: unknown,
	outgoingEdges: readonly WorkflowEdge[],
): Promise<ConditionResult> {
	const startTime = Date.now();
	try {
		const code = extractCodeBlock(node.body);
		if (!code) {
			return {
				nodeId: node.id,
				status: "failure",
				error: `No code block found in condition node "${node.id}" (${node.filePath})`,
				durationMs: Date.now() - startTime,
			};
		}

		const resolvedCode = resolveTemplates(code, input);

		const AsyncFunction = (async function () {}).constructor as
			new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;

		const fn = new AsyncFunction("app", "input", resolvedCode);
		const returnValue = await fn(app, input);
		const conditionValue = String(returnValue);

		const labeledEdges = outgoingEdges.filter((e) => !!e.label);
		const matchedEdge = labeledEdges.find((e) => e.label === conditionValue);
		const defaultEdge = outgoingEdges.find((e) => !e.label);
		const selectedEdge = matchedEdge ?? defaultEdge;

		if (!selectedEdge) {
			return {
				nodeId: node.id,
				status: "failure",
				error: `No matching edge for '${conditionValue}' and no default edge. Available labels: ${labeledEdges.map((e) => e.label).join(", ")}`,
				durationMs: Date.now() - startTime,
			};
		}

		return {
			nodeId: node.id,
			status: "success",
			output: input,
			selectedEdgeId: selectedEdge.id,
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
