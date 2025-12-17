/**
 * Browser Providers Module
 * =========================
 *
 * Export all browser provider implementations and utilities.
 * This module provides the strategy pattern for browser automation.
 */

export type {
	BrowserProvider,
	BrowserProviderType,
	BrowserToolCategory,
	BrowserToolDefinition,
} from "./types.js";

export { PuppeteerProvider } from "./puppeteer-provider.js";
export { ChromeDevToolsProvider } from "./chrome-devtools-provider.js";

export {
	createBrowserProvider,
	detectBrowserProvider,
	detectAndCreateBrowserProvider,
} from "./factory.js";
