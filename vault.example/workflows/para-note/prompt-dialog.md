---
runestone.type: script
---

```javascript
// config: { title, placeholder } passed from upstream config script node
const config = input.find(x => x.title) || {};
return new Promise((resolve) => {
  const modal = new obsidian.Modal(app);
  modal.titleEl.setText(config.title || "Enter value");

  const inputEl = modal.contentEl.createEl("input", {
    type: "text",
    placeholder: config.placeholder || "",
  });
  inputEl.style.width = "100%";

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      modal.close();
      resolve({ value: inputEl.value });
    }
  });

  modal.onClose = () => resolve({ value: inputEl.value });
  modal.open();
  inputEl.focus();
});
```
