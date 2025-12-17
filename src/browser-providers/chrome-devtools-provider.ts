/**
 * Chrome DevTools Browser Provider Implementation
 * =================================================
 *
 * Implements the BrowserProvider interface for Chrome DevTools MCP integration.
 * Connects to an existing Chrome instance via the Chrome DevTools Protocol.
 */

import type { MCPServerConfiguration } from "../client.js";
import type { BrowserProvider, BrowserProviderType, BrowserToolDefinition } from "./types.js";

/**
 * Chrome DevTools MCP tools for browser automation
 * Based on chrome-devtools-mcp capabilities
 */
const CHROME_DEVTOOLS_TOOLS = [
	"mcp__chrome-devtools__navigate_page",
	"mcp__chrome-devtools__click",
	"mcp__chrome-devtools__fill",
	"mcp__chrome-devtools__take_snapshot",
	"mcp__chrome-devtools__take_screenshot",
	"mcp__chrome-devtools__list_network_requests",
	"mcp__chrome-devtools__evaluate_script",
	"mcp__chrome-devtools__get_page_info",
	"mcp__chrome-devtools__wait_for_selector",
] as const;

/**
 * Chrome DevTools Provider Implementation
 *
 * Implements all BrowserProvider interface methods for Chrome DevTools MCP.
 * Uses Chrome DevTools MCP server via stdio transport to connect to an existing
 * Chrome instance running with remote debugging enabled.
 */
export class ChromeDevToolsProvider implements BrowserProvider {
	readonly name: BrowserProviderType = "chrome-devtools";
	readonly displayName = "Chrome DevTools";

	private readonly browserUrl: string;

	/**
	 * Create a Chrome DevTools provider instance.
	 *
	 * @param browserUrl - The Chrome DevTools debugging URL (default: http://localhost:9222)
	 */
	constructor(browserUrl?: string) {
		// Priority: constructor param > env var > default
		this.browserUrl = browserUrl ?? process.env["CHROME_DEVTOOLS_URL"] ?? "http://localhost:9222";
	}

	/**
	 * Validate that Chrome is running with remote debugging enabled.
	 * Attempts to fetch the version endpoint to verify connectivity.
	 *
	 * @throws {Error} If Chrome is not running or not accessible
	 */
	async validateEnvironment(): Promise<void> {
		try {
			const response = await fetch(`${this.browserUrl}/json/version`, {
				signal: AbortSignal.timeout(5000), // 5 second timeout
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = (await response.json()) as { Browser?: string };
			console.log(`Connected to Chrome: ${data.Browser ?? "Unknown version"}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			throw new Error(
				`Chrome DevTools not accessible at ${this.browserUrl}\n` +
					`Error: ${errorMessage}\n\n` +
					"Please ensure Chrome is running with remote debugging enabled:\n" +
					"  1. Launch Chrome with: google-chrome --remote-debugging-port=9222\n" +
					"  2. Or on macOS: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222\n" +
					"  3. Or set CHROME_DEVTOOLS_URL environment variable to custom URL\n",
			);
		}
	}

	/**
	 * Get the Chrome DevTools MCP server configuration.
	 *
	 * @returns MCP server configuration for Chrome DevTools stdio transport
	 */
	getMcpServerConfig(): MCPServerConfiguration {
		return {
			type: "stdio",
			command: "npx",
			args: ["chrome-devtools-mcp@latest", "--browser-url", this.browserUrl],
		};
	}

	/**
	 * Get the list of required Chrome DevTools MCP tools.
	 *
	 * @returns Array of Chrome DevTools MCP tool names
	 */
	getRequiredTools(): string[] {
		return [...CHROME_DEVTOOLS_TOOLS];
	}

	/**
	 * Get detailed tool definitions with descriptions.
	 *
	 * @returns Array of tool definitions with metadata
	 */
	getToolDefinitions(): BrowserToolDefinition[] {
		return [
			{
				name: "mcp__chrome-devtools__navigate_page",
				description: "Navigate to a URL",
				category: "navigation",
				example: 'navigate to "https://example.com"',
			},
			{
				name: "mcp__chrome-devtools__take_screenshot",
				description: "Take a screenshot of the current page",
				category: "inspection",
				example: "take screenshot to verify UI appearance",
			},
			{
				name: "mcp__chrome-devtools__take_snapshot",
				description: "Take a DOM snapshot for accessibility testing",
				category: "inspection",
				example: "take snapshot to verify semantic structure",
			},
			{
				name: "mcp__chrome-devtools__click",
				description: "Click an element on the page",
				category: "interaction",
				example: 'click button with selector "button.submit"',
			},
			{
				name: "mcp__chrome-devtools__fill",
				description: "Fill a form field with text",
				category: "interaction",
				example: 'fill input "email" with "test@example.com"',
			},
			{
				name: "mcp__chrome-devtools__wait_for_selector",
				description: "Wait for an element to appear on the page",
				category: "interaction",
				example: 'wait for ".loading-complete" before proceeding',
			},
			{
				name: "mcp__chrome-devtools__evaluate_script",
				description: "Execute JavaScript in the browser context",
				category: "advanced",
				example: "evaluate script to check console errors",
			},
			{
				name: "mcp__chrome-devtools__list_network_requests",
				description: "List all network requests made by the page",
				category: "inspection",
				example: "list network requests to verify API calls",
			},
			{
				name: "mcp__chrome-devtools__get_page_info",
				description: "Get information about the current page (title, URL, etc.)",
				category: "inspection",
				example: "get page info to verify navigation",
			},
		];
	}

	/**
	 * Get template variables for prompt substitution.
	 * Allows prompts to use {{navigate_tool}} instead of hardcoded tool names.
	 *
	 * @returns Map of variable names to Chrome DevTools tool names
	 */
	getTemplateVariables(): Record<string, string> {
		return {
			navigate_tool: "mcp__chrome-devtools__navigate_page",
			screenshot_tool: "mcp__chrome-devtools__take_screenshot",
			click_tool: "mcp__chrome-devtools__click",
			fill_tool: "mcp__chrome-devtools__fill",
			select_tool: "mcp__chrome-devtools__fill", // Chrome DevTools uses fill for selects
			hover_tool: "mcp__chrome-devtools__evaluate_script", // Use evaluate for hover
			evaluate_tool: "mcp__chrome-devtools__evaluate_script",
			selector_type: "CSS selector or XPath",
		};
	}

	/**
	 * Get the browser URL.
	 *
	 * @returns The Chrome DevTools debugging URL
	 */
	getBrowserUrl(): string | null {
		return this.browserUrl;
	}

	/**
	 * Ensure the browser is running.
	 * Attempts to validate connectivity and provides helpful error messages.
	 *
	 * @throws {Error} If browser cannot be connected
	 */
	async ensureBrowserRunning(): Promise<void> {
		try {
			await this.validateEnvironment();
		} catch (error) {
			// Try to auto-launch Chrome if not running
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (errorMessage.includes("not accessible")) {
				console.log("Attempting to auto-launch Chrome with remote debugging...");

				try {
					// Try common Chrome paths
					const chromePaths = [
						"google-chrome",
						"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
						"/usr/bin/google-chrome",
						"/usr/bin/chromium",
					];

					let launched = false;
					for (const chromePath of chromePaths) {
						try {
							// Launch Chrome in the background
							Bun.spawn(
								[
									chromePath,
									"--remote-debugging-port=9222",
									"--no-first-run",
									"--no-default-browser-check",
									"about:blank",
								],
								{
									stdout: "ignore",
									stderr: "ignore",
									stdin: "ignore",
								},
							);

							// Give Chrome a moment to start
							await new Promise((resolve) => setTimeout(resolve, 2000));

							// Verify it's running
							await this.validateEnvironment();
							launched = true;
							console.log(`Successfully launched Chrome from: ${chromePath}`);
							break;
						} catch {
							// Try next path
							continue;
						}
					}

					if (!launched) {
						throw error; // Re-throw original error
					}
				} catch (launchError) {
					// Auto-launch failed, provide helpful error
					throw new Error(
						`Could not auto-launch Chrome. ${errorMessage}\n\n` +
							"Please start Chrome manually with:\n" +
							"  google-chrome --remote-debugging-port=9222\n",
					);
				}
			} else {
				throw error; // Re-throw if not a connectivity issue
			}
		}
	}
}
