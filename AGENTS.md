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
      args-runner.ts   # Argument provider for downstream nodes
  graph/
    builder.ts         # Canvas JSON + note frontmatter -> WorkflowGraph
    parser.ts          # Canvas JSON parsing, frontmatter extraction, code block extraction
    validator.ts       # Pre-execution validation (start node, cycles, templates, etc.)
  template/
    template.ts        # {{input[n].key}} template resolution
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

Four node types configured via `runestone.*` frontmatter in notes:

| Type | Purpose | Input | Output |
|------|---------|-------|--------|
| `exec` | Run shell command | `{{input[n]}}` templates in body/frontmatter | stdout parsed as JSON |
| `script` | Run JavaScript | `input`, `args`, `app`, `obsidian` variables | Return value as JSON |
| `condition` | Branch execution | Same as script | Return value matched to edge labels |
| `args` | Provide parameters | None (no incoming edges) | Merged into downstream `args` parameter |

Key execution rules:
- Exactly one start node (no incoming edges).
- Multiple outgoing edges = parallel execution.
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
- When adding a new node type, implement a runner in `engine/node-runners/`, add the type to `RunestoneNodeType`, update parser/validator/executor, and add tests.
- When modifying execution behavior, check against `REQUIREMENTS.md` for formal constraints.
