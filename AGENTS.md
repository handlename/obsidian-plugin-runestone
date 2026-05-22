# Runestone

Obsidian plugin for building and executing workflows on Canvas. Desktop only (`isDesktopOnly: true`).

## Architecture

```
src/
  main.ts              # Plugin lifecycle, command/UI registration
  settings.ts          # RunestoneSettings interface, defaults, settings tab
  types.ts             # All TypeScript interfaces (Canvas, Workflow, Node, Result types)
  engine/
    executor.ts        # Workflow execution orchestrator (parallel, join, cycles)
    node-runners/
      exec-runner.ts   # Shell command execution, stdout JSON parsing
      script-runner.ts # JavaScript execution via AsyncFunction
      condition-runner.ts  # Conditional branching by return value
  graph/
    builder.ts         # Canvas JSON + note frontmatter -> WorkflowGraph
    parser.ts          # Canvas JSON parsing, frontmatter extraction, code block extraction
    validator.ts       # Pre-execution validation (start node, cycles, templates, etc.)
  template/
    template.ts        # {{input[n].key}} and {{args.key}} template resolution
  ui/
    canvas-visualizer.ts  # Real-time node/edge color updates on Canvas
    execution-state.ts    # Node status and result tracking
    log-panel-view.ts     # Dedicated log view with per-node details
    format.ts             # Duration formatting, text truncation
    styles.ts             # Dynamic CSS injection
  commands/
    run-canvas.ts      # Workflow execution orchestration (build, validate, execute, visualize)
    new-workflow.ts     # Canvas template creation
  __mocks__/
    obsidian.ts        # Obsidian API mock for vitest
```

## Domain concepts

Five node types. Three are file-backed notes configured via `runestone.*` frontmatter; two are Canvas text nodes used as payloadless markers:

| Type | Canvas form | Purpose | Input | Output |
|------|-------------|---------|-------|--------|
| `exec` | file note | Run shell command | `{{input[n]}}` and `{{args.key}}` templates in body/frontmatter | stdout parsed as JSON |
| `script` | file note | Run JavaScript | `input`, `args`, `app`, `obsidian` variables | Return value as JSON |
| `condition` | file note | Branch execution | Same as script | Return value matched to edge labels |
| `start` | text node `runestone:start` | Mark workflow entry point | None | Empty input to successors |
| `end` | text node `runestone:end` | Mark workflow halt point | Any | None (triggers graceful halt) |

Key execution rules:
- Exactly one `runestone:start` text node per workflow (no incoming edges, ≥1 outgoing edge).
- Zero or more `runestone:end` text nodes (≥1 incoming edge, no outgoing edges). Reaching any end node halts the workflow gracefully — new scheduling stops, in-flight nodes complete naturally, status becomes `completed`.
- Nodes unreachable from the start node (orphans) are silently ignored (no validation error). This enables partial-execution debugging by moving the start marker.
- Multiple outgoing edges = parallel execution (applies to the start node too).
- Multiple incoming edges = join (wait for all).
- Cycles allowed but require condition node with exit edge.
- Nondirectional edges (`fromEnd: "none"`, `toEnd: "none"`) are excluded.
- `runestone.onError: stop` (default) halts workflow; `continue` skips only the failed path.

## Testing

- Framework: vitest (`vitest.config.ts`).
- Run: `npm test` (single run) or `npm run test:watch`.
- Obsidian API is mocked via `src/__mocks__/obsidian.ts`.
- Test files are colocated: `foo.ts` / `foo.test.ts`.

## Linting

- ESLint with `typescript-eslint` and `eslint-plugin-obsidianmd`.
- Run: `npm run lint`.

## CI

- `.github/workflows/lint.yml`: build + lint on push/PR (Node 20.x, 22.x).
- `.github/workflows/tagpr.yml`: automated release tagging.

## Key reference documents

- `REQUIREMENTS.md`: Formal requirements (REQ-NODE-*, REQ-DATA-*, REQ-GRAPH-*, etc.).
- `GLOSSARY.md`: Domain terminology definitions.
- `README.md`: User-facing documentation and usage guide.

## Agent guidelines

- This plugin is desktop only. It executes shell commands via `child_process`. No mobile support.
- Types in `types.ts` use `readonly` extensively. Maintain immutability.
- Console logging uses `[Runestone]` prefix.
- Canvas visualization uses Obsidian color codes: 0=skip, 2=fail, 4=success, 5=running.
- When adding a new node type, implement a runner in `engine/node-runners/`, add the type to `RunestoneNodeType`, update parser/validator/executor, and add tests. Payloadless markers (`start`, `end`) are an exception: they have no runner and are handled directly in the executor and parser.
- Start and end markers are stored as a separate `MarkerNode` type (not `WorkflowNode`). Use the `isMarkerNode` / `isWorkflowNode` type guards in `types.ts` when iterating `ParsedGraph.nodes`. Marker nodes are excluded from `ExecutionState.entries` and from the Log Panel.
- When modifying execution behavior, check against `REQUIREMENTS.md` for formal constraints.
