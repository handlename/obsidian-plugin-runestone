---
runestone.type: script
---

```javascript
// config: { title, items } passed from upstream config script node
const config = input.find(x => x.items) || {};
const previousPrompt = input.find(x => x.value) || {};
return new Promise((resolve) => {
  const modal = new (class extends obsidian.SuggestModal {
    getSuggestions(query) {
      return (config.items || []).filter((item) =>
        item.toLowerCase().includes(query.toLowerCase())
      );
    }
    renderSuggestion(item, el) {
      el.setText(item);
    }
    onChooseSuggestion(item) {
      resolve({ title: previousPrompt.value, paraType: item });
    }
  })(app);
  modal.setPlaceholder(config.title || "Select item");
  modal.open();
});
```
