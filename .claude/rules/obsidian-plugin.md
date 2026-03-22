# Obsidian Plugin Development Rules

## Build & tooling

- Package manager: npm.
- Bundler: esbuild. Config in `esbuild.config.mjs`.
- TypeScript with `"strict": true`. Target: ES6, Module: ESNext.
- Bundle everything into `main.js` (CommonJS). No unbundled runtime dependencies.
- Release artifacts at project root: `main.js`, `manifest.json`, `styles.css`.

## Manifest (`manifest.json`)

- `id` is stable API. Never change after release.
- `version` follows SemVer (`x.y.z`).
- Keep `minAppVersion` accurate when using newer Obsidian APIs.
- Canonical validation: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Versioning & releases

- Bump `version` in `manifest.json` and update `versions.json` (maps plugin version to minimum app version).
- GitHub release tag must exactly match `manifest.json` version. No leading `v`.
- Attach `manifest.json`, `main.js`, `styles.css` to release.

## Security, privacy, compliance

Follow Obsidian's Developer Policies and Plugin Guidelines:

- Default to local/offline operation.
- No hidden telemetry. Explicit opt-in required for any external services.
- Never execute remote code or auto-update outside normal releases.
- Read/write only what's necessary inside the vault.
- Register and clean up all DOM, app, and interval listeners using `register*` helpers.

## Performance

- Keep `onload` light. Defer heavy work with lazy initialization.
- Batch disk access. Avoid excessive vault scans.
- Debounce/throttle expensive operations on file system events.

## UX & copy

- Sentence case for headings, buttons, titles.
- **Bold** for literal UI labels. "Select" for interactions.
- Arrow notation for navigation: **Settings -> Community plugins**.

## Coding conventions

- Keep `main.ts` minimal: lifecycle only (onload, onunload, addCommand). Delegate to modules.
- Split files exceeding ~200-300 lines.
- Single responsibility per file.
- `async/await` over promise chains.
- Stable command IDs. Never rename after release.
- Use `this.register*` helpers for everything needing cleanup.

## References

- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
