---
runestone.type: script
---

```javascript
const { path } = input[0];
await app.workspace.openLinkText(path, "/", true);
return { path, activated: true };
```
