# Changelog

## [0.3.0](https://github.com/handlename/obsidian-plugin-runestone/compare/0.2.0...0.3.0) - 2026-05-22

> [!WARNING]
> **Explicit Start Node Requirement**: Workflows now require an explicit `runestone:start` text node on the Canvas to define the entry point. The previous "implicit start" (node with no incoming edges) is no longer supported.

> [!WARNING]
> **Removal of `args` Node Type**: The `args` node type has been completely removed. Workflows containing `args` nodes will now fail validation. Existing scripts referencing `args` variables will still receive an empty object `{}` for backward compatibility, but users should migrate to using `script` nodes for configuration or static data.

- feat: add start/end node markers (v0.3) by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/15
- ci: limit push trigger to main to avoid duplicate runs by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/17
- feat: remove args node type and clean up related resources by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/18

## [0.2.0](https://github.com/handlename/obsidian-plugin-runestone/compare/0.1.0...0.2.0) - 2026-05-16
- feat: publish runestone-workflow as Claude Code plugin by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/5
- fix: add marketplace.json for Claude Code plugin install by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/7
- docs: add missing terms to GLOSSARY.md by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/8
- Refine runestone-workflow agent skill by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/9
- docs: add example vault section and screenshot to README by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/10
- docs: logo by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/11
- feat: add args template support to exec nodes by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/12
- feat: display node output in log panel by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/14

## [0.1.0](https://github.com/handlename/obsidian-plugin-runestone/commits/0.1.0) - 2026-03-31
- chore: preparation for release by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/1
- fix(ci): correct tagpr trigger branch by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/2
- fix: tagpr releaseBranch by @handlename in https://github.com/handlename/obsidian-plugin-runestone/pull/3
