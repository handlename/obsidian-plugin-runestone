export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds}s`;
}

export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength) + "\u2026";
}

// Returns the pretty-printed JSON form of a node's output value, or null when
// the section should be skipped (output is undefined). `null` values are
// rendered as the literal string "null" so that explicit-null returns remain
// visible in the Log Panel.
export function formatOutput(output: unknown): string | null {
	if (output === undefined) return null;
	return JSON.stringify(output, null, 2);
}
