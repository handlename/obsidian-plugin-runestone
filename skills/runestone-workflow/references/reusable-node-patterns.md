# Reusable Node Patterns

This document describes design patterns for building reusable nodes that can be shared across multiple Runestone workflows.

## Concept

A single `.md` file can be referenced from multiple canvas nodes. By injecting configuration through args nodes, the same script node can behave differently in each context. This avoids duplicating logic across workflows.

## Key Patterns

### Parameterized Output Key (`args.key`)

Reusable nodes should not hardcode output field names. Instead, accept an output key name via `args.key` (or similar parameter) so the caller controls which field the result is stored under.

```js
// args node: configure the output key
return { key: "title" };
```

```js
// script node: use args.key to set the output field name
const value = /* ... compute result ... */;
return { ...(input[0] || {}), [args.key]: value };
```

### Input Accumulation

When chaining multiple reusable nodes in sequence, each node must preserve upstream data. Without this, earlier values are lost. Use the spread pattern to merge previous input with the new value:

```js
return { ...(input[0] || {}), [args.key]: value };
```

This ensures that a pipeline of reusable nodes accumulates all collected values into a single object passed downstream.

### Vault-Side Placement

Separate reusable nodes from workflow-specific files. A recommended vault directory structure:

```
workflows/
  my-workflow/
    my-workflow.canvas
    start.md
    finish.md
nodes/
  prompt-dialog.md
  suggest-dialog.md
```

Reusable nodes live in `nodes/` (or a similar shared directory), while workflow-specific nodes stay inside their workflow directory. This makes it clear which nodes are shared and which are local.

## Example

The [para-note workflow](https://github.com/handlename/obsidian-plugin-runestone/tree/main/vault.example/workflows/para-note) demonstrates these patterns. It uses `prompt-dialog` and `suggest-dialog` script nodes with args nodes that inject configuration (dialog title, placeholder text, selectable items). The args.key pattern allows the same dialog node to store its result under different field names depending on the workflow context.
