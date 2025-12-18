#!/usr/bin/env bun

/**
 * Autonomous Coding Agent Demo
 * ============================
 *
 * A minimal harness demonstrating long-running autonomous coding with Claude.
 * This script implements the two-agent pattern (initializer + coding agent) and
 * incorporates all the strategies from the long-running agents guide.
 *
 * Example Usage:
 *   bun run src/index.ts --project-dir ./claude_clone_demo
 *   bun run src/index.ts --project-dir ./claude_clone_demo --max-iterations 5
 */

import { isAbsolute, resolve } from "node:path";
import { runAutonomousAgent } from "./agent.js";
import type { BrowserProviderType } from "./browser-providers/types.js";
import { initializeConfig } from "./init-config.js";
import type { ProviderType } from "./providers/types.js";

/**
 * Configuration interface for command-line arguments
 */
interface CliArguments {
	projectDir: string;
	maxIterations: number | undefined;
	model: string;
	provider?: ProviderType;
	browser?: BrowserProviderType;
	init: boolean;
}

/**
 * Configuration constants
 */
const CONFIG = {
	/**
	 * Using Claude Opus 4.5 as default for best coding and agentic performance
	 * See: https://www.anthropic.com/news/claude-opus-4-5
	 */
	DEFAULT_MODEL: "claude-opus-4-5-20251101",
	DEFAULT_PROJECT_DIR: "./autonomous_demo_project",
	GENERATIONS_DIR: "generations",
} as const;

/**
 * Parse command line arguments from process.argv
 *
 * @returns Parsed command line arguments
 */
export function parseArgs(): CliArguments {
	const args = process.argv.slice(2);
	const result: CliArguments = {
		projectDir: CONFIG.DEFAULT_PROJECT_DIR,
		maxIterations: undefined,
		model: CONFIG.DEFAULT_MODEL,
		init: false,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		switch (arg) {
			case "--project-dir":
			case "-p":
				if (i + 1 < args.length) {
					const nextArg = args[i + 1];
					if (nextArg) {
						result.projectDir = nextArg;
						i++;
					} else {
						throw new Error(`${arg} requires a value`);
					}
				} else {
					throw new Error(`${arg} requires a value`);
				}
				break;

			case "--max-iterations":
			case "-m":
				if (i + 1 < args.length) {
					const nextArg = args[i + 1];
					if (!nextArg) {
						throw new Error(`${arg} requires a value`);
					}
					const value = Number.parseInt(nextArg, 10);
					if (Number.isNaN(value) || value <= 0) {
						throw new Error("--max-iterations must be a positive integer");
					}
					result.maxIterations = value;
					i++;
				} else {
					throw new Error(`${arg} requires a value`);
				}
				break;

			case "--model":
				if (i + 1 < args.length) {
					const nextArg = args[i + 1];
					if (nextArg) {
						result.model = nextArg;
						i++;
					} else {
						throw new Error(`${arg} requires a value`);
					}
				} else {
					throw new Error(`${arg} requires a value`);
				}
				break;

			case "--provider":
				if (i + 1 < args.length) {
					const nextArg = args[i + 1];
					if (!nextArg) {
						throw new Error(`${arg} requires a value`);
					}
					if (!["linear", "beads", "plane"].includes(nextArg)) {
						throw new Error(`Invalid provider: ${nextArg}. Must be: linear, beads, or plane`);
					}
					result.provider = nextArg as ProviderType;
					i++;
				} else {
					throw new Error(`${arg} requires a value`);
				}
				break;

			case "--browser":
			case "-b":
				if (i + 1 < args.length) {
					const nextArg = args[i + 1];
					if (!nextArg) {
						throw new Error(`${arg} requires a value`);
					}
					if (!["puppeteer", "chrome-devtools"].includes(nextArg)) {
						throw new Error(
							`Invalid browser provider: ${nextArg}. Must be: puppeteer or chrome-devtools`,
						);
					}
					result.browser = nextArg as BrowserProviderType;
					i++;
				} else {
					throw new Error(`${arg} requires a value`);
				}
				break;

			case "--init":
				result.init = true;
				break;

			case "--help":
			// biome-ignore lint/suspicious/noFallthroughSwitchClause: intentional fallthrough for help flags
			case "-h":
				printHelp();
				process.exit(0);

			default:
				if (arg?.startsWith("-")) {
					throw new Error(`Unknown option: ${arg}`);
				}
				break;
		}
	}

	return result;
}

/**
 * Detect if running as standalone executable or via bun
 *
 * @returns Command prefix for examples (e.g., "coding-agent" or "bun run src/index.ts")
 */
function getCommandPrefix(): string {
	const execPath = process.execPath;

	// Check if we're running as a compiled executable
	// When using `bun build --compile`, the execPath will be the compiled binary
	// When running via `bun run`, the execPath will be the bun binary itself
	if (execPath.includes("coding-agent") || !execPath.includes("bun")) {
		// Running as standalone executable
		// If installed in system path (e.g., /usr/local/bin/coding-agent), just show the name
		if (execPath.includes("/usr/local/bin/") || execPath.includes("/usr/bin/")) {
			return "coding-agent";
		}

		// For local builds, show relative path from current directory
		if (execPath.includes("/dist/coding-agent")) {
			return "./dist/coding-agent";
		}

		// Fallback to just the binary name
		return "coding-agent";
	}

	// Running via bun
	return "bun run src/index.ts";
}

/**
 * Print help message
 */
function printHelp(): void {
	const cmd = getCommandPrefix();

	console.log(`
Autonomous Coding Agent Demo - Long-running agent harness

Usage:
  ${cmd} [options]

Options:
  --project-dir, -p <path>    Directory for the project (default: ${CONFIG.DEFAULT_PROJECT_DIR})
                              Relative paths automatically placed in ${CONFIG.GENERATIONS_DIR}/ directory
  --max-iterations, -m <num>  Maximum number of agent iterations (default: unlimited)
  --model <model>             Claude model to use (default: ${CONFIG.DEFAULT_MODEL})
  --provider <type>           Project management provider: linear, beads, or plane (default: auto-detect or linear)
  --browser, -b <type>        Browser automation provider
                              Options: puppeteer, chrome-devtools
                              Default: chrome-devtools
  --init                      Run interactive configuration wizard to create/update .coding-agent.config.json
  --help, -h                  Show this help message

Examples:
  # Initialize configuration interactively
  ${cmd} --init --project-dir ./claude_clone

  # Start fresh project (default: Linear)
  ${cmd} --project-dir ./claude_clone

  # Start with Beads
  ${cmd} --project-dir ./my_app --provider beads

  # Start with Plane
  ${cmd} --project-dir ./my_app --provider plane

  # Use a specific model
  ${cmd} --project-dir ./claude_clone --model claude-sonnet-4-5-20250929

  # Limit iterations for testing
  ${cmd} --project-dir ./claude_clone --max-iterations 5

  # Continue existing project (auto-detects provider)
  ${cmd} --project-dir ./claude_clone

Environment Variables:
  CLAUDE_CODE_OAUTH_TOKEN    Claude Code OAuth token (required)
  LINEAR_API_KEY             Linear API key (required if using Linear)
  PLANE_API_KEY              Plane.so API key (required if using Plane)
`);
}

/**
 * Resolve the project directory path, automatically placing relative paths
 * in the generations/ directory unless already specified.
 *
 * @param projectDir - The project directory path from arguments
 * @returns Resolved project directory path
 */
export function resolveProjectDir(projectDir: string): string {
	// If already absolute, use as-is
	if (isAbsolute(projectDir)) {
		return projectDir;
	}

	// If already starts with generations/, use as-is
	if (projectDir.startsWith(`${CONFIG.GENERATIONS_DIR}/`)) {
		return resolve(projectDir);
	}

	// Prepend generations/ to relative paths
	return resolve(CONFIG.GENERATIONS_DIR, projectDir);
}

/**
 * Validate required environment variables are set
 *
 * @throws Error if required environment variables are missing
 */
export function validateEnvironment(): void {
	// Check for Claude Code OAuth token
	if (!process.env["CLAUDE_CODE_OAUTH_TOKEN"]) {
		console.error("Error: CLAUDE_CODE_OAUTH_TOKEN environment variable not set");
		console.error("\nRun 'claude setup-token' after installing the Claude Code CLI.");
		console.error("\nThen set it:");
		console.error("  export CLAUDE_CODE_OAUTH_TOKEN='your-token-here'");
		process.exit(1);
	}

	// Provider-specific validation happens in the provider itself
}

/**
 * Main entry point for the autonomous coding agent demo
 */
export async function main(): Promise<void> {
	try {
		// Parse command line arguments
		const args = parseArgs();

		// Resolve project directory
		const projectDir = resolveProjectDir(args.projectDir);

		// Handle --init mode
		if (args.init) {
			await initializeConfig(projectDir);
			return;
		}

		// Validate environment variables
		validateEnvironment();

		// Run the autonomous agent
		await runAutonomousAgent(
			projectDir,
			args.model,
			args.maxIterations,
			args.provider,
			args.browser,
		);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === "SIGINT") {
				console.log("\n\nInterrupted by user");
				console.log("To resume, run the same command again");
				process.exit(0);
			}
			console.error(`\nFatal error: ${error.message}`);
			if (process.env["DEBUG"]) {
				console.error(error.stack);
			}
		} else {
			console.error("\nFatal error:", error);
		}
		process.exit(1);
	}
}

/**
 * Handle process signals for graceful shutdown
 */
function setupSignalHandlers(): void {
	process.on("SIGINT", () => {
		console.log("\n\nInterrupted by user");
		console.log("To resume, run the same command again");
		process.exit(0);
	});

	process.on("SIGTERM", () => {
		console.log("\n\nReceived SIGTERM signal");
		console.log("To resume, run the same command again");
		process.exit(0);
	});
}

// Execute main function if this is the entry point
if (import.meta.main) {
	setupSignalHandlers();
	main();
}
