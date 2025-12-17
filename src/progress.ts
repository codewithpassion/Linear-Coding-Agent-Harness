/**
 * Progress Tracking Utilities
 * ===========================
 *
 * Functions for tracking and displaying progress of the autonomous coding agent.
 * Progress is tracked via Linear issues, with local state cached in .linear_project.json.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Marker file name for Linear project state
 */
const LINEAR_PROJECT_MARKER = ".linear_project.json";

/**
 * Interface representing the Linear project state stored in .linear_project.json
 */
export interface LinearProjectState {
	/** Whether the Linear project has been initialized */
	initialized: boolean;
	/** ISO 8601 timestamp when the project was created */
	created_at: string;
	/** Linear team ID (e.g., "TEAM-abc123") */
	team_id: string;
	/** Linear project ID (e.g., "PROJECT-xyz789") */
	project_id: string;
	/** Human-readable project name */
	project_name: string;
	/** ID of the META issue used for session handoff */
	meta_issue_id: string;
	/** Total number of issues created during initialization */
	total_issues: number;
	/** Optional notes about the project */
	notes?: string;
}

/**
 * Load the Linear project state from the marker file.
 *
 * @param projectDir - Directory containing .linear_project.json
 * @returns Project state object or null if not initialized or invalid
 *
 * @example
 * ```typescript
 * const state = await loadLinearProjectState("/path/to/project");
 * if (state) {
 *   console.log(`Project: ${state.project_name}`);
 * }
 * ```
 */
export async function loadLinearProjectState(
	projectDir: string,
): Promise<LinearProjectState | null> {
	const markerFile = join(projectDir, LINEAR_PROJECT_MARKER);

	if (!existsSync(markerFile)) {
		return null;
	}

	try {
		const file = Bun.file(markerFile);
		const content = await file.text();
		const data = JSON.parse(content) as LinearProjectState;

		// Validate required fields
		if (
			typeof data.initialized !== "boolean" ||
			typeof data.team_id !== "string" ||
			typeof data.project_id !== "string"
		) {
			return null;
		}

		return data;
	} catch {
		// JSON parse error or IO error
		return null;
	}
}

/**
 * Check if Linear project has been initialized.
 *
 * @param projectDir - Directory to check
 * @returns True if .linear_project.json exists and is valid
 *
 * @example
 * ```typescript
 * const initialized = await isLinearInitialized("/path/to/project");
 * if (!initialized) {
 *   console.log("Running initializer session...");
 * }
 * ```
 */
export async function isLinearInitialized(projectDir: string): Promise<boolean> {
	const state = await loadLinearProjectState(projectDir);
	return state !== null && state.initialized === true;
}

/**
 * Print a formatted header for the session.
 *
 * @param sessionNum - The current session number
 * @param isInitializer - Whether this is an initializer session
 *
 * @example
 * ```typescript
 * printSessionHeader(1, true);  // Prints "SESSION 1: INITIALIZER"
 * printSessionHeader(2, false); // Prints "SESSION 2: CODING AGENT"
 * ```
 */
export function printSessionHeader(sessionNum: number, isInitializer: boolean): void {
	const sessionType = isInitializer ? "INITIALIZER" : "CODING AGENT";

	console.log(`\n${"=".repeat(70)}`);
	console.log(`  SESSION ${sessionNum}: ${sessionType}`);
	console.log("=".repeat(70));
	console.log();
}

/**
 * Print a summary of current progress.
 *
 * Since actual progress is tracked in Linear, this reads the local
 * state file for cached information. The agent updates Linear directly
 * and reports progress in session comments.
 *
 * @param projectDir - Directory containing .linear_project.json
 *
 * @example
 * ```typescript
 * await printProgressSummary("/path/to/project");
 * // Output:
 * // Linear Project Status:
 * //   Total issues created: 50
 * //   META issue ID: ISSUE-meta001
 * //   (Check Linear for current Done/In Progress/Todo counts)
 * ```
 */
export async function printProgressSummary(projectDir: string): Promise<void> {
	const state = await loadLinearProjectState(projectDir);

	if (state === null) {
		console.log("\nProgress: Linear project not yet initialized");
		return;
	}

	const total = state.total_issues ?? 0;
	const metaIssue = state.meta_issue_id ?? "unknown";

	console.log("\nLinear Project Status:");
	console.log(`  Total issues created: ${total}`);
	console.log(`  META issue ID: ${metaIssue}`);
	console.log("  (Check Linear for current Done/In Progress/Todo counts)");
}
