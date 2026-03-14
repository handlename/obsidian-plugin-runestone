import { App, Modal, Notice, Setting } from "obsidian";

const INVALID_CHARS = /[/\\:*?"<>|]/;

export function sanitizeFileName(input: string): string {
	const trimmed = input.trim();
	if (trimmed.length === 0) return "";
	if (INVALID_CHARS.test(trimmed)) return "";
	return trimmed;
}

export async function createNewWorkflow(app: App): Promise<void> {
	const name = await promptWorkflowName(app);
	if (!name) return;

	const activeFile = app.workspace.getActiveFile();
	const folder = activeFile?.parent?.path ?? "";
	const path = folder ? `${folder}/${name}.canvas` : `${name}.canvas`;

	const existing = app.vault.getAbstractFileByPath(path);
	if (existing) {
		new Notice(`Runestone: File "${path}" already exists`);
		return;
	}

	const content = JSON.stringify({ nodes: [], edges: [] });
	const file = await app.vault.create(path, content);
	const leaf = app.workspace.getLeaf(true);
	await leaf.openFile(file);
}

function promptWorkflowName(app: App): Promise<string | null> {
	return new Promise((resolve) => {
		const modal = new NewWorkflowModal(app, (name) => resolve(name));
		modal.open();
	});
}

class NewWorkflowModal extends Modal {
	private onSubmit: (name: string | null) => void;

	constructor(app: App, onSubmit: (name: string | null) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "New Runestone workflow" });

		let inputValue = "";

		new Setting(contentEl)
			.setName("Workflow name")
			.addText((text) => {
				text.setPlaceholder("my-workflow");
				text.onChange((value: string) => { inputValue = value; });
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						e.preventDefault();
						const name = sanitizeFileName(inputValue);
						if (name) {
							this.close();
							this.onSubmit(name);
						} else {
							new Notice("Runestone: Invalid workflow name");
						}
					}
				});
			});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Create").setCta().onClick(() => {
					const name = sanitizeFileName(inputValue);
					if (name) {
						this.close();
						this.onSubmit(name);
					} else {
						new Notice("Runestone: Invalid workflow name");
					}
				}),
			)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
					this.onSubmit(null);
				}),
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}
