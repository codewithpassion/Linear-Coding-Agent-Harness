/**
 * Progress Tracking Utilities
 * ===========================
 *
 * Provider-agnostic functions for displaying session information.
 * Progress tracking is now handled by individual providers.
 */

/**
 * Print a formatted header for the session.
 *
 * @param sessionNum - The current session number
 * @param isInitializer - Whether this is an initializer session
 *
 * @example
 * ```typescript
 * printSessionHeader(1, true);  // Prints "SESSION 1: INITIALIZER"
 * printSessionHeader(2, false); // Prints "SESSION 2: CODING AGENT"
 * ```
 */
export function printSessionHeader(sessionNum: number, isInitializer: boolean): void {
	const sessionType = isInitializer ? "INITIALIZER" : "CODING AGENT";

	console.log(`\n${"=".repeat(70)}`);
	console.log(`  SESSION ${sessionNum}: ${sessionType}`);
	console.log("=".repeat(70));
	console.log();
}
