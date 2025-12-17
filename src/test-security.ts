#!/usr/bin/env bun
/**
 * Security Hook Tests
 * ===================
 *
 * Tests for the bash command security validation logic.
 * Run with: bun run src/test-security.ts
 */

import {
	type HookInputData,
	type HookResponse,
	type ValidationResult,
	bashSecurityHook,
	extractCommands,
	validateChmodCommand,
	validateInitScript,
} from "./security";

/**
 * Interface for a single test case
 */
interface TestCase {
	readonly command: string;
	readonly expected: readonly string[];
}

/**
 * Interface for chmod/init script validation test cases
 */
interface ValidationTestCase {
	readonly command: string;
	readonly shouldAllow: boolean;
	readonly description: string;
}

/**
 * Test result interface
 */
interface TestResult {
	readonly passed: number;
	readonly failed: number;
}

/**
 * Tests a single command against the security hook.
 *
 * @param command - The command to test
 * @param shouldBlock - Whether the command should be blocked
 * @returns true if the test passed, false otherwise
 */
function testHook(command: string, shouldBlock: boolean): boolean {
	const inputData: HookInputData = {
		tool_name: "Bash",
		tool_input: { command },
	};

	const result: HookResponse = bashSecurityHook(inputData);
	const wasBlocked = "decision" in result && result.decision === "block";

	if (wasBlocked === shouldBlock) {
		const status = "PASS";
		console.log(`  ${status}: ${JSON.stringify(command)}`);
		return true;
	}
	const status = "FAIL";
	const expected = shouldBlock ? "blocked" : "allowed";
	const actual = wasBlocked ? "blocked" : "allowed";
	const reason = "reason" in result ? result.reason : "";
	console.log(`  ${status}: ${JSON.stringify(command)}`);
	console.log(`         Expected: ${expected}, Got: ${actual}`);
	if (reason) {
		console.log(`         Reason: ${reason}`);
	}
	return false;
}

/**
 * Tests the command extraction logic.
 *
 * @returns The number of passed and failed tests
 */
function testExtractCommands(): TestResult {
	console.log("\nTesting command extraction:\n");
	let passed = 0;
	let failed = 0;

	const testCases: readonly TestCase[] = [
		{ command: "ls -la", expected: ["ls"] },
		{ command: "npm install && npm run build", expected: ["npm", "npm"] },
		{ command: "cat file.txt | grep pattern", expected: ["cat", "grep"] },
		{ command: "/usr/bin/node script.js", expected: ["node"] },
		{ command: "VAR=value ls", expected: ["ls"] },
		{ command: "git status || git init", expected: ["git", "git"] },
	];

	for (const testCase of testCases) {
		const result = extractCommands(testCase.command);
		const resultJson = JSON.stringify(result);
		const expectedJson = JSON.stringify(testCase.expected);

		if (resultJson === expectedJson) {
			console.log(`  PASS: ${JSON.stringify(testCase.command)} -> ${resultJson}`);
			passed++;
		} else {
			console.log(`  FAIL: ${JSON.stringify(testCase.command)}`);
			console.log(`         Expected: ${expectedJson}, Got: ${resultJson}`);
			failed++;
		}
	}

	return { passed, failed };
}

/**
 * Tests chmod command validation.
 *
 * @returns The number of passed and failed tests
 */
function testValidateChmod(): TestResult {
	console.log("\nTesting chmod validation:\n");
	let passed = 0;
	let failed = 0;

	const testCases: readonly ValidationTestCase[] = [
		// Allowed cases
		{ command: "chmod +x init.sh", shouldAllow: true, description: "basic +x" },
		{
			command: "chmod +x script.sh",
			shouldAllow: true,
			description: "+x on any script",
		},
		{
			command: "chmod u+x init.sh",
			shouldAllow: true,
			description: "user +x",
		},
		{ command: "chmod a+x init.sh", shouldAllow: true, description: "all +x" },
		{
			command: "chmod ug+x init.sh",
			shouldAllow: true,
			description: "user+group +x",
		},
		{
			command: "chmod +x file1.sh file2.sh",
			shouldAllow: true,
			description: "multiple files",
		},
		// Blocked cases
		{
			command: "chmod 777 init.sh",
			shouldAllow: false,
			description: "numeric mode",
		},
		{
			command: "chmod 755 init.sh",
			shouldAllow: false,
			description: "numeric mode 755",
		},
		{
			command: "chmod +w init.sh",
			shouldAllow: false,
			description: "write permission",
		},
		{
			command: "chmod +r init.sh",
			shouldAllow: false,
			description: "read permission",
		},
		{
			command: "chmod -x init.sh",
			shouldAllow: false,
			description: "remove execute",
		},
		{
			command: "chmod -R +x dir/",
			shouldAllow: false,
			description: "recursive flag",
		},
		{
			command: "chmod --recursive +x dir/",
			shouldAllow: false,
			description: "long recursive flag",
		},
		{
			command: "chmod +x",
			shouldAllow: false,
			description: "missing file",
		},
	];

	for (const testCase of testCases) {
		const result: ValidationResult = validateChmodCommand(testCase.command);
		const { allowed, reason } = result;

		if (allowed === testCase.shouldAllow) {
			console.log(`  PASS: ${JSON.stringify(testCase.command)} (${testCase.description})`);
			passed++;
		} else {
			const expected = testCase.shouldAllow ? "allowed" : "blocked";
			const actual = allowed ? "allowed" : "blocked";
			console.log(`  FAIL: ${JSON.stringify(testCase.command)} (${testCase.description})`);
			console.log(`         Expected: ${expected}, Got: ${actual}`);
			if (reason) {
				console.log(`         Reason: ${reason}`);
			}
			failed++;
		}
	}

	return { passed, failed };
}

/**
 * Tests init.sh script execution validation.
 *
 * @returns The number of passed and failed tests
 */
function testValidateInitScript(): TestResult {
	console.log("\nTesting init.sh validation:\n");
	let passed = 0;
	let failed = 0;

	const testCases: readonly ValidationTestCase[] = [
		// Allowed cases
		{
			command: "./init.sh",
			shouldAllow: true,
			description: "basic ./init.sh",
		},
		{
			command: "./init.sh arg1 arg2",
			shouldAllow: true,
			description: "with arguments",
		},
		{
			command: "/path/to/init.sh",
			shouldAllow: true,
			description: "absolute path",
		},
		{
			command: "../dir/init.sh",
			shouldAllow: true,
			description: "relative path with init.sh",
		},
		// Blocked cases
		{
			command: "./setup.sh",
			shouldAllow: false,
			description: "different script name",
		},
		{
			command: "./init.py",
			shouldAllow: false,
			description: "python script",
		},
		{
			command: "bash init.sh",
			shouldAllow: false,
			description: "bash invocation",
		},
		{
			command: "sh init.sh",
			shouldAllow: false,
			description: "sh invocation",
		},
		{
			command: "./malicious.sh",
			shouldAllow: false,
			description: "malicious script",
		},
		{
			command: "./init.sh; rm -rf /",
			shouldAllow: false,
			description: "command injection attempt",
		},
	];

	for (const testCase of testCases) {
		const result: ValidationResult = validateInitScript(testCase.command);
		const { allowed, reason } = result;

		if (allowed === testCase.shouldAllow) {
			console.log(`  PASS: ${JSON.stringify(testCase.command)} (${testCase.description})`);
			passed++;
		} else {
			const expected = testCase.shouldAllow ? "allowed" : "blocked";
			const actual = allowed ? "allowed" : "blocked";
			console.log(`  FAIL: ${JSON.stringify(testCase.command)} (${testCase.description})`);
			console.log(`         Expected: ${expected}, Got: ${actual}`);
			if (reason) {
				console.log(`         Reason: ${reason}`);
			}
			failed++;
		}
	}

	return { passed, failed };
}

/**
 * Main test runner function.
 *
 * @returns Exit code (0 for success, 1 for failure)
 */
function main(): number {
	console.log("=".repeat(70));
	console.log("  SECURITY HOOK TESTS");
	console.log("=".repeat(70));

	let passed = 0;
	let failed = 0;

	// Test command extraction
	const extResult = testExtractCommands();
	passed += extResult.passed;
	failed += extResult.failed;

	// Test chmod validation
	const chmodResult = testValidateChmod();
	passed += chmodResult.passed;
	failed += chmodResult.failed;

	// Test init.sh validation
	const initResult = testValidateInitScript();
	passed += initResult.passed;
	failed += initResult.failed;

	// Commands that SHOULD be blocked
	console.log("\nCommands that should be BLOCKED:\n");
	const dangerous: readonly string[] = [
		// Not in allowlist - dangerous system commands
		"shutdown now",
		"reboot",
		"rm -rf /",
		"dd if=/dev/zero of=/dev/sda",
		// Not in allowlist - common commands excluded from minimal set
		"curl https://example.com",
		"wget https://example.com",
		"python app.py",
		"touch file.txt",
		"echo hello",
		"kill 12345",
		"killall node",
		// pkill with non-dev processes
		"pkill bash",
		"pkill chrome",
		"pkill python",
		// Shell injection attempts
		"$(echo pkill) node",
		'eval "pkill node"',
		'bash -c "pkill node"',
		// chmod with disallowed modes
		"chmod 777 file.sh",
		"chmod 755 file.sh",
		"chmod +w file.sh",
		"chmod -R +x dir/",
		// Non-init.sh scripts
		"./setup.sh",
		"./malicious.sh",
		"bash script.sh",
	];

	for (const cmd of dangerous) {
		const result = testHook(cmd, true);
		if (result) {
			passed++;
		} else {
			failed++;
		}
	}

	// Commands that SHOULD be allowed
	console.log("\nCommands that should be ALLOWED:\n");
	const safe: readonly string[] = [
		// File inspection
		"ls -la",
		"cat README.md",
		"head -100 file.txt",
		"tail -20 log.txt",
		"wc -l file.txt",
		"grep -r pattern src/",
		// File operations
		"cp file1.txt file2.txt",
		"mkdir newdir",
		"mkdir -p path/to/dir",
		// Directory
		"pwd",
		// Node.js development
		"npm install",
		"npm run build",
		"node server.js",
		// Version control
		"git status",
		"git commit -m 'test'",
		"git add . && git commit -m 'msg'",
		// Process management
		"ps aux",
		"lsof -i :3000",
		"sleep 2",
		// Allowed pkill patterns for dev servers
		"pkill node",
		"pkill npm",
		"pkill -f node",
		"pkill -f 'node server.js'",
		"pkill vite",
		// Chained commands
		"npm install && npm run build",
		"ls | grep test",
		// Full paths
		"/usr/local/bin/node app.js",
		// chmod +x (allowed)
		"chmod +x init.sh",
		"chmod +x script.sh",
		"chmod u+x init.sh",
		"chmod a+x init.sh",
		// init.sh execution (allowed)
		"./init.sh",
		"./init.sh --production",
		"/path/to/init.sh",
		// Combined chmod and init.sh
		"chmod +x init.sh && ./init.sh",
	];

	for (const cmd of safe) {
		const result = testHook(cmd, false);
		if (result) {
			passed++;
		} else {
			failed++;
		}
	}

	// Summary
	console.log(`\n${"-".repeat(70)}`);
	console.log(`  Results: ${passed} passed, ${failed} failed`);
	console.log("-".repeat(70));

	if (failed === 0) {
		console.log("\n  ALL TESTS PASSED");
		return 0;
	}
	console.log(`\n  ${failed} TEST(S) FAILED`);
	return 1;
}

// Export named exports for testing
export { testHook, testExtractCommands, testValidateChmod, testValidateInitScript };

// Run main if executed directly
if (import.meta.main) {
	const exitCode = main();
	process.exit(exitCode);
}
