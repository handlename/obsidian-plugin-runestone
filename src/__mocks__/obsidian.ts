export class App {
	vault = {
		getAbstractFileByPath: () => null,
		read: async () => "",
		adapter: { basePath: "/tmp" },
		create: async (_path: string, _content: string) => new TFile(),
	};
	workspace = {
		getActiveFile: () => null,
		getActiveViewOfType: () => null,
		activeLeaf: null,
		getLeavesOfType: (_type: string) => [],
		getRightLeaf: (_split: boolean) => null,
		revealLeaf: (_leaf: unknown) => {},
		openLinkText: async (_link: string, _source: string) => {},
		getLeaf: (_newLeaf?: boolean) => ({
			openFile: async (_file: unknown) => {},
			setViewState: async (_state: unknown) => {},
			view: null,
		}),
		on: (_event: string, _callback: (...args: unknown[]) => void) => ({}),
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
	registerEvent = (_event: unknown) => {};
}

export class PluginSettingTab {
	containerEl = {
		empty: () => {},
		createEl: (_tag: string, _opts?: unknown) => ({}),
		createDiv: (_opts?: unknown) => ({ empty: () => {} }),
	};
	constructor(public app: unknown, public plugin: unknown) {}
	display() {}
}

export class Setting {
	constructor(_el: unknown) {}
	setName(_n: string) { return this; }
	setDesc(_d: string) { return this; }
	addText(_cb: unknown) { return this; }
	addToggle(_cb: unknown) { return this; }
	addExtraButton(_cb: unknown) { return this; }
	addButton(_cb: unknown) { return this; }
}

export class Modal {
	app: App;
	contentEl = {
		empty: () => {},
		createEl: (_tag: string, _opts?: unknown) => ({}),
		createDiv: (_opts?: unknown) => ({
			empty: () => {},
			createEl: (_tag: string, _opts?: unknown) => ({}),
			createDiv: (_opts?: unknown) => ({}),
		}),
	};
	constructor(app: App) { this.app = app; }
	open() {}
	close() {}
	onOpen() {}
	onClose() {}
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
