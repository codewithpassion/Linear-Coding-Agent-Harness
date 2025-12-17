/**
 * Puppeteer Browser Provider Implementation
 * ==========================================
 *
 * Implements the BrowserProvider interface for Puppeteer MCP integration.
 * Extracted from the original client.ts to support the browser provider pattern.
 */

import type { MCPServerConfiguration } from "../client.js";
import type { BrowserProvider, BrowserProviderType, BrowserToolDefinition } from "./types.js";

/**
 * Puppeteer MCP tools for browser automation
 * Extracted from src/client.ts:40-48
 */
const PUPPETEER_TOOLS = [
	"mcp__puppeteer__puppeteer_navigate",
	"mcp__puppeteer__puppeteer_screenshot",
	"mcp__puppeteer__puppeteer_click",
	"mcp__puppeteer__puppeteer_fill",
	"mcp__puppeteer__puppeteer_select",
	"mcp__puppeteer__puppeteer_hover",
	"mcp__puppeteer__puppeteer_evaluate",
] as const;

/**
 * Puppeteer Provider Implementation
 *
 * Implements all BrowserProvider interface methods for Puppeteer MCP.
 * Uses Puppeteer MCP server via stdio transport for browser automation.
 * Puppeteer manages its own headless Chrome instance automatically.
 */
export class PuppeteerProvider implements BrowserProvider {
	readonly name: BrowserProviderType = "puppeteer";
	readonly displayName = "Puppeteer";

	/**
	 * Validate environment for Puppeteer.
	 * Puppeteer requires no special setup - it launches its own browser on demand.
	 *
	 * @returns Immediately resolves (no validation needed)
	 */
	async validateEnvironment(): Promise<void> {
		// Puppeteer launches its own browser, no validation needed
		return Promise.resolve();
	}

	/**
	 * Get the Puppeteer MCP server configuration.
	 * Extracted from src/client.ts:140-144
	 *
	 * @returns MCP server configuration for Puppeteer stdio transport
	 */
	getMcpServerConfig(): MCPServerConfiguration {
		return {
			type: "stdio",
			command: "npx",
			args: ["puppeteer-mcp-server"],
		};
	}

	/**
	 * Get the list of required Puppeteer MCP tools.
	 * Extracted from src/client.ts:40-48
	 *
	 * @returns Array of Puppeteer MCP tool names
	 */
	getRequiredTools(): string[] {
		return [...PUPPETEER_TOOLS];
	}

	/**
	 * Get detailed tool definitions with descriptions.
	 *
	 * @returns Array of tool definitions with metadata
	 */
	getToolDefinitions(): BrowserToolDefinition[] {
		return [
			{
				name: "mcp__puppeteer__puppeteer_navigate",
				description: "Navigate to a URL",
				category: "navigation",
				example: 'navigate to "https://example.com"',
			},
			{
				name: "mcp__puppeteer__puppeteer_screenshot",
				description: "Take a screenshot of the current page",
				category: "inspection",
				example: "take screenshot to verify UI appearance",
			},
			{
				name: "mcp__puppeteer__puppeteer_click",
				description: "Click an element on the page",
				category: "interaction",
				example: 'click button with selector "button.submit"',
			},
			{
				name: "mcp__puppeteer__puppeteer_fill",
				description: "Fill a form field with text",
				category: "interaction",
				example: 'fill input "email" with "test@example.com"',
			},
			{
				name: "mcp__puppeteer__puppeteer_select",
				description: "Select an option from a dropdown",
				category: "interaction",
				example: 'select option "US" from dropdown "country"',
			},
			{
				name: "mcp__puppeteer__puppeteer_hover",
				description: "Hover over an element",
				category: "interaction",
				example: 'hover over element ".tooltip-trigger"',
			},
			{
				name: "mcp__puppeteer__puppeteer_evaluate",
				description: "Execute JavaScript in the browser context",
				category: "advanced",
				example: "evaluate script to check console errors",
			},
		];
	}

	/**
	 * Get template variables for prompt substitution.
	 * Allows prompts to use {{navigate_tool}} instead of hardcoded tool names.
	 *
	 * @returns Map of variable names to Puppeteer tool names
	 */
	getTemplateVariables(): Record<string, string> {
		return {
			navigate_tool: "mcp__puppeteer__puppeteer_navigate",
			screenshot_tool: "mcp__puppeteer__puppeteer_screenshot",
			click_tool: "mcp__puppeteer__puppeteer_click",
			fill_tool: "mcp__puppeteer__puppeteer_fill",
			select_tool: "mcp__puppeteer__puppeteer_select",
			hover_tool: "mcp__puppeteer__puppeteer_hover",
			evaluate_tool: "mcp__puppeteer__puppeteer_evaluate",
			selector_type: "CSS selector",
		};
	}

	/**
	 * Get the browser URL.
	 * Puppeteer manages its own browser, so this returns null.
	 *
	 * @returns null (Puppeteer launches its own browser)
	 */
	getBrowserUrl(): string | null {
		return null;
	}

	/**
	 * Ensure the browser is running.
	 * Puppeteer launches its browser on demand, so this is a no-op.
	 *
	 * @returns Immediately resolves (no action needed)
	 */
	async ensureBrowserRunning(): Promise<void> {
		// Puppeteer launches browser on first tool use
		return Promise.resolve();
	}
}
