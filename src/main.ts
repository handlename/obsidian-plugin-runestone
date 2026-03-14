import { Plugin } from "obsidian";
import { RunestoneSettings, DEFAULT_SETTINGS, RunestoneSettingTab } from "./settings";
import { runCurrentCanvas } from "./commands/run-canvas";

export default class RunestonePlugin extends Plugin {
	settings: RunestoneSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "run-current-canvas",
			name: "Run current canvas",
			callback: () => runCurrentCanvas(this.app, this.settings),
		});

		this.addSettingTab(new RunestoneSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<RunestoneSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
