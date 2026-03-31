# GLOSSARY

This glossary defines domain-specific terms used in the Runestone Obsidian plugin. It serves as a reference for both developers implementing the plugin and users working with Runestone workflows.

## Node Types

### Workflow Node

A note referenced from a Canvas that acts as a step in a workflow. Must have `runestone.type` defined in Frontmatter. Only Canvas nodes of `type: "file"` are treated as workflow nodes.

### exec Node

Runs a shell command written in the note body. Stdout is parsed as JSON and passed to the next node. Errors if stdout is not valid JSON.

```yaml
---
runestone.type: exec
---
```

### script Node

Runs JavaScript from a code block in the note body. Has access to the Obsidian API (e.g. `app` object). The return value is passed as JSON to the next node.

```yaml
---
runestone.type: script
---
```

### condition Node

Evaluates JavaScript from a code block and routes execution based on the return value. Has access to the Obsidian API. The return value (string) is matched against Edge Labels to determine which outgoing path to follow. Errors if no edge matches the return value and no Default Edge exists. Input data passes through unchanged.

```yaml
---
runestone.type: condition
---
```

### args Node

Executes JavaScript from a code block and provides the result as a separate `args` parameter to connected downstream script/condition nodes. Unlike other node types, the output is not passed via `input`. args nodes must not have incoming edges and cannot connect to other args nodes or exec nodes. When multiple args nodes connect to the same target, their outputs are merged into a single `args` object (key conflicts: last wins with a console warning).

```yaml
---
runestone.type: args
---
```

## Data Flow

### Input Data

JSON data passed between nodes. Each node receives input from its upstream node(s) and produces output for its downstream node(s).

### Template Syntax

`{{input[n].key}}` format for referencing input data in Frontmatter values and note body. Even when a node has only one input, it is referenced with index `[0]`.

```
{{input[0].name}}
{{input[0].result.status}}
```

### Multiple Inputs

When multiple edges converge on a Join node, inputs are delivered as an Array. The array order is determined by the completion order of the input source nodes and may vary between executions.

## Workflow Graph

### Workflow

A directed graph of nodes and edges defined on a Canvas. Represents an executable sequence of operations.

### Edge

A connection between two nodes on the Canvas. Defines the execution order and data flow direction. Edges may have labels.

### Edge Label

A text label on an edge. Used by condition nodes to determine which outgoing path to follow based on the condition's return value.

### Default Edge

An unlabeled outgoing edge of a condition node. Acts as a fallback path when the condition's return value does not match any Edge Label, similar to `default` in a switch statement. A condition node may have at most one Default Edge.

### Nondirectional Edge

An edge with both endpoints set to `"none"` (`fromEnd: "none"`, `toEnd: "none"`). Nondirectional edges are excluded from the workflow entirely — they are filtered out during graph construction and ignored during both validation and execution.

### Start Node

The single node with no incoming edges. Every workflow must have exactly one start node.

### Parallel Execution

When a node has multiple outgoing edges, all target nodes execute concurrently.

### Join

When multiple edges point to a single node, execution waits for all upstream nodes to complete before proceeding.

### Cycle

A loop in the workflow graph. Cycles are permitted, but must include an exit path via a condition node.

## Execution

### Execution Trigger

A mechanism that starts a workflow. Includes: Command Palette command, Canvas UI button, node context menu (partial execution), and registered workflow commands.

### Registered Workflow

A Canvas file registered in plugin settings with a name. Can be executed from the Command Palette as "Runestone: Run \<workflow name\>" without the Canvas being open.

### Partial Execution

Running a workflow starting from a specific node (via right-click context menu) instead of from the start node.

### Execution Environment

Configuration for how external commands run. Includes working directory, shell, and additional environment variables. Defaults to the vault root directory and the OS default shell.

```yaml
---
runestone.type: exec
runestone.exec.workdir: "{{input[0].dir}}"
runestone.exec.shell: /bin/bash
runestone.exec.env.API_KEY: "{{input[0].key}}"
---
```

### Pre-Execution Validation

Checks performed before a workflow runs: exactly one start node exists, cycles have exit edges via a condition node, required Frontmatter properties are defined, template syntax references are valid, condition nodes have at least one labeled output edge and at most one unlabeled (default) edge, and contain a JavaScript code block.

### Node Status

The execution state of a node. One of five states: Pending (not yet started), Running (currently executing), Success (completed successfully), Failure (error occurred), Skipped (not executed due to upstream error).

### Error Behavior

How errors are handled. By default, a node error stops the entire workflow. Setting `runestone.onError: continue` in Frontmatter causes only the downstream path of the failed node to stop while other parallel paths continue.

```yaml
---
runestone.type: exec
runestone.onError: continue
---
```

### Log Panel

A dedicated Runestone view displaying each node's execution state, stdout, stderr, execution time, overall workflow progress, and stack traces/error messages on error. Clicking a node name opens the corresponding note.

## Obsidian Concepts

### Canvas

An Obsidian feature for visual arrangement of notes and connections. Runestone uses `.canvas` files (JSON format with `nodes` and `edges`) to define workflow structure.

### Frontmatter

YAML metadata at the top of an Obsidian note. Runestone uses Frontmatter properties prefixed with `runestone.` to configure node behavior (e.g., `runestone.type`, `runestone.onError`, `runestone.exec.*`).

### Vault

The root directory managed by Obsidian. The default working directory for exec node command execution.

### Notice

An Obsidian notification popup. Runestone uses Notices to announce workflow start and display success/failure summaries on completion.

### Command Palette

Obsidian's command search interface. Runestone registers commands such as "Runestone: Run current canvas" and "Runestone: New workflow".
