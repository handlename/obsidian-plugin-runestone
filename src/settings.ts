import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type RunestonePlugin from "./main";

export interface WorkflowRegistration {
	readonly canvasPath: string;
	readonly name: string;
}

export interface RunestoneSettings {
	readonly defaultWorkdir: string;
	readonly defaultShell: string;
	readonly maxCycleIterations: number;
	readonly workflows: readonly WorkflowRegistration[];
}

export const DEFAULT_SETTINGS: RunestoneSettings = {
	defaultWorkdir: "",
	defaultShell: "",
	maxCycleIterations: 1000,
	workflows: [],
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
			.setDesc("Default shell for exec nodes. Leave empty to use the system default.")
			.addText((text) =>
				text
					.setPlaceholder("(os default)")
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

		new Setting(containerEl).setName("Registered workflows").setHeading();

		const workflowList = containerEl.createDiv();

		const renderWorkflows = () => {
			workflowList.empty();
			const workflows = [...this.plugin.settings.workflows];

			for (let i = 0; i < workflows.length; i++) {
				const workflow = workflows[i]!;
				new Setting(workflowList)
					.addText((text) =>
						text
							.setPlaceholder("Canvas file path (.canvas)")
							.setValue(workflow.canvasPath)
							.onChange(async (value) => {
								workflows[i] = { ...workflow, canvasPath: value };
								const error = validateWorkflows(workflows);
								if (error) return;
								this.plugin.settings = { ...this.plugin.settings, workflows };
								await this.plugin.saveSettings();
							}),
					)
					.addText((text) =>
						text
							.setPlaceholder("Workflow name")
							.setValue(workflow.name)
							.onChange(async (value) => {
								workflows[i] = { ...workflow, name: value };
								const error = validateWorkflows(workflows);
								if (error) return;
								this.plugin.settings = { ...this.plugin.settings, workflows };
								await this.plugin.saveSettings();
							}),
					)
					.addExtraButton((btn) =>
						btn.setIcon("trash").setTooltip("Remove").onClick(async () => {
							workflows.splice(i, 1);
							this.plugin.settings = { ...this.plugin.settings, workflows };
							await this.plugin.saveSettings();
							renderWorkflows();
							// eslint-disable-next-line obsidianmd/ui/sentence-case -- plugin name
							new Notice("Runestone: Workflow list updated. Reload the plugin to update command palette.");
						}),
					);
			}
		};

		renderWorkflows();

		new Setting(containerEl)
			.addButton((btn) =>
				btn.setButtonText("Add workflow").onClick(async () => {
					const workflows = [...this.plugin.settings.workflows, { canvasPath: "", name: "" }];
					this.plugin.settings = { ...this.plugin.settings, workflows };
					await this.plugin.saveSettings();
					renderWorkflows();
				}),
			);
	}
}

export function validateWorkflows(workflows: readonly WorkflowRegistration[]): string | null {
	for (const wf of workflows) {
		if (wf.name.trim() === "" && wf.canvasPath.trim() !== "") {
			return "Workflow name must not be empty";
		}
		if (wf.canvasPath.trim() !== "" && !wf.canvasPath.endsWith(".canvas")) {
			return `Canvas path "${wf.canvasPath}" must end with .canvas`;
		}
	}

	const names = workflows.map((wf) => wf.name.trim()).filter((n) => n !== "");
	const uniqueNames = new Set(names);
	if (uniqueNames.size !== names.length) {
		return "Workflow names must be unique";
	}

	return null;
}
