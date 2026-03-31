# Runestone Node Types

This document describes the four node types available in Runestone workflows. Each node is a Markdown file with `runestone.*` frontmatter properties and a code block.


### exec

Executes a shell command. The first code block in the note body is run as a shell command. stdout must be valid JSON, which becomes the node output.

````markdown
---
runestone.type: exec
---

```bash
echo '{"message": "hello"}'
```
````

### script

Executes JavaScript asynchronously. Available variables: `app` (Obsidian App instance), `obsidian` (the `obsidian` module, e.g. `Modal`, `Notice`, `SuggestModal`), `input` (array of outputs from upstream nodes), and `args` (object from connected args nodes, empty `{}` if none). The return value becomes the node output.

````markdown
---
runestone.type: script
---

```javascript
const result = input[0].message.toUpperCase();
return { result };
```
````

### condition

Evaluates JavaScript and returns a value that is stringified and matched against outgoing edge labels. Must have at least one labeled outgoing edge. An optional unlabeled edge serves as a default (like `default` in a switch statement) when no label matches. Available variables: `app`, `obsidian`, `input` (same as script), and `args` (object from connected args nodes, empty `{}` if none). The original `input` is passed through to the next node, not the condition's return value. Multiple labeled edges may point to the same target node.

````markdown
---
runestone.type: condition
---

```javascript
return input[0].count > 10 ? "high" : "low";
```
````

Workflows may contain cycles. Every cycle must include a condition node with at least one exit edge leading outside the cycle.

### args

Provides reusable parameters to downstream script/condition nodes. The code block executes JavaScript and must return a plain object. The result is passed as a separate `args` parameter (not via `input`). This enables reusing the same script node with different configurations.

````markdown
---
runestone.type: args
---

```js
return {
  items: ["Option A", "Option B", "Option C"],
  placeholder: "Select an option",
};
```
````

The connected script/condition node receives `args` in addition to `app`, `obsidian`, and `input`:

```js
const items = args.items;
// use items...
```

**Constraints:**
- args nodes must not have incoming edges
- args nodes cannot connect to other args nodes or exec nodes
- Multiple args nodes to the same target are merged (key conflicts: last wins with console warning)

## Frontmatter Reference

All properties use the `runestone.` prefix. Properties without this prefix are ignored.

### Common Properties

| Property | Values | Default | Description |
|---|---|---|---|
| `runestone.type` | `exec`, `script`, `condition`, `args` | (required) | Node type |
| `runestone.onError` | `stop`, `continue` | `stop` | Error handling strategy |

- `stop`: abort the entire workflow and skip all remaining nodes
- `continue`: skip only the downstream nodes of the failed node; other branches continue

### exec-Specific Properties

| Property | Description |
|---|---|
| `runestone.exec.workdir` | Working directory for the command |
| `runestone.exec.shell` | Shell to use (e.g., `/bin/bash`) |
| `runestone.exec.env.<NAME>` | Environment variable (e.g., `runestone.exec.env.API_KEY: "xxx"`) |

All exec-specific properties are optional. Defaults come from plugin settings or system defaults.

## Template Syntax

Nodes can reference outputs from upstream nodes using `{{input[n].property}}`.

- `input` is an array of outputs from all incoming edges
- All expressions must start with `input`
- Supports dot notation and bracket notation: `{{input[0].data.items[1].name}}`
- Multiple templates in one string: `echo '{"a": "{{input[0].x}}", "b": "{{input[1].y}}"}'`
- Strings are passed as-is; numbers and booleans are converted to strings; objects and arrays are converted to JSON

Start nodes (no incoming edges) cannot use template syntax.

