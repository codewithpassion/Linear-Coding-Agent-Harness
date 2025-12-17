/**
 * Browser Provider Factory
 * =========================
 *
 * Factory functions for creating and auto-detecting browser providers.
 * Follows the same pattern as src/providers/factory.ts for project management providers.
 */

import { loadConfig } from "../config.js";
import { ChromeDevToolsProvider } from "./chrome-devtools-provider.js";
import { PuppeteerProvider } from "./puppeteer-provider.js";
import type { BrowserProvider, BrowserProviderType } from "./types.js";

/**
 * Create a browser provider instance based on type.
 *
 * @param type - The browser provider type to create
 * @param browserUrl - Optional browser URL (for Chrome DevTools)
 * @returns Browser provider instance
 * @throws {Error} If provider type is unknown
 *
 * @example
 * ```typescript
 * const provider = createBrowserProvider("puppeteer");
 * const cdpProvider = createBrowserProvider("chrome-devtools", "http://localhost:9222");
 * ```
 */
export function createBrowserProvider(
	type: BrowserProviderType,
	browserUrl?: string,
): BrowserProvider {
	switch (type) {
		case "puppeteer":
			return new PuppeteerProvider();
		case "chrome-devtools":
			return new ChromeDevToolsProvider(browserUrl);
		default: {
			// TypeScript exhaustiveness check
			const _exhaustive: never = type;
			throw new Error(`Unknown browser provider: ${String(_exhaustive)}`);
		}
	}
}

/**
 * Detect which browser provider to use based on configuration.
 *
 * Detection precedence (highest to lowest):
 * 1. CLI flag (--browser chrome-devtools)
 * 2. Config file (.coding-agent.config.json)
 * 3. Environment variable (BROWSER_PROVIDER)
 * 4. Default (chrome-devtools)
 *
 * @param projectDir - Absolute path to project directory
 * @param cliBrowser - Browser provider from CLI flag (highest priority)
 * @param defaultBrowser - Default provider to use (default: chrome-devtools)
 * @returns The detected browser provider type
 *
 * @example
 * ```typescript
 * // CLI takes precedence
 * const type = await detectBrowserProvider("/project", "puppeteer"); // Returns "puppeteer"
 *
 * // Falls back to config file
 * const type = await detectBrowserProvider("/project"); // Returns config.browser or default
 * ```
 */
export async function detectBrowserProvider(
	projectDir: string,
	cliBrowser?: BrowserProviderType,
	defaultBrowser: BrowserProviderType = "chrome-devtools",
): Promise<BrowserProviderType> {
	// 1. CLI flag has highest priority
	if (cliBrowser) {
		return cliBrowser;
	}

	// 2. Check config file
	const config = await loadConfig(projectDir);
	if (config?.browser) {
		return config.browser;
	}

	// 3. Check environment variable
	const envBrowser = process.env["BROWSER_PROVIDER"];
	if (envBrowser && (envBrowser === "puppeteer" || envBrowser === "chrome-devtools")) {
		return envBrowser;
	}

	// 4. Use default
	return defaultBrowser;
}

/**
 * Detect browser provider and create an instance in one step.
 *
 * Convenience function that combines detection and creation.
 *
 * @param projectDir - Absolute path to project directory
 * @param cliBrowser - Optional browser provider from CLI flag
 * @param browserUrl - Optional browser URL (for Chrome DevTools)
 * @returns Browser provider instance
 *
 * @example
 * ```typescript
 * const provider = await detectAndCreateBrowserProvider("/project");
 * const cdpProvider = await detectAndCreateBrowserProvider("/project", "chrome-devtools", "http://localhost:9222");
 * ```
 */
export async function detectAndCreateBrowserProvider(
	projectDir: string,
	cliBrowser?: BrowserProviderType,
	browserUrl?: string,
): Promise<BrowserProvider> {
	const browserType = await detectBrowserProvider(projectDir, cliBrowser);
	return createBrowserProvider(browserType, browserUrl);
}
