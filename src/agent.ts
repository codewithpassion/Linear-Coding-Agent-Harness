/**
 * Agent Session Logic
 * ====================
 *
 * Core agent interaction functions for running autonomous coding sessions.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
	SDKAssistantMessage,
	SDKMessage,
	SDKResultMessage,
	SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { createQueryOptions } from "./client.js";
import { isLinearInitialized, printProgressSummary, printSessionHeader } from "./progress.js";
import { copySpecToProject, getCodingPrompt, getInitializerPrompt } from "./prompts.js";

/**
 * Configuration
 */

/**
 * Delay in seconds between automatic session continuations
 */
export const AUTO_CONTINUE_DELAY_SECONDS = 3;

/**
 * Session status indicating the agent should continue working
 */
export type SessionStatusContinue = "continue";

/**
 * Session status indicating an error occurred
 */
export type SessionStatusError = "error";

/**
 * Union type for all possible session statuses
 */
export type SessionStatus = SessionStatusContinue | SessionStatusError;

/**
 * Return type for run_agent_session function
 * Tuple of [status, response_text]
 */
export type AgentSessionResult = readonly [SessionStatus, string];

/**
 * Type guard for SDKAssistantMessage
 */
function isAssistantMessage(msg: SDKMessage): msg is SDKAssistantMessage {
	return msg.type === "assistant";
}

/**
 * Type guard for SDKUserMessage
 */
function isUserMessage(msg: SDKMessage): msg is SDKUserMessage {
	return msg.type === "user";
}

/**
 * Type guard for SDKResultMessage
 */
function isResultMessage(msg: SDKMessage): msg is SDKResultMessage {
	return msg.type === "result";
}

/**
 * Run a single agent session using Claude Agent SDK.
 *
 * @param prompt - The prompt to send
 * @param projectDir - Project directory path
 * @param model - Claude model to use
 * @returns Promise resolving to [status, response_text] where status is:
 *          - "continue" if agent should continue working
 *          - "error" if an error occurred
 */
export async function runAgentSession(
	prompt: string,
	projectDir: string,
	model: string,
): Promise<AgentSessionResult> {
	console.log("Sending prompt to Claude Agent SDK...\n");

	try {
		// Get options for the query
		const options = await createQueryOptions(projectDir, model);

		// Create query
		const result = query({
			prompt,
			options,
		});

		// Collect response text
		let responseText = "";

		// Iterate through streaming response
		for await (const msg of result) {
			// Handle AssistantMessage (text and tool use)
			if (isAssistantMessage(msg)) {
				for (const block of msg.message.content) {
					if (block.type === "text") {
						responseText += block.text;
						process.stdout.write(block.text);
					} else if (block.type === "tool_use") {
						console.log(`\n[Tool: ${block.name}]`);
						const inputStr = JSON.stringify(block.input);
						if (inputStr.length > 200) {
							console.log(`   Input: ${inputStr.slice(0, 200)}...`);
						} else {
							console.log(`   Input: ${inputStr}`);
						}
					}
				}
			}
			// Handle UserMessage (tool results)
			else if (isUserMessage(msg)) {
				for (const block of msg.message.content) {
					if (block.type === "tool_result") {
						const resultContent = block.content;
						const isError = block.is_error ?? false;

						// Check if command was blocked by security hook
						const contentStr =
							typeof resultContent === "string" ? resultContent : JSON.stringify(resultContent);

						if (contentStr.toLowerCase().includes("blocked")) {
							console.log(`   [BLOCKED] ${contentStr}`);
						} else if (isError) {
							// Show errors (truncated)
							const errorStr = contentStr.slice(0, 500);
							console.log(`   [Error] ${errorStr}`);
						} else {
							// Tool succeeded - just show brief confirmation
							console.log("   [Done]");
						}
					}
				}
			}
			// Handle Result message (final result)
			else if (isResultMessage(msg)) {
				console.log(`\n${"=".repeat(70)}`);
				console.log(`Result: ${msg.subtype}`);
				if (msg.subtype === "success") {
					console.log(`Total cost: $${msg.total_cost_usd.toFixed(4)}`);
					console.log(`Turns: ${msg.num_turns}`);
					console.log(`Duration: ${(msg.duration_ms / 1000).toFixed(1)}s`);
				} else {
					console.log(`Errors: ${msg.errors.join(", ")}`);
				}
				console.log("=".repeat(70));
			}
		}

		console.log(`\n${"-".repeat(70)}\n`);
		return ["continue", responseText] as const;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error during agent session: ${errorMessage}`);
		return ["error", errorMessage] as const;
	}
}

/**
 * Run the autonomous agent loop.
 *
 * @param projectDir - Directory for the project
 * @param model - Claude model to use
 * @param maxIterations - Maximum number of iterations (undefined for unlimited)
 * @returns Promise that resolves when the agent loop completes
 */
export async function runAutonomousAgent(
	projectDir: string,
	model: string,
	maxIterations: number | undefined = undefined,
): Promise<void> {
	console.log(`\n${"=".repeat(70)}`);
	console.log("  AUTONOMOUS CODING AGENT DEMO");
	console.log("=".repeat(70));
	console.log(`\nProject directory: ${projectDir}`);
	console.log(`Model: ${model}`);

	if (maxIterations !== undefined) {
		console.log(`Max iterations: ${maxIterations}`);
	} else {
		console.log("Max iterations: Unlimited (will run until completion)");
	}
	console.log();

	// Create project directory
	await Bun.$`mkdir -p ${projectDir}`.quiet();

	// Check if this is a fresh start or continuation
	let isFirstRun = !(await isLinearInitialized(projectDir));

	if (isFirstRun) {
		console.log("Fresh start - will use initializer agent");
		console.log();
		console.log("=".repeat(70));
		console.log("  NOTE: First session takes 10-20+ minutes!");
		console.log("  The agent is creating 50 Linear issues and setting up the project.");
		console.log("  This may appear to hang - it's working. Watch for [Tool: ...] output.");
		console.log("=".repeat(70));
		console.log();
		// Copy the app spec into the project directory
		await copySpecToProject(projectDir);
	} else {
		console.log("Continuing existing project (Linear initialized)");
		await printProgressSummary(projectDir);
	}

	// Main loop
	let iteration = 0;

	while (true) {
		iteration++;

		// Check max iterations
		if (maxIterations !== undefined && iteration > maxIterations) {
			console.log(`\nReached max iterations (${maxIterations})`);
			console.log("To continue, run the script again without --max-iterations");
			break;
		}

		// Print session header
		printSessionHeader(iteration, isFirstRun);

		// Choose prompt based on session type
		let prompt: string;
		if (isFirstRun) {
			prompt = await getInitializerPrompt();
			isFirstRun = false; // Only use initializer once
		} else {
			prompt = await getCodingPrompt();
		}

		// Run session
		const [status, _response] = await runAgentSession(prompt, projectDir, model);

		// Handle status
		if (status === "continue") {
			console.log(`\nAgent will auto-continue in ${AUTO_CONTINUE_DELAY_SECONDS}s...`);
			await printProgressSummary(projectDir);
			await sleep(AUTO_CONTINUE_DELAY_SECONDS * 1000);
		} else if (status === "error") {
			console.log("\nSession encountered an error");
			console.log("Will retry with a fresh session...");
			await sleep(AUTO_CONTINUE_DELAY_SECONDS * 1000);
		}

		// Small delay between sessions
		if (maxIterations === undefined || iteration < maxIterations) {
			console.log("\nPreparing next session...\n");
			await sleep(1000);
		}
	}

	// Final summary
	console.log(`\n${"=".repeat(70)}`);
	console.log("  SESSION COMPLETE");
	console.log("=".repeat(70));
	console.log(`\nProject directory: ${projectDir}`);
	await printProgressSummary(projectDir);

	// Print instructions
	console.log(`\n${"-".repeat(70)}`);
	console.log("  TO RUN THE GENERATED APPLICATION:");
	console.log("-".repeat(70));
	console.log(`\n  cd ${projectDir}`);
	console.log("  ./init.sh           # Run the setup script");
	console.log("  # Or manually:");
	console.log("  npm install && npm run dev");
	console.log("\n  Then open http://localhost:3000 (or check init.sh for the URL)");
	console.log("-".repeat(70));

	console.log("\nDone!");
}

/**
 * Sleep for the specified number of milliseconds.
 *
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
