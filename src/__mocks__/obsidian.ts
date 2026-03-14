export class App {
	vault = { getAbstractFileByPath: () => null, read: async () => "", adapter: { basePath: "/tmp" } };
	workspace = { getActiveFile: () => null, getActiveViewOfType: () => null, activeLeaf: null };
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
