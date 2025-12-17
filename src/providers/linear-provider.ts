/**
 * Linear Provider Implementation
 * ================================
 *
 * Implements the ProjectManagementProvider interface for Linear.app integration.
 * Extracted from the original monolithic implementation to support the strategy pattern.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MCPServerConfiguration } from "../client.js";
import { LINEAR_API_KEY, LINEAR_PROJECT_MARKER, requireLinearApiKey } from "../linear-config.js";
import type { ProjectManagementProvider, ProjectState, ProviderType } from "./types.js";

/**
 * Interface representing the Linear project state stored in .linear_project.json
 */
interface LinearProjectState {
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
 * Linear MCP tools for project management
 * Extracted from src/client.ts:52-71
 */
const LINEAR_TOOLS = [
	"mcp__linear__list_teams",
	"mcp__linear__get_team",
	"mcp__linear__list_projects",
	"mcp__linear__get_project",
	"mcp__linear__create_project",
	"mcp__linear__update_project",
	"mcp__linear__list_issues",
	"mcp__linear__get_issue",
	"mcp__linear__create_issue",
	"mcp__linear__update_issue",
	"mcp__linear__list_my_issues",
	"mcp__linear__list_comments",
	"mcp__linear__create_comment",
	"mcp__linear__list_issue_statuses",
	"mcp__linear__get_issue_status",
	"mcp__linear__list_issue_labels",
	"mcp__linear__list_users",
	"mcp__linear__get_user",
] as const;

/**
 * Linear Provider Implementation
 *
 * Implements all ProjectManagementProvider interface methods for Linear.app.
 * Uses Linear MCP server over HTTP for project and issue management.
 */
export class LinearProvider implements ProjectManagementProvider {
	readonly name: ProviderType = "linear";

	/**
	 * Validate that LINEAR_API_KEY environment variable is set.
	 * Extracted from src/client.ts:120-126
	 *
	 * @throws {Error} If LINEAR_API_KEY is not set
	 */
	validateEnvironment(): void {
		if (!LINEAR_API_KEY) {
			throw new Error(
				"LINEAR_API_KEY environment variable not set.\n" +
					"Get your API key from: https://linear.app/YOUR-TEAM/settings/api",
			);
		}
	}

	/**
	 * Get the Linear MCP server configuration.
	 * Extracted from src/client.ts:166-173
	 *
	 * @returns MCP server configuration for Linear HTTP transport
	 */
	getMcpServerConfig(): MCPServerConfiguration {
		const linearApiKey = requireLinearApiKey();

		return {
			type: "http",
			url: "https://mcp.linear.app/mcp",
			headers: {
				Authorization: `Bearer ${linearApiKey}`,
			},
		};
	}

	/**
	 * Get the list of required Linear MCP tools.
	 * Extracted from src/client.ts:52-71
	 *
	 * @returns Array of Linear MCP tool names
	 */
	getRequiredTools(): string[] {
		return [...LINEAR_TOOLS];
	}

	/**
	 * Get the marker file name for Linear projects.
	 *
	 * @returns The marker file name ".linear_project.json"
	 */
	getMarkerFileName(): string {
		return LINEAR_PROJECT_MARKER;
	}

	/**
	 * Check if Linear project has been initialized.
	 * Extracted from src/progress.ts:97-100
	 *
	 * @param projectDir - Absolute path to project directory
	 * @returns True if .linear_project.json exists and is valid
	 */
	async isInitialized(projectDir: string): Promise<boolean> {
		const state = await this.loadLinearProjectState(projectDir);
		return state !== null && state.initialized === true;
	}

	/**
	 * Load the Linear project state from the marker file.
	 * Extracted from src/progress.ts:53-81
	 *
	 * @param projectDir - Directory containing .linear_project.json
	 * @returns Project state object or null if not initialized or invalid
	 */
	private async loadLinearProjectState(projectDir: string): Promise<LinearProjectState | null> {
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
	 * Load the project state and convert to unified ProjectState format.
	 *
	 * @param projectDir - Absolute path to project directory
	 * @returns Unified project state or null if not initialized
	 */
	async loadProjectState(projectDir: string): Promise<ProjectState | null> {
		const linearState = await this.loadLinearProjectState(projectDir);

		if (linearState === null) {
			return null;
		}

		// Convert Linear-specific state to unified ProjectState
		const projectState: ProjectState = {
			initialized: linearState.initialized,
			provider: "linear",
			created_at: linearState.created_at,
			project_id: linearState.project_id,
			project_name: linearState.project_name,
			meta_issue_id: linearState.meta_issue_id,
			total_issues: linearState.total_issues,
			provider_data: {
				team_id: linearState.team_id,
			},
		};

		// Add notes only if it exists (exactOptionalPropertyTypes requires this)
		if (linearState.notes !== undefined) {
			projectState.notes = linearState.notes;
		}

		return projectState;
	}

	/**
	 * Get the initializer prompt content.
	 * Loaded from prompts/linear/initializer_prompt.md
	 *
	 * @returns Promise resolving to prompt content
	 */
	async getInitializerPrompt(): Promise<string> {
		// Get the directory of this source file
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		// Go up to project root, then into prompts/linear
		const promptPath = join(__dirname, "..", "..", "prompts", "linear", "initializer_prompt.md");

		const file = Bun.file(promptPath);
		return await file.text();
	}

	/**
	 * Get the coding prompt content.
	 * Loaded from prompts/linear/coding_prompt.md
	 *
	 * @returns Promise resolving to prompt content
	 */
	async getCodingPrompt(): Promise<string> {
		// Get the directory of this source file
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		// Go up to project root, then into prompts/linear
		const promptPath = join(__dirname, "..", "..", "prompts", "linear", "coding_prompt.md");

		const file = Bun.file(promptPath);
		return await file.text();
	}

	/**
	 * Print a summary of current Linear project progress.
	 * Extracted from src/progress.ts:142-157
	 *
	 * Since actual progress is tracked in Linear, this reads the local
	 * state file for cached information. The agent updates Linear directly
	 * and reports progress in session comments.
	 *
	 * @param projectDir - Absolute path to project directory
	 */
	async printProgressSummary(projectDir: string): Promise<void> {
		const state = await this.loadLinearProjectState(projectDir);

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
}
