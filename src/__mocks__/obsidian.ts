export class App {
	vault = { getAbstractFileByPath: () => null, read: async () => "", adapter: { basePath: "/tmp" } };
	workspace = {
		getActiveFile: () => null,
		getActiveViewOfType: () => null,
		activeLeaf: null,
		getLeavesOfType: (_type: string) => [],
		getRightLeaf: (_split: boolean) => null,
		revealLeaf: (_leaf: unknown) => {},
		openLinkText: async (_link: string, _source: string) => {},
	};
	metadataCache = { getFileCache: () => null };
}

export class TFile {
	path = "";
	basename = "";
}

export class Notice {
	constructor(public message: string, public duration?: number) {}
}

export class Plugin {
	app = new App();
	loadData = async () => ({});
	saveData = async (_data: unknown) => {};
	addCommand = (_cmd: unknown) => {};
	addSettingTab = (_tab: unknown) => {};
	registerView = (_type: string, _factory: unknown) => {};
}

export class PluginSettingTab {
	containerEl = { empty: () => {} };
	constructor(public app: unknown, public plugin: unknown) {}
	display() {}
}

export class Setting {
	constructor(_el: unknown) {}
	setName(_n: string) { return this; }
	setDesc(_d: string) { return this; }
	addText(_cb: unknown) { return this; }
	addToggle(_cb: unknown) { return this; }
}

export class ItemView {
	app: App;
	contentEl = {
		empty: () => {},
		createDiv: (_opts?: unknown) => ({
			createDiv: (_opts?: unknown) => ({
				createSpan: (_opts?: unknown) => ({ addEventListener: () => {} }),
				createEl: (_tag?: string, _opts?: unknown) => ({}),
				createDiv: (_opts?: unknown) => ({
					createDiv: () => ({}),
					createEl: () => ({}),
				}),
				dataset: {} as Record<string, string>,
			}),
			createSpan: (_opts?: unknown) => ({ addEventListener: () => {} }),
			createEl: (_tag?: string, _opts?: unknown) => ({}),
		}),
	};
	constructor(leaf: unknown) {
		this.app = new App();
	}
	getViewType() { return ""; }
	getDisplayText() { return ""; }
	getIcon() { return ""; }
	async onClose() {}
}

export class WorkspaceLeaf {
	view: unknown = null;
	async setViewState(_state: unknown) {}
}
