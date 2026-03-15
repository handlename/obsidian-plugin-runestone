# REQUIREMENTS

## Overview

Runestone is an Obsidian plugin. It allows users to build and execute workflows on Canvas.

## Node Types

### REQ-NODE-001: exec Node

- Notes referenced from Canvas are treated as workflow nodes
- Specify `runestone.type: exec` in the note's Frontmatter
- Write the shell command to execute in the note body
- Parse the command's stdout as JSON and pass it as input to the next node
- Error if stdout is not valid JSON

### REQ-NODE-002: script Node

- Specify `runestone.type: script` in the note's Frontmatter
- Write JavaScript in a code block in the note body
- Has access to the Obsidian API (e.g. `app` object, `obsidian` module)
- The return value is passed as JSON input to the next node

### REQ-NODE-003: condition Node

- Specify `runestone.type: condition` in the note's Frontmatter
- Write JavaScript in a code block in the note body
- Has access to the Obsidian API (e.g. `app` object, `obsidian` module)
- Proceed along the output edge whose label matches the return value (string)
- If no labeled edge matches, proceed along the unlabeled edge (default edge) if one exists
- Error if no labeled edge matches and no default edge exists
- Output passes the input through as-is

## Data Flow

### REQ-DATA-001: JSON-Based Data Flow

- Data is passed between nodes as JSON

### REQ-DATA-002: Template Syntax

- Input data can be referenced in Frontmatter values and note body using the `{{input[n].key}}` format
- Even when a node has only one input, it is referenced as `{{input[0]}}`

### REQ-DATA-003: Multiple Inputs

- Inputs to a join node are passed as an Array
- The Array order is determined by the completion order of the input source nodes
- The order may vary between executions

## Workflow Graph

### REQ-GRAPH-001: Canvas JSON Parsing

- Parse `.canvas` file `nodes` and `edges` to build the graph
- Only nodes referencing notes (`type: "file"`) are treated as workflow nodes

### REQ-GRAPH-002: Start Node

- A node with no incoming edges is the start node
- There must be exactly one start node. Multiple start nodes result in an error

### REQ-GRAPH-003: Parallel Execution

- When a node has multiple outgoing edges, the target nodes are executed in parallel

### REQ-GRAPH-004: Join

- When multiple edges point to a single node, execution waits for all input sources to complete or be dismissed
- Edges not selected by a condition node are dismissed and do not block join
- Disabled (nondirectional) edges are excluded from join evaluation

### REQ-GRAPH-006: Edge Disabling

- Nondirectional edges (`fromEnd: "none"` and `toEnd: "none"`) are excluded from the workflow
- Treated as non-existent during validation and execution

### REQ-GRAPH-005: Loops

- Cycles are permitted
- However, a cycle must have an exit edge (via a condition node)

## Validation

### REQ-VALID-001: Pre-Execution Checks

The following are validated before workflow execution:

1. Exactly one start node exists
2. If a cycle exists, there is an exit edge via a condition node
3. Required properties are defined in each node's Frontmatter
4. Template syntax references are valid (e.g. `input` is not referenced in a node with no inputs)
5. Condition nodes have at least one labeled output edge and at most one unlabeled (default) output edge
6. Condition nodes contain a JavaScript code block in the note body
7. Disabled (nondirectional) edges are excluded before validation (filtered during graph construction)

## Execution Triggers

### REQ-TRIGGER-001: Command Palette Execution

- Execute "Runestone: Run current canvas" command while a Canvas is open

### REQ-TRIGGER-002: Canvas UI Button

- Display a workflow execution button on the Canvas view

### REQ-TRIGGER-003: Node Context Menu Execution

- Right-click any node to partially execute the workflow starting from that node

### REQ-TRIGGER-004: Registered Workflow Direct Execution

- Register Canvas files as workflows in the plugin settings
- Registered workflows can be executed directly from the command palette as "Runestone: Run \<workflow name\>"
- Execution is possible without the Canvas being open

### REQ-TRIGGER-005: New Workflow Creation

- Create a new Runestone Canvas with the "Runestone: New workflow" command

## External Command Execution Environment

### REQ-EXEC-001: Execution Environment Configuration

- The execution environment for external commands can be specified in Frontmatter
  - `runestone.exec.workdir`: Working directory. Template syntax can be used
  - `runestone.exec.shell`: Shell to use
  - `runestone.exec.env.*`: Additional environment variables. Merged with existing environment variables. Template syntax can be used

### REQ-EXEC-002: Default Execution Environment

- Default values when not specified:
  - Working directory: Vault root directory
  - Shell: OS default
- Default values can be changed in the plugin settings

## Error Handling

### REQ-ERROR-001: Default Error Behavior

- When a node errors, the entire workflow stops by default

### REQ-ERROR-002: Per-Node Error Behavior Configuration

- Specifying `runestone.onError: continue` in Frontmatter causes only the downstream of that node to stop, while other parallel paths continue

## Execution Status Display

### REQ-UI-001: Canvas Visualization

- When the Canvas is open, use the Canvas API to change node appearance
  - Pending: Default appearance
  - Running: Color change (e.g. blue)
  - Success: Color change (e.g. green)
  - Failure: Color change (e.g. red)
  - Skipped (not executed due to upstream error): Gray

### REQ-UI-002: Log Panel

- Provide a dedicated log view
- Display each node's execution state, stdout, stderr, and execution time
- Clicking a node name opens the corresponding note
- Display overall workflow progress (completed nodes / total nodes)
- Display stack traces and error messages on error

### REQ-UI-003: Obsidian Log Console Output

- Output execution logs to the developer console

### REQ-UI-005: Edge Execution Visualization

- When Canvas is open, completed edges (traversed during execution) change color to green
- Unexecuted and dismissed edges remain unchanged
- Edge colors are reset to default during cleanup after workflow completion

### REQ-UI-004: Notice Notifications

- Display the workflow name on workflow start
- Display a success/failure summary on workflow completion
- Display an error summary on error

## Plugin Settings

### REQ-SETTINGS-001: Workflow Registration

- Manage a list of Canvas file paths and workflow names

### REQ-SETTINGS-002: Default Execution Environment

- Configure the default value for `runestone.exec.workdir`
- Configure the default value for `runestone.exec.shell`

## Architecture

### REQ-ARCH-001: Hybrid Approach

- Workflow structure analysis parses Canvas JSON files directly
- Visual feedback during execution uses the Canvas API
- Workflows can be executed without the Canvas being open
- Visual feedback is provided only when the Canvas is open
