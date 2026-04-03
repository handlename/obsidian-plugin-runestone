# Runestone

Build and execute workflows on Obsidian Canvas.

Runestone turns canvas files into executable workflow diagrams. Nodes are notes with code blocks, edges define data flow, and execution supports sequential, parallel, conditional branching, and cycles.

## Features

- Execute shell commands or JavaScript from canvas nodes
- Conditional branching with labeled edges
- Parallel execution when nodes have multiple outgoing edges
- Data flow between nodes via template syntax (`{{input[n].property}}`)
- Real-time execution visualization on canvas (status colors and overlays)
- Log panel with per-node stdout/stderr and duration
- Cycle support with configurable iteration limits
- Per-node error handling (stop or continue)

## Getting Started

### Installation

**Using [BRAT](https://github.com/TfTHacker/obsidian42-brat):**

1. Install the BRAT plugin
2. Add `handlename/obsidian-plugin-runestone` as a beta plugin in BRAT settings

**Manual:**

Copy `main.js`, `styles.css`, and `manifest.json` to `<vault>/.obsidian/plugins/runestone/`.

### Creating a Workflow

1. Create a new canvas file (or use the "New workflow" command)
2. Add note nodes to the canvas. Each note needs:
   - Frontmatter with `runestone.type` set to `exec`, `script`, or `condition`
   - A code block containing the command or script to run
3. Connect nodes with edges to define execution order
4. The node with no incoming edges becomes the start node

### Running a Workflow

- Open a canvas and click the play button in the view header
- Or use the command palette: "Run current canvas"
- Or right-click a node: "Runestone: Run from this node" (starts execution from that node)
- Register workflows in settings to add dedicated commands

## Node Types

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

## Settings

| Setting | Description | Default |
|---|---|---|
| Default working directory | Default `cwd` for exec nodes | Vault root |
| Default shell | Default shell for exec nodes | System default |
| Maximum cycle iterations | Prevents infinite loops in cyclic workflows | 1000 |
| Registered workflows | Named workflows with dedicated commands | (none) |

## Claude Code Skill: runestone-workflow

A [Claude Code](https://claude.com/claude-code) skill that helps AI agents create and modify Runestone workflows. When this skill is installed, you can ask Claude Code to build, edit, or extend workflows on Obsidian Canvas using natural language.

### Installation

Run the following commands in Claude Code:

```
/plugin marketplace add https://github.com/handlename/obsidian-plugin-runestone
/plugin install runestone-workflow
```

### Usage

Once the skill is available, you can invoke it from Claude Code with the `/runestone-workflow` command or natural language prompts like:

- `"Create a workflow that fetches an API and filters the results"`
- `"Add a condition node to branch on status code"`
- `"Edit the workflow to add error handling"`

The skill handles `.canvas` JSON files and node `.md` files, following Runestone's layout conventions and validation rules automatically.

## Example Vault

The [`vault.example/`](./vault.example/) directory contains an example Obsidian vault with a sample workflow. You can open it as a vault in Obsidian to try Runestone immediately.

### Included Workflow: para-note

A workflow that creates a new note following the [PARA method](https://fortelabs.com/blog/para/). It demonstrates:

- **Interactive dialogs** — prompt and suggest nodes for user input
- **Conditional branching** — routes to different folders (Projects, Areas, Resources, Archives) based on PARA type
- **Args nodes** — reusable configuration passed to multiple nodes
- **Join execution** — all branches converge to a final activation node

To run: open `workflows/para-note/para-note.canvas` and click the play button.

## Development

```bash
npm install
npm run dev      # Watch mode compilation
npm run build    # Production build
npm run test     # Run tests (vitest)
npm run lint     # Lint with ESLint
```

## License

[MIT](./LICENSE)

## Author

[handlename](https://github.com/handlename/)
