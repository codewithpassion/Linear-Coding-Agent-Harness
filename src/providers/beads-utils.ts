/**
 * Beads CLI Wrapper Utilities
 *
 * Provides type-safe wrappers around the bd CLI tool for Git-native issue tracking.
 * Beads stores issues in .beads/issues.jsonl (committed to Git) with SQLite caching.
 *
 * Reference: ai_docs/beads-plane.md lines 42-86
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

/**
 * Beads issue structure (from bd CLI JSON output)
 *
 * Beads uses hash-based IDs like "bd-a1b2", "bd-f14c3"
 */
export interface BdIssue {
	/** Hash-based issue ID (e.g., "bd-a1b2", "bd-f14c3") */
	id: string;

	/** Issue title/summary */
	title: string;

	/** Current status */
	status: "open" | "in_progress" | "closed";

	/** Priority (1=highest) */
	priority?: number;

	/** Issue type */
	type?: string; // epic, task, bug, feature

	/** Detailed description */
	description?: string;

	/** Creation timestamp */
	created_at?: string;

	/** Last update timestamp */
	updated_at?: string;
}

/**
 * Execute a bd CLI command and return stdout
 *
 * @param args - Command arguments to pass to bd
 * @param cwd - Working directory for command execution
 * @returns Command stdout as string
 * @throws {Error} If command fails or bd binary not found
 */
async function bdCommand(args: string[], cwd: string): Promise<string> {
	try {
		// Use Bun's $ shell API to execute bd command
		// .quiet() suppresses stderr/stdout from appearing in console
		// .cwd() sets the working directory
		const result = await $`bd ${args}`.cwd(cwd).text();
		return result;
	} catch (error) {
		// Provide helpful error if bd binary not found
		if (error instanceof Error && error.message.includes("command not found")) {
			throw new Error(
				"Beads CLI (bd) not found. Install it:\n" +
					"  npm install -g @beads/bd\n" +
					"Or install via Go: go install github.com/beads-os/bd@latest",
			);
		}
		throw error;
	}
}

/**
 * Initialize Beads in a directory
 *
 * Creates .beads/issues.jsonl and .beads/beads.db
 *
 * @param cwd - Directory to initialize Beads in
 */
export async function bdInit(cwd: string): Promise<void> {
	await bdCommand(["init", "--quiet"], cwd);
}

/**
 * List issues with optional status filter
 *
 * @param cwd - Project directory
 * @param status - Optional status filter (open, in_progress, closed)
 * @returns Array of issues
 */
export async function bdList(cwd: string, status?: string): Promise<BdIssue[]> {
	const args = ["list", "--json"];
	if (status) {
		args.push("--status", status);
	}

	const output = await bdCommand(args, cwd);

	// Handle empty output (no issues)
	if (!output.trim()) {
		return [];
	}

	try {
		return JSON.parse(output) as BdIssue[];
	} catch (error) {
		console.error("Failed to parse bd list output:", output);
		throw new Error(`Failed to parse bd list JSON output: ${error}`);
	}
}

/**
 * Get ready issues (no blockers, ready to work on)
 *
 * @param cwd - Project directory
 * @returns Array of issues ready to work on
 */
export async function bdReady(cwd: string): Promise<BdIssue[]> {
	const output = await bdCommand(["ready", "--json"], cwd);

	// Handle empty output (no ready issues)
	if (!output.trim()) {
		return [];
	}

	try {
		return JSON.parse(output) as BdIssue[];
	} catch (error) {
		console.error("Failed to parse bd ready output:", output);
		throw new Error(`Failed to parse bd ready JSON output: ${error}`);
	}
}

/**
 * Create a new issue
 *
 * @param cwd - Project directory
 * @param title - Issue title
 * @param options - Additional issue properties
 * @returns Created issue
 */
export async function bdCreate(
	cwd: string,
	title: string,
	options: {
		type?: string;
		priority?: number;
		description?: string;
	},
): Promise<BdIssue> {
	const args = ["create", title, "--json"];

	if (options.type) {
		args.push("-t", options.type);
	}

	if (options.priority !== undefined) {
		args.push("-p", String(options.priority));
	}

	// Description is typically added after creation via bd update
	// or set via stdin, but for simplicity we'll skip it here

	const output = await bdCommand(args, cwd);

	try {
		return JSON.parse(output) as BdIssue;
	} catch (error) {
		console.error("Failed to parse bd create output:", output);
		throw new Error(`Failed to parse bd create JSON output: ${error}`);
	}
}

/**
 * Update issue status
 *
 * @param cwd - Project directory
 * @param issueId - Issue ID (e.g., "bd-a1b2")
 * @param status - New status (open, in_progress, closed)
 */
export async function bdUpdate(cwd: string, issueId: string, status: string): Promise<void> {
	await bdCommand(["update", issueId, "--status", status, "--json"], cwd);
}

/**
 * Close an issue with reason
 *
 * @param cwd - Project directory
 * @param issueId - Issue ID (e.g., "bd-a1b2")
 * @param reason - Closure reason/summary
 */
export async function bdClose(cwd: string, issueId: string, reason: string): Promise<void> {
	// Note: --reason might need to be quoted in actual usage
	await bdCommand(["close", issueId, "--reason", reason, "--json"], cwd);
}

/**
 * Check if Beads is initialized in a directory
 *
 * @param cwd - Directory to check
 * @returns True if .beads/issues.jsonl exists
 */
export function isBeadsInitialized(cwd: string): boolean {
	const markerPath = join(cwd, ".beads", "issues.jsonl");
	return existsSync(markerPath);
}
