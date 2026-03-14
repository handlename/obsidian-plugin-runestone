import { App, PluginSettingTab, Setting } from "obsidian";
import type RunestonePlugin from "./main";

export interface RunestoneSettings {
	readonly defaultWorkdir: string;
	readonly defaultShell: string;
	readonly maxCycleIterations: number;
}

export const DEFAULT_SETTINGS: RunestoneSettings = {
	defaultWorkdir: "",
	defaultShell: "",
	maxCycleIterations: 1000,
};

export class RunestoneSettingTab extends PluginSettingTab {
	plugin: RunestonePlugin;

	constructor(app: App, plugin: RunestonePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Default working directory")
			.setDesc("Default working directory for exec nodes. Leave empty to use the vault root.")
			.addText((text) =>
				text
					.setPlaceholder("(vault root)")
					.setValue(this.plugin.settings.defaultWorkdir)
					.onChange(async (value) => {
						this.plugin.settings = { ...this.plugin.settings, defaultWorkdir: value };
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Default shell")
			.setDesc("Default shell for exec nodes. Leave empty to use the OS default.")
			.addText((text) =>
				text
					.setPlaceholder("(OS default)")
					.setValue(this.plugin.settings.defaultShell)
					.onChange(async (value) => {
						this.plugin.settings = { ...this.plugin.settings, defaultShell: value };
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Maximum cycle iterations")
			.setDesc("Maximum number of times a node can execute in a single workflow run.")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.maxCycleIterations))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						if (!isNaN(parsed) && parsed > 0) {
							this.plugin.settings = { ...this.plugin.settings, maxCycleIterations: parsed };
							await this.plugin.saveSettings();
						}
					}),
			);
	}
}
