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

### REQ-NODE-004: args Node

- Specify `runestone.type: args` in the note's Frontmatter
- Write JavaScript in a code block in the note body
- Has access to the Obsidian API (e.g. `app` object, `obsidian` module)
- The return value must be a plain object
- The return value is passed to the connected downstream node as a separate `args` parameter, not as part of `input`
- Multiple args nodes connected to the same target are merged into a single `args` object
- args nodes must not have incoming edges
- args nodes must not connect to other args nodes

### REQ-NODE-005: start Node

- Represented as a Canvas text node (Canvas `type: "text"`)
- The text content, after trimming whitespace, must equal the literal `runestone:start`
- The start node carries no payload (no Frontmatter, no code block) and produces no output
- It is not displayed in the Log Panel
- Its immediate successors receive an empty input
- A workflow must contain exactly one start node (see REQ-GRAPH-002)

### REQ-NODE-006: end Node

- Represented as a Canvas text node (Canvas `type: "text"`)
- The text content, after trimming whitespace, must equal the literal `runestone:end`
- The end node carries no payload and produces no output
- It is not displayed in the Log Panel
- Reaching any end node halts the entire workflow gracefully:
  - No new nodes are scheduled
  - Already in-flight nodes (exec, script, condition, args) are allowed to complete naturally
  - The workflow terminates with status `completed` (not `failed`) once all in-flight nodes settle
- A workflow may contain zero or more end nodes (see REQ-GRAPH-007)

## Data Flow

### REQ-DATA-001: JSON-Based Data Flow

- Data is passed between nodes as JSON

### REQ-DATA-002: Template Syntax

- Input data can be referenced in Frontmatter values and note body using the `{{input[n].key}}` format
- Even when a node has only one input, it is referenced as `{{input[0]}}`
- Args data can be referenced in Frontmatter values and note body using the `{{args.key}}` format
- Args templates are available in exec nodes (command body, `exec.env` values, `exec.workdir`)

### REQ-DATA-003: Multiple Inputs

- Inputs to a join node are passed as an Array
- The Array order is determined by the completion order of the input source nodes
- The order may vary between executions

## Workflow Graph

### REQ-GRAPH-001: Canvas JSON Parsing

- Parse `.canvas` file `nodes` and `edges` to build the graph
- Canvas nodes of `type: "file"` are treated as workflow nodes (exec, script, condition, args)
- Canvas nodes of `type: "text"` are treated as workflow nodes only when their trimmed content equals the literal `runestone:start` or `runestone:end`
- All other Canvas nodes are excluded from the workflow graph

### REQ-GRAPH-002: Start Node

- The unique Canvas text node whose trimmed content equals `runestone:start` is the start node
- A workflow must contain exactly one start node
- Zero start nodes result in a validation error
- Two or more start nodes result in a validation error
- The start node must have no incoming edges and at least one outgoing edge

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

### REQ-GRAPH-007: End Node

- A Canvas text node whose trimmed content equals `runestone:end` is an end node
- A workflow may contain zero or more end nodes
- Each end node must have one or more incoming edges and no outgoing edges
- An isolated end node (no incoming edges) results in a validation error
- Reaching any end node halts the workflow gracefully (see REQ-NODE-006)
- Nodes that are unreachable from the start node (orphans) are silently ignored — they are not executed and do not cause a validation error

## Validation

### REQ-VALID-001: Pre-Execution Checks

The following are validated before workflow execution:

1. Exactly one start node (`runestone:start` text node) exists
2. The start node has no incoming edges
3. The start node has at least one outgoing edge
4. Every end node (`runestone:end` text node) has one or more incoming edges and no outgoing edges
5. If a cycle exists, there is an exit edge via a condition node
6. Required properties are defined in each node's Frontmatter
7. Template syntax references are valid (e.g. `input` is not referenced in a node with no inputs)
8. Condition nodes have at least one labeled output edge and at most one unlabeled (default) output edge
9. Condition nodes contain a JavaScript code block in the note body
10. Disabled (nondirectional) edges are excluded before validation (filtered during graph construction)

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
- Start and end marker text nodes are colored directly by the visualizer (they are not tracked through the Pending/Running/Success/Failure/Skipped lifecycle):
  - `runestone:start`: Running color while the workflow is active, Success color when the workflow finishes
  - `runestone:end` (reached, triggered the halt): Success color
  - `runestone:end` (not reached): Skipped color
- Canvas text nodes that are not start/end markers are not touched by the visualizer

### REQ-UI-002: Log Panel

- Provide a dedicated log view
- Display each node's execution state, output (the structured return value rendered as pretty-printed JSON), stdout, stderr, and execution time
- The `output` section is shown for every node type whenever `output` is defined; it appears in addition to stdout for exec nodes (stdout is the raw text, output is its parsed form)
- Clicking a node name opens the corresponding note
- Display overall workflow progress (completed nodes / total nodes)
- Display stack traces and error messages on error
- Start and end marker text nodes are excluded from the log panel (they have no payload, no execution time, and no output)

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
