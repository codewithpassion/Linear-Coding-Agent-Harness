/**
 * Provider Factory and Auto-Detection
 *
 * Creates provider instances and detects which provider a project uses
 * based on marker files and configuration.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import type { ProjectManagementProvider, ProviderType } from "./types.js";

import { BeadsProvider } from "./beads-provider.js";
// Provider implementations
import { LinearProvider } from "./linear-provider.js";
import { PlaneProvider } from "./plane-provider.js";

/**
 * Create a provider instance by type
 *
 * @param type - The provider type to instantiate
 * @returns Provider instance
 * @throws {Error} If provider type is unknown or not implemented yet
 */
export function createProvider(type: ProviderType): ProjectManagementProvider {
	switch (type) {
		case "linear":
			return new LinearProvider();

		case "beads":
			return new BeadsProvider();

		case "plane":
			return new PlaneProvider();

		default: {
			// TypeScript should ensure this is unreachable, but provide runtime safety
			const exhaustiveCheck: never = type;
			throw new Error(`Unknown provider type: ${exhaustiveCheck}`);
		}
	}
}

/**
 * Detect which provider a project is using
 *
 * Detection precedence (highest to lowest):
 * 1. Marker files (.linear_project.json, .beads/issues.jsonl, .plane_project.json)
 * 2. Config file (.coding-agent.config.json)
 * 3. Return null (caller should use default or CLI flag)
 *
 * @param projectDir - Absolute path to project directory
 * @returns The detected provider type or null if none detected
 */
export async function detectProvider(projectDir: string): Promise<ProviderType | null> {
	// Priority 1: Check for marker files
	// These are the strongest signal of which provider is in use

	const linearMarker = join(projectDir, ".linear_project.json");
	if (existsSync(linearMarker)) {
		console.log("Detected Linear project (.linear_project.json found)");
		return "linear";
	}

	const beadsMarker = join(projectDir, ".beads", "issues.jsonl");
	if (existsSync(beadsMarker)) {
		console.log("Detected Beads project (.beads/issues.jsonl found)");
		return "beads";
	}

	const planeMarker = join(projectDir, ".plane_project.json");
	if (existsSync(planeMarker)) {
		console.log("Detected Plane project (.plane_project.json found)");
		return "plane";
	}

	// Priority 2: Check config file
	const config = await loadConfig(projectDir);
	if (config?.provider) {
		console.log(`Provider '${config.provider}' specified in .coding-agent.config.json`);
		return config.provider;
	}

	// Priority 3: No detection - return null
	// Caller will handle default or use CLI flag
	return null;
}

/**
 * Detect provider and create instance, with fallback to default
 *
 * @param projectDir - Absolute path to project directory
 * @param cliProvider - Optional provider from CLI flag (--provider)
 * @param defaultProvider - Fallback provider if none detected (default: "linear")
 * @returns Provider instance
 */
export async function detectAndCreateProvider(
	projectDir: string,
	cliProvider?: ProviderType,
	defaultProvider: ProviderType = "linear",
): Promise<ProjectManagementProvider> {
	// Detection precedence:
	// 1. Detected from marker files (highest priority)
	// 2. CLI flag (--provider)
	// 3. Default (linear)

	const detectedProvider = await detectProvider(projectDir);

	let selectedProvider: ProviderType;

	if (detectedProvider) {
		// Marker file found - use it
		selectedProvider = detectedProvider;

		// Warn if CLI flag conflicts with detected provider
		if (cliProvider && cliProvider !== detectedProvider) {
			console.warn(`Warning: Project already initialized with '${detectedProvider}' provider.`);
			console.warn(`Ignoring --provider ${cliProvider} flag to avoid data corruption.`);
			console.warn("To use a different provider, create a new project directory.");
		}
	} else if (cliProvider) {
		// No marker file, use CLI flag
		selectedProvider = cliProvider;
		console.log(`Using '${cliProvider}' provider (from --provider flag)`);
	} else {
		// No detection, no CLI flag - use default
		selectedProvider = defaultProvider;
		console.log(`Using default provider '${defaultProvider}' (no provider detected)`);
	}

	return createProvider(selectedProvider);
}
