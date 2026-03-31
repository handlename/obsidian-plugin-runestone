import { Plugin } from "obsidian";
import { RunestoneSettings, DEFAULT_SETTINGS, RunestoneSettingTab } from "./settings";
import { runCurrentCanvas, runWorkflow, runWorkflowFromNode, cleanupVisualizer } from "./commands/run-canvas";
import { LOG_PANEL_VIEW_TYPE, LogPanelView } from "./ui/log-panel-view";
import { createNewWorkflow } from "./commands/new-workflow";
import { injectStyles, removeStyles } from "./ui/styles";

export default class RunestonePlugin extends Plugin {
	settings: RunestoneSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		injectStyles();

		this.registerView(LOG_PANEL_VIEW_TYPE, (leaf) => new LogPanelView(leaf));

		this.addCommand({
			id: "run-current-canvas",
			name: "Run current canvas",
			callback: () => runCurrentCanvas(this.app, this.settings),
		});

		for (const workflow of this.settings.workflows) {
			if (!workflow.name.trim() || !workflow.canvasPath.trim()) continue;
			const sanitizedName = workflow.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
			this.addCommand({
				id: `run-workflow-${sanitizedName}`,
				name: `Run ${workflow.name}`,
				callback: () => runWorkflow(this.app, this.settings, workflow.canvasPath, workflow.name),
			});
		}

		const buttonsAdded = new WeakSet<object>();

		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				const leaves = this.app.workspace.getLeavesOfType("canvas");
				for (const leaf of leaves) {
					if (buttonsAdded.has(leaf)) continue;
					buttonsAdded.add(leaf);

					const view = leaf.view as unknown as { file?: { path: string; basename: string }; addAction?: (icon: string, title: string, callback: () => void) => void };
					if (!view.addAction || !view.file) continue;

					view.addAction("play", "Run workflow", () => {
						void runWorkflow(this.app, this.settings, view.file!.path, view.file!.basename);
					});
				}
			}),
		);

		// canvas:node-menu is an undocumented Obsidian API event
		this.registerEvent(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			(this.app.workspace as any).on("canvas:node-menu", (menu: unknown, node: unknown) => {
				const menuObj = menu as { addItem: (cb: (item: { setTitle: (t: string) => unknown; setIcon: (i: string) => unknown; onClick: (cb: () => void) => unknown }) => void) => void };
				const nodeObj = node as { id?: string };
				if (!nodeObj.id) return;

				menuObj.addItem((item) => {
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- plugin name
					item.setTitle("Runestone: Run from this node");
					item.setIcon("play");
					item.onClick(() => {
						const canvasLeaves = this.app.workspace.getLeavesOfType("canvas");
						const activeCanvasLeaf = canvasLeaves.find((leaf) => {
							// eslint-disable-next-line @typescript-eslint/no-deprecated -- no typed alternative for canvas context
							return leaf === this.app.workspace.activeLeaf;
						});
						if (!activeCanvasLeaf) return;

						const view = activeCanvasLeaf.view as unknown as { file?: { path: string; basename: string } };
						if (!view.file) return;

						void runWorkflowFromNode(this.app, this.settings, view.file.path, view.file.basename, nodeObj.id!);
					});
				});
			}),
		);

		this.addCommand({
			id: "new-workflow",
			name: "New workflow",
			callback: () => createNewWorkflow(this.app),
		});

		this.addSettingTab(new RunestoneSettingTab(this.app, this));
	}

	onunload() {
		cleanupVisualizer();
		removeStyles();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<RunestoneSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
