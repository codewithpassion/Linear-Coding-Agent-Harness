/**
 * Security Hooks for Autonomous Coding Agent
 * ==========================================
 *
 * Pre-tool-use hooks that validate bash commands for security.
 * Uses an allowlist approach - only explicitly permitted commands can run.
 */

/**
 * Allowed commands for development tasks.
 * Minimal set needed for the autonomous coding demo.
 */
export const ALLOWED_COMMANDS: Set<string> = new Set([
	// File inspection
	"ls",
	"cat",
	"head",
	"tail",
	"wc",
	"grep",
	// File operations (agent uses SDK tools for most file ops, but cp/mkdir needed occasionally)
	"cp",
	"mkdir",
	"chmod", // For making scripts executable; validated separately
	// Directory
	"pwd",
	// Node.js development
	"npm",
	"node",
	// Version control
	"git",
	// Process management
	"ps",
	"lsof",
	"sleep",
	"pkill", // For killing dev servers; validated separately
	// Script execution
	"init.sh", // Init scripts; validated separately
]);

/**
 * Commands that need additional validation even when in the allowlist.
 */
export const COMMANDS_NEEDING_EXTRA_VALIDATION: Set<string> = new Set([
	"pkill",
	"chmod",
	"init.sh",
]);

/**
 * Result of a validation check.
 */
export interface ValidationResult {
	allowed: boolean;
	reason: string;
}

/**
 * Hook input data structure from Claude SDK.
 */
export interface HookInputData {
	tool_name?: string;
	tool_input?: {
		command?: string;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

/**
 * Hook response structure for blocking commands.
 */
export interface HookBlockResponse {
	decision: "block";
	reason: string;
}

/**
 * Hook response structure for allowing commands.
 */
export type HookAllowResponse = Record<string, never>;

/**
 * Hook response - either empty object (allow) or block with reason.
 */
export type HookResponse = HookAllowResponse | HookBlockResponse;

/**
 * Split a compound command into individual command segments.
 *
 * Handles command chaining (&&, ||, ;) but not pipes (those are single commands).
 *
 * @param commandString - The full shell command
 * @returns List of individual command segments
 */
export function splitCommandSegments(commandString: string): string[] {
	// Split on && and || while preserving the ability to handle each segment
	// This regex splits on && or || that aren't inside quotes
	const segments = commandString.split(/\s*(?:&&|\|\|)\s*/);

	// Further split on semicolons
	const result: string[] = [];
	for (const segment of segments) {
		const subSegments = segment.split(/(?<!["\'])\s*;\s*(?!["\'])/);
		for (const sub of subSegments) {
			const trimmed = sub.trim();
			if (trimmed) {
				result.push(trimmed);
			}
		}
	}

	return result;
}

/**
 * Parse a shell command string into tokens, handling quotes and escapes.
 * Simple implementation of shell lexing similar to Python's shlex.split.
 *
 * @param str - The command string to parse
 * @returns Array of tokens
 * @throws Error if the command has unclosed quotes
 */
function shellSplit(str: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let inQuote: string | null = null;
	let escaped = false;

	for (let i = 0; i < str.length; i++) {
		const char = str[i];

		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}

		if (char === "\\") {
			escaped = true;
			continue;
		}

		if (inQuote) {
			if (char === inQuote) {
				inQuote = null;
			} else {
				current += char;
			}
			continue;
		}

		if (char === '"' || char === "'") {
			inQuote = char;
			continue;
		}

		if (char === " " || char === "\t" || char === "\n") {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}

		current += char;
	}

	if (inQuote) {
		throw new Error(`Unclosed quote: ${inQuote}`);
	}

	if (current) {
		tokens.push(current);
	}

	return tokens;
}

/**
 * Extract command names from a shell command string.
 *
 * Handles pipes, command chaining (&&, ||, ;), and subshells.
 * Returns the base command names (without paths).
 *
 * @param commandString - The full shell command
 * @returns List of command names found in the string
 */
export function extractCommands(commandString: string): string[] {
	const commands: string[] = [];

	// Split on semicolons that aren't inside quotes (simple heuristic)
	// This handles common cases like "echo hello; ls"
	const segments = commandString.split(/(?<!["\'])\s*;\s*(?!["\'])/);

	for (const segment of segments) {
		const trimmedSegment = segment.trim();
		if (!trimmedSegment) {
			continue;
		}

		let tokens: string[];
		try {
			tokens = shellSplit(trimmedSegment);
		} catch {
			// Malformed command (unclosed quotes, etc.)
			// Return empty to trigger block (fail-safe)
			return [];
		}

		if (tokens.length === 0) {
			continue;
		}

		// Track when we expect a command vs arguments
		let expectCommand = true;

		for (const token of tokens) {
			// Shell operators indicate a new command follows
			if (["|", "||", "&&", "&"].includes(token)) {
				expectCommand = true;
				continue;
			}

			// Skip shell keywords that precede commands
			if (
				[
					"if",
					"then",
					"else",
					"elif",
					"fi",
					"for",
					"while",
					"until",
					"do",
					"done",
					"case",
					"esac",
					"in",
					"!",
					"{",
					"}",
				].includes(token)
			) {
				continue;
			}

			// Skip flags/options
			if (token.startsWith("-")) {
				continue;
			}

			// Skip variable assignments (VAR=value)
			if (token.includes("=") && !token.startsWith("=")) {
				continue;
			}

			if (expectCommand) {
				// Extract the base command name (handle paths like /usr/bin/python)
				const cmd = token.split("/").pop() || token;
				commands.push(cmd);
				expectCommand = false;
			}
		}
	}

	return commands;
}

/**
 * Validate pkill commands - only allow killing dev-related processes.
 *
 * Uses shell parsing to parse the command, avoiding regex bypass vulnerabilities.
 *
 * @param commandString - The pkill command to validate
 * @returns Validation result with allowed flag and reason if blocked
 */
export function validatePkillCommand(commandString: string): ValidationResult {
	// Allowed process names for pkill
	const allowedProcessNames = new Set(["node", "npm", "npx", "vite", "next"]);

	let tokens: string[];
	try {
		tokens = shellSplit(commandString);
	} catch {
		return { allowed: false, reason: "Could not parse pkill command" };
	}

	if (tokens.length === 0) {
		return { allowed: false, reason: "Empty pkill command" };
	}

	// Separate flags from arguments
	const args: string[] = [];
	for (const token of tokens.slice(1)) {
		if (!token.startsWith("-")) {
			args.push(token);
		}
	}

	if (args.length === 0) {
		return { allowed: false, reason: "pkill requires a process name" };
	}

	// The target is typically the last non-flag argument
	let target = args[args.length - 1];

	if (!target) {
		return { allowed: false, reason: "pkill requires a process name" };
	}

	// For -f flag (full command line match), extract the first word as process name
	// e.g., "pkill -f 'node server.js'" -> target is "node server.js", process is "node"
	if (target.includes(" ")) {
		const firstWord = target.split(" ")[0];
		if (firstWord) {
			target = firstWord;
		}
	}

	if (allowedProcessNames.has(target)) {
		return { allowed: true, reason: "" };
	}

	return {
		allowed: false,
		reason: `pkill only allowed for dev processes: ${Array.from(allowedProcessNames).join(", ")}`,
	};
}

/**
 * Validate chmod commands - only allow making files executable with +x.
 *
 * @param commandString - The chmod command to validate
 * @returns Validation result with allowed flag and reason if blocked
 */
export function validateChmodCommand(commandString: string): ValidationResult {
	let tokens: string[];
	try {
		tokens = shellSplit(commandString);
	} catch {
		return { allowed: false, reason: "Could not parse chmod command" };
	}

	if (tokens.length === 0 || tokens[0] !== "chmod") {
		return { allowed: false, reason: "Not a chmod command" };
	}

	// Look for the mode argument
	// Valid modes: +x, u+x, a+x, etc. (anything ending with +x for execute permission)
	let mode: string | null = null;
	const files: string[] = [];

	for (const token of tokens.slice(1)) {
		if (token.startsWith("-")) {
			// Skip flags like -R (we don't allow recursive chmod anyway)
			return { allowed: false, reason: "chmod flags are not allowed" };
		}
		if (mode === null) {
			mode = token;
		} else {
			files.push(token);
		}
	}

	if (mode === null) {
		return { allowed: false, reason: "chmod requires a mode" };
	}

	if (files.length === 0) {
		return { allowed: false, reason: "chmod requires at least one file" };
	}

	// Only allow +x variants (making files executable)
	// This matches: +x, u+x, g+x, o+x, a+x, ug+x, etc.
	const modePattern = /^[ugoa]*\+x$/;
	if (!modePattern.test(mode)) {
		return { allowed: false, reason: `chmod only allowed with +x mode, got: ${mode}` };
	}

	return { allowed: true, reason: "" };
}

/**
 * Validate init.sh script execution - only allow ./init.sh.
 *
 * @param commandString - The init script command to validate
 * @returns Validation result with allowed flag and reason if blocked
 */
export function validateInitScript(commandString: string): ValidationResult {
	let tokens: string[];
	try {
		tokens = shellSplit(commandString);
	} catch {
		return { allowed: false, reason: "Could not parse init script command" };
	}

	if (tokens.length === 0) {
		return { allowed: false, reason: "Empty command" };
	}

	// The command should be exactly ./init.sh (possibly with arguments)
	const script = tokens[0];

	if (!script) {
		return { allowed: false, reason: "Empty command" };
	}

	// Allow ./init.sh or paths ending in /init.sh
	if (script === "./init.sh" || script.endsWith("/init.sh")) {
		return { allowed: true, reason: "" };
	}

	return { allowed: false, reason: `Only ./init.sh is allowed, got: ${script}` };
}

/**
 * Find the specific command segment that contains the given command.
 *
 * @param cmd - The command name to find
 * @param segments - List of command segments
 * @returns The segment containing the command, or empty string if not found
 */
export function getCommandForValidation(cmd: string, segments: string[]): string {
	for (const segment of segments) {
		const segmentCommands = extractCommands(segment);
		if (segmentCommands.includes(cmd)) {
			return segment;
		}
	}
	return "";
}

/**
 * Pre-tool-use hook that validates bash commands using an allowlist.
 *
 * Only commands in ALLOWED_COMMANDS are permitted.
 *
 * @param inputData - Dict containing tool_name and tool_input
 * @param toolUseId - Optional tool use ID
 * @param context - Optional context
 * @returns Empty object to allow, or object with decision "block" and reason to block
 */
export function bashSecurityHook(
	inputData: HookInputData,
	_toolUseId: string | null = null,
	_context: unknown = null,
): HookResponse {
	if (inputData.tool_name !== "Bash") {
		return {};
	}

	const command = inputData.tool_input?.command ?? "";
	if (!command) {
		return {};
	}

	// Extract all commands from the command string
	const commands = extractCommands(command);

	if (commands.length === 0) {
		// Could not parse - fail safe by blocking
		return {
			decision: "block",
			reason: `Could not parse command for security validation: ${command}`,
		};
	}

	// Split into segments for per-command validation
	const segments = splitCommandSegments(command);

	// Check each command against the allowlist
	for (const cmd of commands) {
		if (!ALLOWED_COMMANDS.has(cmd)) {
			return {
				decision: "block",
				reason: `Command '${cmd}' is not in the allowed commands list`,
			};
		}

		// Additional validation for sensitive commands
		if (COMMANDS_NEEDING_EXTRA_VALIDATION.has(cmd)) {
			// Find the specific segment containing this command
			let cmdSegment = getCommandForValidation(cmd, segments);
			if (!cmdSegment) {
				cmdSegment = command; // Fallback to full command
			}

			let validationResult: ValidationResult;

			if (cmd === "pkill") {
				validationResult = validatePkillCommand(cmdSegment);
				if (!validationResult.allowed) {
					return { decision: "block", reason: validationResult.reason };
				}
			} else if (cmd === "chmod") {
				validationResult = validateChmodCommand(cmdSegment);
				if (!validationResult.allowed) {
					return { decision: "block", reason: validationResult.reason };
				}
			} else if (cmd === "init.sh") {
				validationResult = validateInitScript(cmdSegment);
				if (!validationResult.allowed) {
					return { decision: "block", reason: validationResult.reason };
				}
			}
		}
	}

	return {};
}
