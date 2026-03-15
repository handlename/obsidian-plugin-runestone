import { App, TFile } from "obsidian";
import { ParsedGraph, WorkflowNode, WorkflowEdge, CanvasNode, CanvasEdge } from "../types";
import { parseCanvasJson, parseRunestoneConfig } from "./parser";

export function isNondirectionalEdge(edge: CanvasEdge): boolean {
	return edge.fromEnd === "none" && edge.toEnd === "none";
}

export async function buildParsedGraph(app: App, canvasFilePath: string): Promise<ParsedGraph> {
	const canvasFile = app.vault.getAbstractFileByPath(canvasFilePath);
	if (!(canvasFile instanceof TFile)) {
		throw new Error(`Canvas file not found: ${canvasFilePath}`);
	}

	const canvasJson = await app.vault.read(canvasFile);
	const canvasData = parseCanvasJson(canvasJson);

	const fileNodes = canvasData.nodes.filter(
		(n): n is CanvasNode & { file: string } => n.type === "file" && typeof n.file === "string",
	);

	const nodes = new Map<string, WorkflowNode>();
	for (const canvasNode of fileNodes) {
		const noteFile = app.vault.getAbstractFileByPath(canvasNode.file);
		if (!(noteFile instanceof TFile)) continue;

		const content = await app.vault.read(noteFile);
		const frontmatter = app.metadataCache.getFileCache(noteFile)?.frontmatter ?? {};
		const config = parseRunestoneConfig(frontmatter);
		if (!config) continue;

		const body = extractFrontmatterBody(content);

		nodes.set(canvasNode.id, {
			id: canvasNode.id,
			filePath: canvasNode.file,
			config,
			body,
		});
	}

	const edges: WorkflowEdge[] = canvasData.edges
		.filter((e) => !isNondirectionalEdge(e))
		.map((e) => ({
			id: e.id,
			fromNode: e.fromNode,
			toNode: e.toNode,
			...(e.label ? { label: e.label } : {}),
		}));

	return { nodes, edges };
}

export function extractFrontmatterBody(content: string): string {
	const match = /^---\n[\s\S]*?\n---\n?/.exec(content);
	if (!match) return content;
	return content.slice(match[0].length);
}
