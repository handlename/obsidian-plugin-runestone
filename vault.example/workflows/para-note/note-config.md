---
runestone.type: args
---

```js
// Common frontmatter applied to all notes created by this workflow.
// Templater expressions (<% %>) in values are resolved after file creation.
return {
  commonFrontmatter: {
    author: "handlename",
    tags: ["<% tp.date.now('YYYY') %>"],
  },
};
```
