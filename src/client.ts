/**
 * Client Configuration
 * ===================
 *
 * Configuration builder for Claude Agent SDK query options.
 * Sets up MCP servers, security hooks, and other settings.
 */

import type {
	HookCallback,
	HookEvent,
	McpServerConfig,
	Options,
} from "@anthropic-ai/claude-agent-sdk";
import type { ProjectManagementProvider } from "./providers/types.js";
import type { BrowserProvider } from "./browser-providers/types.js";
import { bashSecurityHook } from "./security.js";

/**
 * MCP server configuration for Linear integration
 */
type MCPServerConfiguration = McpServerConfig;

/**
 * Security settings structure for Claude Code
 */
interface SecuritySettings {
	sandbox: {
		enabled: boolean;
		autoAllowBashIfSandboxed: boolean;
	};
	permissions: {
		defaultMode: string;
		allow: string[];
	};
}

/**
 * Built-in Claude Code tools
 */
const BUILTIN_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"] as const;

/**
 * Creates SDK options for a Claude Agent SDK query.
 *
 * Configures:
 * - MCP servers (provider + browser automation)
 * - Security hooks (bash command validation)
 * - Working directory and permissions
 * - Tool allowlist
 *
 * Security layers (defense in depth):
 * 1. Sandbox - OS-level bash command isolation
 * 2. Permissions - File operations restricted to project directory
 * 3. Security hooks - Bash commands validated against allowlist
 *
 * @param projectDir - Directory for the project (used as cwd)
 * @param model - Claude model to use
 * @param provider - Project management provider to use
 * @param browserProvider - Browser automation provider to use
 * @returns Options object for SDK query
 *
 * @throws Error if required environment variables are not set
 *
 * @example
 * ```typescript
 * import { query } from "@anthropic-ai/claude-agent-sdk";
 * import { createQueryOptions } from "./client.js";
 * import { LinearProvider } from "./providers/linear.js";
 * import { ChromeDevToolsProvider } from "./browser-providers/chrome-devtools-provider.js";
 *
 * const provider = new LinearProvider();
 * const browserProvider = new ChromeDevToolsProvider();
 * const options = await createQueryOptions("/path/to/project", "claude-opus-4-5-20251101", provider, browserProvider);
 * const result = query({ prompt: "Hello", options });
 * for await (const msg of result) {
 *   console.log(msg);
 * }
 * ```
 */
export async function createQueryOptions(
	projectDir: string,
	model: string,
	provider: ProjectManagementProvider,
	browserProvider: BrowserProvider,
): Promise<Options> {
	// Validate environment
	const claudeToken = process.env["CLAUDE_CODE_OAUTH_TOKEN"];
	if (!claudeToken) {
		throw new Error(
			"CLAUDE_CODE_OAUTH_TOKEN environment variable not set.\n" +
				"Run 'claude setup-token' after installing the Claude Code CLI.",
		);
	}

	// Validate provider environment
	provider.validateEnvironment();

	// Ensure project directory exists
	await Bun.$`mkdir -p ${projectDir}`.quiet();

	// Create security settings file
	const securitySettings: SecuritySettings = {
		sandbox: { enabled: true, autoAllowBashIfSandboxed: true },
		permissions: {
			defaultMode: "acceptEdits",
			allow: [
				"Read(./**)",
				"Write(./**)",
				"Edit(./**)",
				"Glob(./**)",
				"Grep(./**)",
				"Bash(*)",
				...browserProvider.getRequiredTools(),
				...provider.getRequiredTools(),
			],
		},
	};

	const settingsFile = `${projectDir}/.claude_settings.json`;
	await Bun.write(settingsFile, JSON.stringify(securitySettings, null, 2));

	console.log(`Created security settings at ${settingsFile}`);
	console.log("   - Sandbox enabled (OS-level bash isolation)");
	console.log(`   - Filesystem restricted to: ${projectDir}`);
	console.log("   - Bash commands restricted to allowlist (see security.ts)");
	console.log(`   - MCP servers: ${browserProvider.name}, ${provider.name}`);
	console.log();

	// MCP Server Configuration
	const mcpServers: Record<string, MCPServerConfiguration> = {};

	// Add browser provider's MCP server configuration
	mcpServers[browserProvider.name] = browserProvider.getMcpServerConfig();

	// Add project management provider's MCP server configuration (if any)
	const providerMcpConfig = provider.getMcpServerConfig();
	if (providerMcpConfig) {
		mcpServers[provider.name] = providerMcpConfig;
	}

	// Security hooks configuration
	const hooks: Partial<Record<HookEvent, { hooks: HookCallback[] }[]>> = {
		PreToolUse: [
			{
				hooks: [
					(input, _toolUseId, _options) => {
						// Type guard for PreToolUse event
						if (
							typeof input === "object" &&
							input !== null &&
							"hook_event_name" in input &&
							input.hook_event_name === "PreToolUse"
						) {
							// Cast to the security hook's expected type
							const hookInput = input as unknown as import("./security.js").HookInputData;
							const result = bashSecurityHook(hookInput);
							// Convert sync result to async format
							if ("decision" in result && result.decision === "block") {
								return Promise.resolve({
									decision: "block",
									reason: result.reason,
								});
							}
						}
						return Promise.resolve({});
					},
				],
			},
		],
	};

	// Build options
	const options: Options = {
		// Model configuration
		model,

		// Working directory
		cwd: projectDir,

		// MCP servers
		mcpServers,

		// Security hooks
		hooks,

		// Permission mode
		permissionMode: "default",

		// Tool configuration - use Claude Code's preset
		tools: {
			type: "preset",
			preset: "claude_code",
		},

		// System prompt - use Claude Code's preset
		systemPrompt: {
			type: "preset",
			preset: "claude_code",
		},

		// Load project settings (CLAUDE.md)
		settingSources: ["project"],

		// Additional directories accessible to the agent
		additionalDirectories: [],

		// Environment variables
		env: process.env as Record<string, string>,

		// Max turns
		maxTurns: 1000,
	};

	return options;
}

/**
 * Validate that required environment variables are set.
 *
 * @throws Error if CLAUDE_CODE_OAUTH_TOKEN is missing
 */
export function validateEnvironment(): void {
	if (!process.env["CLAUDE_CODE_OAUTH_TOKEN"]) {
		throw new Error(
			"CLAUDE_CODE_OAUTH_TOKEN environment variable not set.\n" +
				"Run 'claude setup-token' after installing the Claude Code CLI.",
		);
	}
}

/**
 * Export tool lists for external use
 */
export { BUILTIN_TOOLS };

/**
 * Export types for external use
 */
export type { SecuritySettings, MCPServerConfiguration };
