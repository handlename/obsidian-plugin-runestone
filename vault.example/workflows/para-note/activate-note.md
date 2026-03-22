---
runestone.type: script
---

```javascript
const { path } = input[0];
await app.workspace.openLinkText(path, "/", false);
return { path, activated: true };
```
