/**
 * Multi-Provider Strategy Pattern Types
 *
 * Core abstractions for supporting multiple project management platforms
 * (Linear, Beads, Plane.so) in the autonomous coding agent harness.
 */

import type { MCPServerConfiguration } from "../client.js";

/**
 * Supported project management provider types
 */
export type ProviderType = "linear" | "beads" | "plane";

/**
 * Unified project state structure
 *
 * Contains common fields across all providers, with provider-specific
 * data stored in the `provider_data` field.
 */
export interface ProjectState {
	/** Whether the project has been initialized */
	initialized: boolean;

	/** The provider type used for this project */
	provider: ProviderType;

	/** ISO 8601 timestamp of project creation */
	created_at: string;

	/** Provider-specific project identifier */
	project_id: string;

	/** Human-readable project name */
	project_name: string;

	/** ID of the META issue used for session handoffs */
	meta_issue_id: string;

	/** Total number of issues created during initialization */
	total_issues: number;

	/** Optional notes about the project */
	notes?: string;

	/** Provider-specific data that doesn't fit the common schema */
	provider_data: Record<string, unknown>;
}

/**
 * Project Management Provider Interface
 *
 * Defines the contract that all providers (Linear, Beads, Plane) must implement.
 * This enables the strategy pattern for swappable project management backends.
 */
export interface ProjectManagementProvider {
	// ============================================================================
	// Identity
	// ============================================================================

	/**
	 * The provider type identifier
	 * @example "linear", "beads", "plane"
	 */
	readonly name: ProviderType;

	// ============================================================================
	// Environment & Configuration
	// ============================================================================

	/**
	 * Validate that the environment is properly configured for this provider.
	 * Should throw descriptive errors if requirements are not met.
	 *
	 * Examples:
	 * - Linear: Check for LINEAR_API_KEY environment variable
	 * - Beads: Check for 'bd' CLI binary availability
	 * - Plane: Check for PLANE_API_KEY environment variable
	 *
	 * @throws {Error} If environment is not properly configured
	 */
	validateEnvironment(): void;

	/**
	 * Get the MCP server configuration for this provider.
	 * Returns null for providers that don't use MCP (e.g., Beads CLI, Plane REST API).
	 *
	 * @returns MCP server configuration or null
	 */
	getMcpServerConfig(): MCPServerConfiguration | null;

	/**
	 * Get the list of MCP tool names that should be allowed for this provider.
	 * Empty array for providers without MCP servers.
	 *
	 * @returns Array of MCP tool names (e.g., ["mcp__linear__create_issue"])
	 */
	getRequiredTools(): string[];

	// ============================================================================
	// State Management
	// ============================================================================

	/**
	 * Get the marker file name that indicates project initialization.
	 * This file is used for auto-detection of the provider type.
	 *
	 * @returns Marker file path relative to project directory
	 * @example ".linear_project.json", ".beads/issues.jsonl", ".plane_project.json"
	 */
	getMarkerFileName(): string;

	/**
	 * Check if a project has been initialized with this provider.
	 *
	 * @param projectDir - Absolute path to the project directory
	 * @returns Promise resolving to true if initialized
	 */
	isInitialized(projectDir: string): Promise<boolean>;

	/**
	 * Load the project state from the provider's marker file.
	 *
	 * @param projectDir - Absolute path to the project directory
	 * @returns Promise resolving to project state or null if not initialized
	 */
	loadProjectState(projectDir: string): Promise<ProjectState | null>;

	// ============================================================================
	// Prompts
	// ============================================================================

	/**
	 * Get the initializer prompt content for this provider.
	 * The initializer prompt guides the agent through project setup.
	 *
	 * @param browserProvider - Browser automation provider (for template rendering)
	 * @returns Promise resolving to prompt content
	 */
	getInitializerPrompt(
		browserProvider?: import("../browser-providers/types.js").BrowserProvider,
	): Promise<string>;

	/**
	 * Get the coding prompt content for this provider.
	 * The coding prompt guides the agent through feature implementation.
	 *
	 * @param browserProvider - Browser automation provider (for template rendering)
	 * @returns Promise resolving to prompt content
	 */
	getCodingPrompt(
		browserProvider?: import("../browser-providers/types.js").BrowserProvider,
	): Promise<string>;

	// ============================================================================
	// Progress Display
	// ============================================================================

	/**
	 * Print a summary of project progress to the console.
	 * Should display provider-specific metrics (e.g., issue counts by status).
	 *
	 * @param projectDir - Absolute path to the project directory
	 */
	printProgressSummary(projectDir: string): Promise<void>;
}
