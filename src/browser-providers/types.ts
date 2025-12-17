/**
 * Browser Provider Strategy Pattern Types
 *
 * Core abstractions for supporting multiple browser automation backends
 * (Puppeteer MCP, Chrome DevTools MCP) in the autonomous coding agent harness.
 */

import type { MCPServerConfiguration } from "../client.js";

/**
 * Supported browser provider types
 */
export type BrowserProviderType = "puppeteer" | "chrome-devtools";

/**
 * Tool categorization for browser automation
 */
export type BrowserToolCategory = "navigation" | "interaction" | "inspection" | "advanced";

/**
 * Definition of a browser automation tool with metadata
 */
export interface BrowserToolDefinition {
	/** Tool name (e.g., "mcp__puppeteer__puppeteer_navigate") */
	name: string;

	/** Human-readable description of what the tool does */
	description: string;

	/** Example usage (optional) */
	example?: string;

	/** Tool category for organization */
	category?: BrowserToolCategory;
}

/**
 * Browser Provider Interface
 *
 * Defines the contract that all browser providers (Puppeteer, Chrome DevTools) must implement.
 * This enables the strategy pattern for swappable browser automation backends.
 */
export interface BrowserProvider {
	// ============================================================================
	// Identity
	// ============================================================================

	/**
	 * The provider type identifier
	 * @example "puppeteer", "chrome-devtools"
	 */
	readonly name: BrowserProviderType;

	/**
	 * Human-readable display name
	 * @example "Puppeteer", "Chrome DevTools"
	 */
	readonly displayName: string;

	// ============================================================================
	// Environment & Configuration
	// ============================================================================

	/**
	 * Validate that the environment is properly configured for this provider.
	 * Should throw descriptive errors if requirements are not met.
	 *
	 * Examples:
	 * - Puppeteer: No validation needed (launches on demand)
	 * - Chrome DevTools: Check if Chrome is running at the debug port
	 *
	 * @throws {Error} If environment is not properly configured
	 */
	validateEnvironment(): Promise<void>;

	/**
	 * Get the MCP server configuration for this provider.
	 *
	 * @returns MCP server configuration
	 */
	getMcpServerConfig(): MCPServerConfiguration;

	/**
	 * Get the list of MCP tool names that should be allowed for this provider.
	 *
	 * @returns Array of MCP tool names (e.g., ["mcp__puppeteer__puppeteer_navigate"])
	 */
	getRequiredTools(): string[];

	/**
	 * Get detailed definitions of all available tools with metadata.
	 *
	 * @returns Array of tool definitions with descriptions and examples
	 */
	getToolDefinitions(): BrowserToolDefinition[];

	/**
	 * Get template variables for substitution in prompts.
	 * Allows prompts to be provider-agnostic by using variables like {{navigate_tool}}.
	 *
	 * @returns Map of variable names to tool names
	 * @example { navigate_tool: "mcp__puppeteer__puppeteer_navigate" }
	 */
	getTemplateVariables(): Record<string, string>;

	// ============================================================================
	// Browser Management
	// ============================================================================

	/**
	 * Get the browser URL if the provider connects to an existing browser instance.
	 * Returns null for providers that launch their own browser (Puppeteer).
	 *
	 * @returns Browser debug URL or null
	 * @example "http://localhost:9222"
	 */
	getBrowserUrl(): string | null;

	/**
	 * Ensure the browser is running and ready for automation.
	 * For Chrome DevTools, this may attempt to launch Chrome.
	 * For Puppeteer, this is typically a no-op.
	 *
	 * @throws {Error} If browser cannot be started or connected
	 */
	ensureBrowserRunning(): Promise<void>;
}
