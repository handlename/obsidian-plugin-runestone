import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["src/**/*.test.ts"],
	},
	resolve: {
		alias: {
			obsidian: "./src/__mocks__/obsidian.ts",
		},
	},
});
