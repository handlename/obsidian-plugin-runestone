---
runestone.type: script
---

```javascript
// args.title: dialog placeholder text
// args.items: array of suggestion strings
// input[0].value: value from the previous prompt-dialog
return new Promise((resolve) => {
  const modal = new (class extends obsidian.SuggestModal {
    getSuggestions(query) {
      return args.items.filter((item) =>
        item.toLowerCase().includes(query.toLowerCase())
      );
    }
    renderSuggestion(item, el) {
      el.setText(item);
    }
    onChooseSuggestion(item) {
      resolve({ title: input[0].value, paraType: item });
    }
  })(app);
  modal.setPlaceholder(args.title);
  modal.open();
});
```
