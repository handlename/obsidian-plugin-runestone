import { exec } from "child_process";
import { NodeResult, WorkflowNode } from "../../types";
import { resolveTemplates } from "../../template/template";

export interface ExecContext {
	readonly vaultPath: string;
	readonly defaultWorkdir?: string;
	readonly defaultShell?: string;
}

export async function runExecNode(
	node: WorkflowNode,
	input: readonly unknown[],
	context: ExecContext,
): Promise<NodeResult> {
	const startTime = Date.now();
	try {
		const command = resolveTemplates(node.body.trim(), input);

		const workdir = resolveOptional(node.config.exec?.workdir, input)
			?? context.defaultWorkdir
			?? context.vaultPath;

		const shell = node.config.exec?.shell ?? context.defaultShell ?? undefined;

		const env = buildEnv(node, input);

		const { stdout, stderr } = await execAsync(command, { cwd: workdir, shell, env });

		let output: unknown;
		try {
			output = JSON.parse(stdout);
		} catch {
			return {
				nodeId: node.id,
				status: "failure",
				error: `Failed to parse stdout as JSON: ${stdout.slice(0, 200)}`,
				stdout,
				stderr,
				durationMs: Date.now() - startTime,
			};
		}

		return {
			nodeId: node.id,
			status: "success",
			output,
			stdout,
			stderr,
			durationMs: Date.now() - startTime,
		};
	} catch (e) {
		const err = e as Error & { stdout?: string; stderr?: string };
		return {
			nodeId: node.id,
			status: "failure",
			error: err.message ?? String(e),
			stdout: err.stdout,
			stderr: err.stderr,
			durationMs: Date.now() - startTime,
		};
	}
}

function resolveOptional(template: string | undefined, input: readonly unknown[]): string | undefined {
	if (!template) return undefined;
	return resolveTemplates(template, input);
}

function buildEnv(
	node: WorkflowNode,
	input: readonly unknown[],
): Record<string, string> {
	// eslint-disable-next-line no-undef
	const env = { ...process.env } as Record<string, string>;
	if (node.config.exec?.env) {
		for (const [key, value] of Object.entries(node.config.exec.env)) {
			env[key] = resolveTemplates(value, input);
		}
	}
	return env;
}

function execAsync(
	command: string,
	options: { cwd?: string; shell?: string; env?: Record<string, string> },
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		exec(command, options, (error, stdout, stderr) => {
			if (error) {
				reject(Object.assign(error, { stdout, stderr }));
			} else {
				resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
			}
		});
	});
}
