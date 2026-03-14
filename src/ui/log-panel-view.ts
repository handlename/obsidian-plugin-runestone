import { App, ItemView, WorkspaceLeaf } from "obsidian";
import { ExecutionState, NodeExecutionEntry } from "./execution-state";
import { formatDuration } from "./format";

export const LOG_PANEL_VIEW_TYPE = "runestone-log-panel";

function statusIcon(entry: NodeExecutionEntry): string {
	switch (entry.status) {
		case "running": return "\u23F1";
		case "success": return "\u2713";
		case "failure": return "\u2717";
		case "skipped": return "\u2014 Skip";
		default: return "\u2014";
	}
}

function statusText(entry: NodeExecutionEntry): string {
	if (entry.status === "running" && entry.startTime) {
		return `${statusIcon(entry)} ${formatDuration(Date.now() - entry.startTime)}`;
	}
	if (entry.result) {
		return `${statusIcon(entry)} ${formatDuration(entry.result.durationMs)}`;
	}
	return statusIcon(entry);
}

export class LogPanelView extends ItemView {
	private state: ExecutionState | null = null;
	private expandedNodes: Set<string> = new Set();
	private timerInterval: ReturnType<typeof setInterval> | null = null;

	getViewType(): string {
		return LOG_PANEL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Runestone Log";
	}

	getIcon(): string {
		return "terminal";
	}

	refresh(state: ExecutionState): void {
		this.state = state;
		this.render();
		this.manageTimer();
		this.scrollToRunning();
	}

	private scrollToRunning(): void {
		const runningEntry = this.contentEl.querySelector(
			".runestone-log-entry-running",
		);
		if (runningEntry) {
			runningEntry.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	}

	private render(): void {
		const container = this.contentEl;
		container.empty();

		if (!this.state) return;

		// Header
		const header = container.createDiv({ cls: "runestone-log-header" });
		header.createSpan({ text: `Runestone: ${this.state.workflowName}` });
		header.createEl("br");
		header.createSpan({
			text: `Progress: ${this.state.completedCount} / ${this.state.totalNodes} nodes`,
			cls: "runestone-log-progress",
		});

		// Entries
		const entries = this.state.getOrderedEntries();
		for (const entry of entries) {
			this.renderEntry(container, entry);
		}
	}

	private renderEntry(container: HTMLElement, entry: NodeExecutionEntry): void {
		const statusClass = `runestone-log-entry-${entry.status}`;
		const entryEl = container.createDiv({ cls: `runestone-log-entry ${statusClass}` });
		entryEl.dataset.nodeId = entry.nodeId;

		const isExpanded = this.expandedNodes.has(entry.nodeId);
		const headerEl = entryEl.createDiv({ cls: "runestone-log-entry-header" });

		// Toggle
		const toggle = headerEl.createSpan({ text: isExpanded ? "\u25BC" : "\u25B6" });
		toggle.addEventListener("click", () => {
			if (this.expandedNodes.has(entry.nodeId)) {
				this.expandedNodes.delete(entry.nodeId);
			} else {
				this.expandedNodes.add(entry.nodeId);
			}
			this.render();
		});

		// Node name (clickable)
		const nameEl = headerEl.createSpan({
			text: entry.filePath.replace(/^.*\//, ""),
			cls: "runestone-log-entry-name",
		});
		nameEl.addEventListener("click", (e) => {
			e.stopPropagation();
			this.app.workspace.openLinkText(entry.filePath, "");
		});

		// Status
		headerEl.createSpan({
			text: statusText(entry),
			cls: "runestone-log-entry-status",
		});

		// Detail section
		if (isExpanded && entry.result) {
			const detail = entryEl.createDiv({ cls: "runestone-log-detail" });

			if (entry.result.stdout) {
				detail.createDiv({ text: "stdout:", cls: "runestone-log-label" });
				detail.createEl("pre", { text: entry.result.stdout, cls: "runestone-log-stdout" });
			}
			if (entry.result.stderr) {
				detail.createDiv({ text: "stderr:", cls: "runestone-log-label" });
				detail.createEl("pre", { text: entry.result.stderr, cls: "runestone-log-stderr" });
			}
			if (entry.result.error) {
				detail.createDiv({ text: "error:", cls: "runestone-log-label" });
				detail.createEl("pre", { text: entry.result.error, cls: "runestone-log-error" });
			}
		}
	}

	private manageTimer(): void {
		if (!this.state) return;

		const hasRunning = Array.from(this.state.entries.values()).some((e) => e.status === "running");

		if (hasRunning && !this.timerInterval) {
			this.timerInterval = setInterval(() => {
				this.render();
			}, 1000);
		} else if (!hasRunning && this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

	async onClose(): Promise<void> {
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}
}

export async function activateLogPanel(app: App): Promise<LogPanelView | null> {
	let leaf = app.workspace.getLeavesOfType(LOG_PANEL_VIEW_TYPE)[0];
	if (!leaf) {
		const rightLeaf = app.workspace.getRightLeaf(false);
		if (!rightLeaf) return null;
		await rightLeaf.setViewState({ type: LOG_PANEL_VIEW_TYPE, active: true });
		leaf = rightLeaf;
	}
	app.workspace.revealLeaf(leaf);
	return leaf.view as LogPanelView;
}
