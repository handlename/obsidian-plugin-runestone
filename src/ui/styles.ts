const STYLES = `
.runestone-overlay {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 4px 8px;
	background: var(--background-secondary);
	opacity: 0.9;
	font-size: 11px;
	line-height: 1.4;
	border-top: 1px solid var(--background-modifier-border);
	z-index: 10;
	pointer-events: none;
}

.runestone-overlay-stdout {
	font-family: var(--font-monospace);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	color: var(--text-muted);
}

.runestone-log-header {
	padding: 8px 12px;
	border-bottom: 1px solid var(--background-modifier-border);
	font-weight: bold;
}

.runestone-log-progress {
	font-size: 12px;
	color: var(--text-muted);
	font-weight: normal;
}

.runestone-log-entry {
	border-left: 3px solid transparent;
	padding: 4px 8px 4px 12px;
	border-bottom: 1px solid var(--background-modifier-border);
}

.runestone-log-entry-running {
	border-left-color: var(--interactive-accent);
}

.runestone-log-entry-success {
	border-left-color: var(--color-green);
}

.runestone-log-entry-failure {
	border-left-color: var(--color-red);
}

.runestone-log-entry-skipped {
	border-left-color: var(--text-faint);
	opacity: 0.6;
}

.runestone-log-entry-header {
	display: flex;
	align-items: center;
	gap: 6px;
	cursor: pointer;
	user-select: none;
}

.runestone-log-entry-name {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: pointer;
	text-decoration: underline;
	text-decoration-style: dotted;
}

.runestone-log-entry-name:hover {
	color: var(--interactive-accent);
}

.runestone-log-entry-status {
	white-space: nowrap;
	font-size: 12px;
	color: var(--text-muted);
}

.runestone-log-detail {
	padding: 4px 0 4px 20px;
}

.runestone-log-stdout,
.runestone-log-stderr,
.runestone-log-error {
	font-family: var(--font-monospace);
	font-size: 11px;
	white-space: pre-wrap;
	word-break: break-all;
	max-height: 300px;
	overflow-y: auto;
	padding: 4px;
	margin: 4px 0;
	border-radius: 4px;
	background: var(--background-secondary);
}

.runestone-log-stderr {
	color: var(--text-accent);
}

.runestone-log-error {
	color: var(--color-red);
}

.runestone-log-label {
	font-size: 11px;
	font-weight: bold;
	color: var(--text-muted);
	margin-top: 4px;
}
`;

let styleEl: HTMLStyleElement | null = null;

export function injectStyles(): void {
	if (styleEl) return;
	styleEl = document.createElement("style");
	styleEl.textContent = STYLES;
	document.head.appendChild(styleEl);
}

export function removeStyles(): void {
	if (styleEl) {
		styleEl.remove();
		styleEl = null;
	}
}
