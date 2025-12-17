/**
 * Plane.so Provider Implementation
 * ==================================
 *
 * Implements the ProjectManagementProvider interface for Plane.so integration.
 * Uses Plane's REST API directly (no MCP server) for project and work item management.
 *
 * Reference: ai_docs/beads-plane.md lines 86-150
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MCPServerConfiguration } from "../client.js";
import { loadConfig } from "../config.js";
import { PlaneApiClient } from "./plane-client.js";
import type { ProjectManagementProvider, ProjectState, ProviderType } from "./types.js";

/**
 * Interface representing the Plane project state stored in .plane_project.json
 */
interface PlaneProjectState {
	/** Whether the Plane project has been initialized */
	initialized: boolean;
	/** ISO 8601 timestamp when the project was created */
	created_at: string;
	/** Plane workspace slug */
	workspace_slug: string;
	/** Plane project ID (UUID) */
	project_id: string;
	/** Human-readable project name */
	project_name: string;
	/** ID of the META work item used for session handoff */
	meta_issue_id: string;
	/** Total number of work items created during initialization */
	total_issues: number;
	/** Optional notes about the project */
	notes?: string;
}

/**
 * Plane Provider Implementation
 *
 * Implements all ProjectManagementProvider interface methods for Plane.so.
 * Uses Plane's REST API directly via the PlaneApiClient.
 */
export class PlaneProvider implements ProjectManagementProvider {
	readonly name: ProviderType = "plane";
	private client: PlaneApiClient | null = null;

	/**
	 * Get or create Plane API client
	 *
	 * @param projectDir - Project directory (for loading config)
	 * @returns Configured PlaneApiClient instance
	 */
	private async getClient(projectDir: string): Promise<PlaneApiClient> {
		if (this.client) {
			return this.client;
		}

		// Get API key from environment
		const apiKey = process.env["PLANE_API_KEY"];
		if (!apiKey) {
			throw new Error("PLANE_API_KEY environment variable not set");
		}

		// Load workspace slug and base URL from config or state
		const config = await loadConfig(projectDir);
		let workspaceSlug = config?.plane?.workspaceSlug;
		const baseUrl = config?.plane?.baseUrl || "https://api.plane.so";

		// If not in config, try to load from project state
		if (!workspaceSlug) {
			const state = await this.loadPlaneProjectState(projectDir);
			if (state) {
				workspaceSlug = state.workspace_slug;
			}
		}

		// If still no workspace slug, throw error
		if (!workspaceSlug) {
			throw new Error(
				"Plane workspace slug not configured.\n" +
					"Add 'plane.workspaceSlug' to .coding-agent.config.json or ensure project is initialized.",
			);
		}

		this.client = new PlaneApiClient(apiKey, baseUrl, workspaceSlug);
		return this.client;
	}

	/**
	 * Validate that PLANE_API_KEY environment variable is set.
	 *
	 * @throws {Error} If PLANE_API_KEY is not set
	 */
	validateEnvironment(): void {
		if (!process.env["PLANE_API_KEY"]) {
			throw new Error(
				"Error: PLANE_API_KEY environment variable not set\n" +
					"\n" +
					"Get your Plane.so API key from: https://app.plane.so/settings\n" +
					"\n" +
					"Then set it:\n" +
					"  export PLANE_API_KEY='your-plane-api-key-here'\n",
			);
		}
	}

	/**
	 * Get the MCP server configuration.
	 * Plane uses REST API, not MCP, so this returns null.
	 *
	 * @returns null (Plane doesn't use MCP)
	 */
	getMcpServerConfig(): MCPServerConfiguration | null {
		// Plane uses REST API, not MCP
		return null;
	}

	/**
	 * Get the list of required MCP tools.
	 * Plane doesn't use MCP, so this returns an empty array.
	 *
	 * @returns Empty array (no MCP tools needed)
	 */
	getRequiredTools(): string[] {
		// No MCP tools needed
		return [];
	}

	/**
	 * Get the marker file name for Plane projects.
	 *
	 * @returns The marker file name ".plane_project.json"
	 */
	getMarkerFileName(): string {
		return ".plane_project.json";
	}

	/**
	 * Check if Plane project has been initialized.
	 *
	 * @param projectDir - Absolute path to project directory
	 * @returns True if .plane_project.json exists and is valid
	 */
	async isInitialized(projectDir: string): Promise<boolean> {
		const state = await this.loadPlaneProjectState(projectDir);
		return state !== null && state.initialized === true;
	}

	/**
	 * Load the Plane project state from the marker file.
	 *
	 * @param projectDir - Directory containing .plane_project.json
	 * @returns Project state object or null if not initialized or invalid
	 */
	private async loadPlaneProjectState(projectDir: string): Promise<PlaneProjectState | null> {
		const markerFile = join(projectDir, this.getMarkerFileName());

		if (!existsSync(markerFile)) {
			return null;
		}

		try {
			const file = Bun.file(markerFile);
			const content = await file.text();
			const data = JSON.parse(content) as PlaneProjectState;

			// Validate required fields
			if (
				typeof data.initialized !== "boolean" ||
				typeof data.workspace_slug !== "string" ||
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
		const planeState = await this.loadPlaneProjectState(projectDir);

		if (planeState === null) {
			return null;
		}

		// Convert Plane-specific state to unified ProjectState
		const projectState: ProjectState = {
			initialized: planeState.initialized,
			provider: "plane",
			created_at: planeState.created_at,
			project_id: planeState.project_id,
			project_name: planeState.project_name,
			meta_issue_id: planeState.meta_issue_id,
			total_issues: planeState.total_issues,
			provider_data: {
				workspace_slug: planeState.workspace_slug,
			},
		};

		// Add notes only if it exists (exactOptionalPropertyTypes requires this)
		if (planeState.notes !== undefined) {
			projectState.notes = planeState.notes;
		}

		return projectState;
	}

	/**
	 * Get the initializer prompt content.
	 * Loaded from prompts/plane/initializer_prompt.md
	 *
	 * @returns Promise resolving to prompt content
	 */
	async getInitializerPrompt(): Promise<string> {
		// Get the directory of this source file
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		// Go up to project root, then into prompts/plane
		const promptPath = join(__dirname, "..", "..", "prompts", "plane", "initializer_prompt.md");

		const file = Bun.file(promptPath);
		return await file.text();
	}

	/**
	 * Get the coding prompt content.
	 * Loaded from prompts/plane/coding_prompt.md
	 *
	 * @returns Promise resolving to prompt content
	 */
	async getCodingPrompt(): Promise<string> {
		// Get the directory of this source file
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		// Go up to project root, then into prompts/plane
		const promptPath = join(__dirname, "..", "..", "prompts", "plane", "coding_prompt.md");

		const file = Bun.file(promptPath);
		return await file.text();
	}

	/**
	 * Print a summary of current Plane project progress.
	 *
	 * Queries the Plane API to get current work item counts by state.
	 *
	 * @param projectDir - Absolute path to project directory
	 */
	async printProgressSummary(projectDir: string): Promise<void> {
		const state = await this.loadPlaneProjectState(projectDir);

		if (state === null) {
			console.log("\nProgress: Plane project not yet initialized");
			return;
		}

		try {
			const client = await this.getClient(projectDir);
			const projectId = state.project_id;

			// Query work items by state
			const allItems = await client.listWorkItems(projectId);
			const todoItems = allItems.filter((item) => item.state === "Todo");
			const inProgressItems = allItems.filter((item) => item.state === "In Progress");
			const doneItems = allItems.filter((item) => item.state === "Done");

			console.log("\nPlane Project Status:");
			console.log(`  Project: ${state.project_name}`);
			console.log(`  Workspace: ${state.workspace_slug}`);
			console.log(`  Total issues: ${allItems.length}`);
			console.log(`  Todo: ${todoItems.length}`);
			console.log(`  In Progress: ${inProgressItems.length}`);
			console.log(`  Done: ${doneItems.length}`);
		} catch (error) {
			console.error(
				`Failed to fetch project status: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
