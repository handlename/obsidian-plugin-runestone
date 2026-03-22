---
runestone.type: script
---

```javascript
// args.title: dialog title text
// args.placeholder: input placeholder text
return new Promise((resolve) => {
  const modal = new obsidian.Modal(app);
  modal.titleEl.setText(args.title);

  const input = modal.contentEl.createEl("input", {
    type: "text",
    placeholder: args.placeholder || "",
  });
  input.style.width = "100%";

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      modal.close();
      resolve({ value: input.value });
    }
  });

  modal.onClose = () => resolve({ value: input.value });
  modal.open();
  input.focus();
});
```
