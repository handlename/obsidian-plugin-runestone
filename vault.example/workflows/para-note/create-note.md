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

// Step 1: Create the note with real frontmatter values.
// These values will be available to the template body via tp.frontmatter.*.
const now = new Date().toISOString();
const frontmatter = [
  "---",
  `title: "${title}"`,
  `para: "${paraType}"`,
  `created_at: "${now}"`,
  "---",
].join("\n");

// Step 2: Read the template file and extract the body (after frontmatter).
// The template's frontmatter is a schema definition; the Runestone script
// sets the actual values in step 1. Only the body is appended to the note.
const templateFile = app.vault.getAbstractFileByPath(templatePath);
const templateContent = await app.vault.read(templateFile);
const bodyMatch = templateContent.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
const templateBody = bodyMatch ? bodyMatch[1] : templateContent;

// Step 3: Combine real frontmatter + template body and create the file.
const fileContent = frontmatter + "\n" + templateBody;
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
// in the body. tp.frontmatter.* reads from the real values set in step 1.
const templaterPlugin = app.plugins.plugins["templater-obsidian"];
await templaterPlugin.templater.overwrite_file_commands(file);

return { path: targetPath };
```
