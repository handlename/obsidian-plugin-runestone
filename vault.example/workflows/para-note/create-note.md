---
runestone.type: script
---

```javascript
const { title, paraType } = input[0];
const templatePath = `templates/para-${paraType.toLowerCase()}.md`;
const targetPath = `${paraType}/${title}.md`;

const targetDir = paraType;
if (!app.vault.getAbstractFileByPath(targetDir)) {
  await app.vault.createFolder(targetDir);
}

// Step 1: Read the template file and parse its frontmatter and body.
// Template frontmatter can define type-specific keys (e.g., project_status)
// that are preserved in the created note.
const templateFile = app.vault.getAbstractFileByPath(templatePath);
const templateContent = await app.vault.read(templateFile);
const fmMatch = templateContent.match(/^---\n([\s\S]*?)\n---\s*([\s\S]*)$/);
const templateFrontmatter = {};
if (fmMatch) {
  for (const line of fmMatch[1].split("\n")) {
    if (line.startsWith("#") || !line.includes(":")) continue;
    const idx = line.indexOf(":");
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && val) templateFrontmatter[key] = val;
  }
}
const templateBody = fmMatch ? fmMatch[2] : templateContent;

// Step 2: Build merged frontmatter.
// Merge order (later wins): template defaults → args common → computed values.
// - Template frontmatter: type-specific keys defined in the template file
// - args.commonFrontmatter: shared keys injected via note-config args node
// - Computed values: title, para, created_at set by this script
const merged = {
  ...templateFrontmatter,
  ...(args.commonFrontmatter || {}),
  title: `"${title}"`,
  para: `"${paraType}"`,
  created_at: `"${new Date().toISOString()}"`,
};

// Step 3: Serialize frontmatter and combine with template body.
// Values may contain Templater expressions (<% %>) which are resolved in step 5.
const fmLines = Object.entries(merged).map(([k, v]) => `${k}: ${v}`);
const fileContent = "---\n" + fmLines.join("\n") + "\n---\n" + templateBody;
const file = await app.vault.create(targetPath, fileContent);

// Step 4: Wait for Obsidian's metadata cache to index the new file.
// Without this, tp.frontmatter.* returns undefined because the cache
// hasn't processed the frontmatter yet.
await new Promise((resolve) => {
  const ref = app.metadataCache.on("changed", (changedFile) => {
    if (changedFile.path === file.path) {
      app.metadataCache.offref(ref);
      resolve();
    }
  });
});

// Step 5: Run Templater on the created file to resolve <% %> expressions
// in both frontmatter values and body.
const templaterPlugin = app.plugins.plugins["templater-obsidian"];
await templaterPlugin.templater.overwrite_file_commands(file);

return { path: targetPath };
```
