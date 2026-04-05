---
name: runestone-workflow
description: >
  Create and modify Runestone workflows for Obsidian Canvas.
  Use when the user asks to build, edit, or extend visual workflows
  with exec, script, condition, or args nodes on Obsidian Canvas files.
  Handles .canvas JSON files and node .md files with runestone frontmatter.
triggers:
  - "create a workflow"
  - "runestone workflow"
  - "add a node to the canvas"
  - "build a pipeline on canvas"
  - "make a workflow"
  - "edit workflow"
argument-hint: "[description of the workflow to create or modify]"
compatibility: Requires file system access to an Obsidian vault directory.
metadata:
  author: handlename
  version: "0.2.0"
---

## Overview

Runestone is an Obsidian plugin that turns Canvas files into executable workflow diagrams. Nodes are Markdown files with runestone frontmatter; edges are JSON entries in the `.canvas` file. This skill helps agents create and modify Runestone workflows by generating/editing `.canvas` JSON files and node `.md` files within an Obsidian vault.

## References

Reference documents are in this repository. Read them on demand.

- **`../../README.md`** (relative to this skill) — Full plugin documentation including node types (## Node Types), frontmatter reference, and template syntax
- **`../../GLOSSARY.md`** (relative to this skill) — Domain terminology, graph rules, pre-execution validation rules
- **https://jsoncanvas.org/spec/1.0/** — JSON Canvas format specification
- **`references/workflow-examples.md`** (relative to this skill) — Complete workflow examples
- **`references/reusable-node-patterns.md`** (relative to this skill) — Design patterns for building reusable nodes across workflows

## Runestone-Specific Canvas Notes

Things to know beyond the references:

- Only `file` type canvas nodes are workflow nodes — text, link, and group nodes are ignored by Runestone
- Nondirectional edges (`fromEnd: "none"` + `toEnd: "none"`) are filtered out by Runestone
- Directional edges: omit `fromEnd`/`toEnd` or set `toEnd: "arrow"`. Never set both to `"none"`
- Recommended `fromSide: "right"`, `toSide: "left"` for left-to-right flows
- Recommended minimum node size: width 250, height 60 (suitable when node content does not need to be visible on canvas). When the user wants to inspect node content directly on the canvas, increase the size as appropriate (e.g., 400x400). Ask the user for their preferred size
- Recommended spacing: 300px horizontal, 200px vertical
- Layout convention: left-to-right, top-to-bottom flow
- Node/edge IDs: random lowercase hex string (16 characters)
- Args node code blocks support `await` for asynchronous operations (e.g., `app.vault.read()`) since they are executed via `AsyncFunction`. This is useful for dynamically building candidate lists or reading vault content at execution time
- Prefer placing args nodes above their target script/condition node, connected with `fromSide: "bottom"`, `toSide: "top"`. When layout constraints require it (e.g., args feeding multiple distant nodes), `toSide: "left"` is acceptable. This keeps args connections separate from the main left-to-right flow
- Do not set `color` on canvas nodes — Runestone uses colors for execution status visualization

Minimal canvas JSON skeleton for quick reference:

```json
{
  "nodes": [
    {"id": "a1b2c3d4e5f6a7b8", "type": "file", "file": "path/to/node.md", "x": 0, "y": 0, "width": 250, "height": 60}
  ],
  "edges": [
    {"id": "b2c3d4e5f6a7b8c9", "fromNode": "a1b2c3d4e5f6a7b8", "toNode": "...", "fromSide": "right", "toSide": "left"}
  ]
}
```

## Operations

### Create Workflow

1. Determine node composition from user requirements
2. Create node `.md` files with appropriate frontmatter and code blocks (use templates from `assets/templates/`)
3. Generate `.canvas` JSON with nodes array (file-type entries) and edges array
4. Position nodes following the layout convention (left-to-right, top-to-bottom)
5. Run the validation checklist

### Modify Workflow

1. Read existing `.canvas` JSON to understand current graph structure
2. Read relevant node `.md` files
3. Apply requested changes (add/remove/edit nodes, add/remove edges)
4. Update canvas JSON and write back
5. Run the validation checklist

### Low-Level Operations

| Operation | Steps |
|-----------|-------|
| Add node | Create `.md` file → add file-node entry to canvas `nodes` array (must include `id`, `type: "file"`, `file`, `x`, `y`, `width`, `height`) |
| Remove node | Remove from canvas `nodes` → remove all connected edges → confirm `.md` file deletion with user |
| Add edge | Add entry to canvas `edges` array with `fromNode`/`toNode` and optional `label` |
| Remove edge | Remove entry from canvas `edges` array |
| Edit node body | Modify the code block content in the node `.md` file |
| Edit node config | Modify frontmatter properties in the node `.md` file |

## Validation Checklist

After any operation, verify:

- **Single start node**: exactly one node with no incoming edges
- **Start node templates**: start nodes must not use template syntax (`{{input...}}`)
- **Cycle exit**: every cycle has a condition node with an exit edge leading outside
- **Condition edges**: at least one labeled outgoing edge; at most one unlabeled (default) edge
- **Code block presence**: exec, script, condition, and args nodes must contain a code block
- **Args isolation**: args nodes have no incoming edges; must have at least one outgoing edge; not connected to exec or other args nodes
- **Edge consistency**: all `fromNode`/`toNode` values reference existing node IDs
- **File existence**: all node `file` paths point to existing `.md` files

For detailed validation rules, refer to `../../GLOSSARY.md` (Pre-Execution Validation).

## Template Usage

Copy a template from `assets/templates/`, fill in the code block, and adjust frontmatter as needed.

Available templates:

- `exec-node.md`
- `script-node.md`
- `condition-node.md`
- `args-node.md`
