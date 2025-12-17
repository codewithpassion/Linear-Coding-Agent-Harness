/**
 * Beads Provider Implementation
 *
 * Implements the ProjectManagementProvider interface for Beads Git-native
 * issue tracking. Beads uses CLI commands (bd) instead of MCP servers.
 *
 * Reference: ai_docs/beads-plane.md lines 42-86
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MCPServerConfiguration } from "../client.js";
import { bdList, isBeadsInitialized } from "./beads-utils.js";
import type { ProjectManagementProvider, ProjectState, ProviderType } from "./types.js";

/**
 * Beads Provider Implementation
 *
 * Wraps the bd CLI tool for project management. All operations are local
 * (no network required). Issues are stored in .beads/issues.jsonl and synced via Git.
 */
export class BeadsProvider implements ProjectManagementProvider {
	readonly name: ProviderType = "beads";

	/**
	 * Validate that bd CLI is available
	 *
	 * @throws {Error} If bd binary not found
	 */
	validateEnvironment(): void {
		try {
			// Check if bd binary is available using 'which'
			// This will throw if bd is not found
			const proc = Bun.spawnSync(["which", "bd"], {
				stdout: "pipe",
				stderr: "pipe",
			});

			if (proc.exitCode !== 0 || !proc.stdout.toString().trim()) {
				throw new Error("bd not found");
			}
		} catch {
			throw new Error(
				"Beads CLI (bd) not found. Install it:\n" +
					"  npm install -g @beads/bd\n" +
					"Or via Go: go install github.com/beads-os/bd@latest\n" +
					"Then ensure it's in your PATH.",
			);
		}
	}

	/**
	 * Get MCP server configuration
	 *
	 * Beads uses CLI commands via Bash, not MCP servers
	 *
	 * @returns null (no MCP server needed)
	 */
	getMcpServerConfig(): MCPServerConfiguration | null {
		return null;
	}

	/**
	 * Get required MCP tools
	 *
	 * Beads doesn't use MCP tools - agents call bd via Bash
	 *
	 * @returns Empty array (no MCP tools)
	 */
	getRequiredTools(): string[] {
		return [];
	}

	/**
	 * Get marker file name for Beads projects
	 *
	 * @returns ".beads/issues.jsonl"
	 */
	getMarkerFileName(): string {
		return ".beads/issues.jsonl";
	}

	/**
	 * Check if Beads project has been initialized
	 *
	 * @param projectDir - Absolute path to project directory
	 * @returns True if .beads/issues.jsonl exists
	 */
	isInitialized(projectDir: string): Promise<boolean> {
		return Promise.resolve(isBeadsInitialized(projectDir));
	}

	/**
	 * Load project state from Beads data
	 *
	 * Since Beads doesn't have a central project concept, we construct
	 * the state by querying issues and finding the META issue.
	 *
	 * @param projectDir - Absolute path to project directory
	 * @returns Unified project state or null if not initialized
	 */
	async loadProjectState(projectDir: string): Promise<ProjectState | null> {
		if (!(await this.isInitialized(projectDir))) {
			return null;
		}

		try {
			// Query bd for all issues to get counts and find META
			const allIssues = await bdList(projectDir);

			// Find META issue (title contains "[META]")
			const metaIssue = allIssues.find((i) => i.title.includes("[META]"));

			// Extract project name from directory
			const projectName = projectDir.split("/").pop() || "Unknown Project";

			// Return unified ProjectState
			return {
				initialized: true,
				provider: "beads",
				created_at: new Date().toISOString(), // Beads doesn't track project creation time
				project_id: projectDir, // No explicit project ID in Beads - use directory
				project_name: projectName,
				meta_issue_id: metaIssue?.id || "",
				total_issues: allIssues.length,
				notes: "Beads Git-based project",
				provider_data: {},
			};
		} catch (error) {
			console.error("Failed to load Beads project state:", error);
			return null;
		}
	}

	/**
	 * Get the initializer prompt content
	 *
	 * Loads from prompts/beads/initializer_prompt.md
	 *
	 * @param _browserProvider - Browser automation provider (unused for now)
	 * @returns Promise resolving to prompt content
	 */
	async getInitializerPrompt(_browserProvider?: unknown): Promise<string> {
		// Get the directory of this source file
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		// Go up to project root, then into prompts/beads
		const promptPath = join(__dirname, "..", "..", "prompts", "beads", "initializer_prompt.md");

		const file = Bun.file(promptPath);
		return await file.text();
	}

	/**
	 * Get the coding prompt content
	 *
	 * Loads from prompts/beads/coding_prompt.md
	 *
	 * @param _browserProvider - Browser automation provider (unused for now)
	 * @returns Promise resolving to prompt content
	 */
	async getCodingPrompt(_browserProvider?: unknown): Promise<string> {
		// Get the directory of this source file
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		// Go up to project root, then into prompts/beads
		const promptPath = join(__dirname, "..", "..", "prompts/beads", "coding_prompt.md");

		const file = Bun.file(promptPath);
		return await file.text();
	}

	/**
	 * Print a summary of current Beads project progress
	 *
	 * Queries bd for issue counts by status
	 *
	 * @param projectDir - Absolute path to project directory
	 */
	async printProgressSummary(projectDir: string): Promise<void> {
		try {
			// Query bd for issue counts by status
			const openIssues = await bdList(projectDir, "open");
			const inProgressIssues = await bdList(projectDir, "in_progress");
			const closedIssues = await bdList(projectDir, "closed");

			console.log("\nBeads Project Status:");
			console.log(`  Open issues: ${openIssues.length}`);
			console.log(`  In Progress: ${inProgressIssues.length}`);
			console.log(`  Closed: ${closedIssues.length}`);
		} catch (error) {
			console.log("\nBeads Project Status: Unable to query (bd command failed)");
			console.error(error);
		}
	}
}
