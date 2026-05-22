# Migration Guide

This document describes the steps needed to migrate existing Runestone workflows when upgrading between versions.

## v0.4 (argsノードの廃止)

### 概要

`start` ノードの導入により、ワークフローの起点が明確になったため、`args` ノードタイプを完全に廃止しました。

### 破壊的変更

1. **`args` ノードの廃止**: `runestone.type: args` を指定したノートは、ワークフローエンジンから認識されなくなりました。バリデーション時にエラーとなるか、無視されます。
2. **互換性の維持**: 歴史的に `args` 変数や `{{args.key}}` テンプレートを使用しているスクリプトやコマンドの破壊を防ぐため、実行時の `args` パラメータおよびテンプレートの解決結果は、空のオブジェクト `{}` として維持されます。これにより、`ReferenceError` などのランタイムエラーの発生を防止します。

### 移行ステップ

既存の `args` ノードを Canvas から削除してください。これまで `args` ノードから提供していた設定パラメータや静的データは、以下の方法で代替できます。

- **script ノード内での直接定義**:
  ```js
  // 移行前: const items = args.items;
  // 移行後: 直接スクリプト内に定義
  const items = ["Option A", "Option B", "Option C"];
  ```
- **script ノードに定数定義用ノードとしての役割を持たせる**:
  パラメータを定義して出力する `script` ノードを `start` ノードの直後に配置し、後続のノードで `{{input[n]}}` を介して参照します。

---

## v0.3

### Overview

v0.3 introduces explicit **start** and **end** node markers as Canvas text nodes (`runestone:start` and `runestone:end`). The previous implicit rule — "the node with no incoming edges is the start node" — is removed. This is a breaking change: existing workflows will fail pre-execution validation until they are updated.

The new markers enable lightweight partial-execution debugging: move the `runestone:start` text node's outgoing edge to redirect the workflow entry point without deleting or re-adding nodes.

### Breaking Changes

1. **Start node identification is now explicit.** Every workflow must contain exactly one Canvas text node whose trimmed content equals `runestone:start`. Workflows that relied on the implicit "no incoming edges" rule will be rejected with a validation error.
2. **`args` nodes no longer satisfy the start-node requirement.** Previously, `args` nodes with no incoming edges coexisted alongside an implicit start node. They still run in parallel with the start node, but they no longer count as candidates for the start node itself.
3. **New `end` node markers (optional).** Reaching any `runestone:end` text node halts the entire workflow gracefully — useful for debugging partial flows. Workflows without end markers behave as before (execution continues until every reachable branch terminates).

### Migration Steps

For every existing workflow `.canvas` file:

1. Open the Canvas in Obsidian.
2. Add a new **text node** to the canvas.
3. Set its content to exactly `runestone:start` (no extra characters or whitespace).
4. Draw an edge from this text node to the node that should be the entry point (typically the node that had no incoming edges in v0.2).
5. Save the file and run the workflow to confirm it executes from the new start marker.

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
