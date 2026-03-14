import { App } from "obsidian";
import { NodeStatus } from "../types";
import { ExecutionState } from "./execution-state";
import { formatDuration, truncate } from "./format";

const COLOR_MAP: Record<NodeStatus, string> = {
	pending: "",
	running: "5",
	success: "4",
	failure: "2",
	skipped: "0",
};

// Obsidian internal Canvas API types (not publicly typed)
interface CanvasNodeInternal {
	setColor(color: string): void;
	contentEl: HTMLElement;
}

interface CanvasViewInternal {
	canvas: {
		nodes: Map<string, CanvasNodeInternal>;
	};
	file: { path: string } | null;
}

export class CanvasVisualizer {
	private canvasNodes: Map<string, CanvasNodeInternal> | null = null;
	private overlayElements: Map<string, HTMLElement> = new Map();
	private timerInterval: ReturnType<typeof setInterval> | null = null;

	initialize(app: App, canvasPath: string): void {
		this.cleanup();

		const canvasLeaf = app.workspace.getLeavesOfType("canvas")
			.find((leaf) => {
				const view = leaf.view as unknown as CanvasViewInternal;
				return view.file?.path === canvasPath;
			});

		if (!canvasLeaf) return;

		const view = canvasLeaf.view as unknown as CanvasViewInternal;
		this.canvasNodes = view.canvas.nodes;
	}

	updateNode(nodeId: string, state: ExecutionState): void {
		if (!this.canvasNodes) return;

		const canvasNode = this.canvasNodes.get(nodeId);
		if (!canvasNode) return;

		const entry = state.entries.get(nodeId);
		if (!entry) return;

		try {
			canvasNode.setColor(COLOR_MAP[entry.status] ?? "");
			this.updateOverlay(nodeId, canvasNode, entry.status, state);
			this.manageTimer(state);
		} catch (e) {
			console.error("[Runestone] Canvas visualization error:", e);
		}
	}

	cleanup(): void {
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}

		for (const el of this.overlayElements.values()) {
			el.remove();
		}
		this.overlayElements.clear();

		if (this.canvasNodes) {
			for (const canvasNode of this.canvasNodes.values()) {
				try {
					canvasNode.setColor("");
				} catch {
					// Canvas node may no longer exist
				}
			}
		}

		this.canvasNodes = null;
	}

	private updateOverlay(
		nodeId: string,
		canvasNode: CanvasNodeInternal,
		status: NodeStatus,
		state: ExecutionState,
	): void {
		let overlay = this.overlayElements.get(nodeId);
		if (!overlay) {
			overlay = document.createElement("div");
			overlay.className = "runestone-overlay";
			canvasNode.contentEl.style.position = "relative";
			canvasNode.contentEl.appendChild(overlay);
			this.overlayElements.set(nodeId, overlay);
		}

		const entry = state.entries.get(nodeId);
		if (!entry) return;

		switch (status) {
			case "running": {
				const elapsed = entry.startTime ? Date.now() - entry.startTime : 0;
				overlay.textContent = `\u23F1 ${formatDuration(elapsed)}`;
				break;
			}
			case "success": {
				const duration = entry.result?.durationMs ?? 0;
				overlay.textContent = "";
				const line1 = document.createElement("div");
				line1.textContent = `\u2713 ${formatDuration(duration)}`;
				overlay.appendChild(line1);
				const stdout = entry.result?.stdout;
				if (stdout) {
					const line2 = document.createElement("div");
					line2.className = "runestone-overlay-stdout";
					line2.textContent = truncate(stdout, 100);
					overlay.appendChild(line2);
				}
				break;
			}
			case "failure": {
				const duration = entry.result?.durationMs ?? 0;
				overlay.textContent = "";
				const line1 = document.createElement("div");
				line1.textContent = `\u2717 ${formatDuration(duration)}`;
				overlay.appendChild(line1);
				const errorMsg = entry.result?.error;
				if (errorMsg) {
					const line2 = document.createElement("div");
					line2.className = "runestone-overlay-stdout";
					line2.textContent = truncate(errorMsg, 100);
					overlay.appendChild(line2);
				}
				break;
			}
			case "skipped": {
				overlay.textContent = "\u2014 Skipped";
				break;
			}
			case "pending": {
				overlay.remove();
				this.overlayElements.delete(nodeId);
				break;
			}
		}
	}

	private manageTimer(state: ExecutionState): void {
		const hasRunning = Array.from(state.entries.values()).some((e) => e.status === "running");

		if (hasRunning && !this.timerInterval) {
			this.timerInterval = setInterval(() => {
				this.updateRunningOverlays(state);
			}, 1000);
		} else if (!hasRunning && this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

	private updateRunningOverlays(state: ExecutionState): void {
		if (!this.canvasNodes) return;

		for (const entry of state.entries.values()) {
			if (entry.status !== "running") continue;
			const overlay = this.overlayElements.get(entry.nodeId);
			if (!overlay) continue;
			const elapsed = entry.startTime ? Date.now() - entry.startTime : 0;
			overlay.textContent = `\u23F1 ${formatDuration(elapsed)}`;
		}
	}
}
