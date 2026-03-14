import { Plugin } from "obsidian";
import { RunestoneSettings, DEFAULT_SETTINGS, RunestoneSettingTab } from "./settings";
import { runCurrentCanvas, cleanupVisualizer } from "./commands/run-canvas";
import { LOG_PANEL_VIEW_TYPE, LogPanelView } from "./ui/log-panel-view";
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
