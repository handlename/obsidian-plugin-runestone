# Migration Guide

This document describes the steps needed to migrate existing Runestone workflows when upgrading between versions.

## v0.3

### Overview

v0.3 introduces explicit **start** and **end** node markers as Canvas text nodes (`runestone:start` and `runestone:end`). The previous implicit rule — "the node with no incoming edges is the start node" — is removed.

Furthermore, this release **deprecates and completely removes the `args` node type**. With the introduction of the explicit `start` node, the entry points of workflows are now clearly defined, making the `args` node redundant.

These are breaking changes: existing workflows will fail pre-execution validation until they are updated.

The new markers enable lightweight partial-execution debugging: move the `runestone:start` text node's outgoing edge to redirect the workflow entry point without deleting or re-adding nodes.

### Breaking Changes

1. **Start node identification is now explicit.** Every workflow must contain exactly one Canvas text node whose trimmed content equals `runestone:start`. Workflows that relied on the implicit "no incoming edges" rule will be rejected with a validation error.
2. **Complete removal of the `args` Node.** Notes specifying `runestone.type: args` are no longer recognized by the workflow engine and will trigger a pre-execution validation error.
3. **Backward Compatibility for `args` variables.** To prevent existing scripts and command templates referencing `args` variables or `{{args.key}}` template values from throwing immediate runtime errors (such as `ReferenceError`), the executor will still inject an empty object `{}` for the `args` parameter during execution.
4. **New `end` node markers (optional).** Reaching any `runestone:end` text node halts the entire workflow gracefully — useful for debugging partial flows. Workflows without end markers behave as before (execution continues until every reachable branch terminates).

### Migration Steps

For every existing workflow `.canvas` file:

1. **Explicit Start Node**:
   - Open the Canvas in Obsidian.
   - Add a new **text node** to the canvas.
   - Set its content to exactly `runestone:start` (no extra characters or whitespace).
   - Draw an edge from this text node to the node that should be the entry point (typically the node that had no incoming edges in v0.2).
   - Save the file and run the workflow to confirm it executes from the new start marker.
2. **Remove `args` Nodes**:
   - Remove any existing `args` nodes from your Canvas.
   - Refactor parameters or static data previously supplied by `args` nodes using either of the following:
     - **Inline definition in script nodes**:
       ```js
       // Before: const items = args.items;
       // After: Define variables directly inside your script
       const items = ["Option A", "Option B", "Option C"];
       ```
     - **Using a dedicated configuration script node**:
       Place a regular `script` node immediately after the `start` node to output your parameters, and reference them in downstream nodes using the `{{input[n]}}` syntax.

Optionally, add `runestone:end` text nodes with incoming edges from the nodes where you want execution to halt. Multiple end markers are allowed.

### New Features

#### Partial-execution debugging via start redirection

Rather than deleting upstream nodes for debugging, move the `runestone:start` text node's outgoing edge to a later node. Upstream nodes become unreachable and are silently skipped. Restore the original edge when finished.

#### Graceful workflow halt via end markers

Connect any node's outgoing edge to a `runestone:end` text node. When execution reaches that end node, no new nodes are scheduled. In-flight `exec` or `script` nodes are allowed to complete naturally, so their outputs remain available in the Log Panel.

### Examples

#### Before (v0.2)

```
[fetch]  ->  [transform]  ->  [save]
```

`fetch` had no incoming edges, so it was implicitly the start node.

#### After (v0.3)

```
[runestone:start]  ->  [fetch]  ->  [transform]  ->  [save]
```

A `runestone:start` text node is added and explicitly points to `fetch`. To debug from `transform` only, move the edge:

```
[runestone:start]  ->  [transform]  ->  [save]
[fetch]  (orphan, silently skipped)
```

To halt before `save` for debugging:

```
[runestone:start]  ->  [fetch]  ->  [transform]  ->  [runestone:end]
[save]  (orphan, silently skipped)
```

### Canvas Visualization

During execution, the visualizer paints marker text nodes:

| Marker | While running | After completion |
|---|---|---|
| `runestone:start` | Running color | Success color |
| `runestone:end` (reached) | — | Success color |
| `runestone:end` (not reached) | — | Skipped color |
