import { createInterface } from "readline";
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const rl = createInterface({
	input: process.stdin,
	output: process.stdout,
});

function question(prompt, defaultValue) {
	const displayPrompt = defaultValue
		? `${prompt} (${defaultValue}): `
		: `${prompt}: `;
	return new Promise((resolve) => {
		rl.question(displayPrompt, (answer) => {
			resolve(answer || defaultValue || "");
		});
	});
}

async function main() {
	console.log("Obsidian Plugin Setup");
	console.log("=====================\n");

	const pluginId = await question("Plugin ID (e.g., my-awesome-plugin)");
	if (!pluginId) {
		console.error("Error: Plugin ID is required");
		process.exit(1);
	}

	const pluginName = await question("Plugin Name (e.g., My Awesome Plugin)");
	if (!pluginName) {
		console.error("Error: Plugin Name is required");
		process.exit(1);
	}

	const description = await question("Description");
	const author = await question("Author");
	const authorUrl = await question("Author URL");
	const fundingUrl = await question("Funding URL (leave empty to remove)");

	rl.close();

	// Update manifest.json
	const manifestPath = "manifest.json";
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	manifest.id = pluginId;
	manifest.name = pluginName;
	if (description) manifest.description = description;
	if (author) manifest.author = author;
	if (authorUrl) {
		manifest.authorUrl = authorUrl;
	} else {
		delete manifest.authorUrl;
	}
	if (fundingUrl) {
		manifest.fundingUrl = fundingUrl;
	} else {
		delete manifest.fundingUrl;
	}
	writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
	console.log(`\nUpdated ${manifestPath}`);

	// Update package.json
	const packagePath = "package.json";
	const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
	pkg.name = pluginId;
	if (description) pkg.description = description;
	writeFileSync(packagePath, JSON.stringify(pkg, null, "\t") + "\n");
	console.log(`Updated ${packagePath}`);

	// Update package-lock.json by running npm install
	console.log("\nUpdating package-lock.json...");
	execSync("npm install", { stdio: "inherit" });

	console.log("\nSetup complete!");
	console.log("\n--- Next Steps ---");
	console.log(
		"To enable automated releases with tagpr, configure the GH_PAT secret:",
	);
	console.log(
		"  1. Create a Personal Access Token at https://github.com/settings/tokens",
	);
	console.log("  2. Add it as a repository secret named 'GH_PAT'");
	console.log(
		"     Settings > Secrets and variables > Actions > New repository secret",
	);
}

main();
