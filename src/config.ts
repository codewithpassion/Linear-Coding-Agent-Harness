/**
 * Configuration File Management
 *
 * Handles loading and saving of .coding-agent.config.json files
 * for persistent provider preferences and configuration.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ProviderType } from "./providers/types.js";

/**
 * Configuration file name
 */
export const CONFIG_FILE_NAME = ".coding-agent.config.json";

/**
 * Coding Agent Configuration Schema
 *
 * Stores user preferences and provider-specific settings.
 * This file is created in the project directory on first initialization.
 */
export interface CodingAgentConfig {
	/** The selected project management provider */
	provider: ProviderType;

	/** Linear-specific configuration (optional) */
	linear?: {
		/** API key override (falls back to LINEAR_API_KEY env var) */
		apiKey?: string;
	};

	/** Beads-specific configuration (optional) */
	beads?: {
		/** Custom path to bd binary (falls back to system PATH) */
		bdPath?: string;
	};

	/** Plane.so-specific configuration (optional) */
	plane?: {
		/** API key override (falls back to PLANE_API_KEY env var) */
		apiKey?: string;

		/** Base URL for self-hosted Plane instances */
		baseUrl?: string;

		/** Default workspace slug to use */
		workspaceSlug?: string;
	};
}

/**
 * Load configuration from project directory
 *
 * @param projectDir - Absolute path to project directory
 * @returns Configuration object or null if file doesn't exist
 */
export async function loadConfig(projectDir: string): Promise<CodingAgentConfig | null> {
	const configPath = join(projectDir, CONFIG_FILE_NAME);

	if (!existsSync(configPath)) {
		return null;
	}

	try {
		const file = Bun.file(configPath);
		const content = await file.text();
		const config = JSON.parse(content) as CodingAgentConfig;

		// Validate provider field
		if (!config.provider || !["linear", "beads", "plane"].includes(config.provider)) {
			console.warn(
				`Warning: Invalid provider "${config.provider}" in ${CONFIG_FILE_NAME}. Ignoring config.`,
			);
			return null;
		}

		return config;
	} catch (error) {
		console.warn(
			`Warning: Failed to parse ${CONFIG_FILE_NAME}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

/**
 * Save configuration to project directory
 *
 * @param projectDir - Absolute path to project directory
 * @param config - Configuration to save
 */
export async function saveConfig(projectDir: string, config: CodingAgentConfig): Promise<void> {
	const configPath = join(projectDir, CONFIG_FILE_NAME);

	try {
		const content = JSON.stringify(config, null, 2);
		await Bun.write(configPath, content);
	} catch (error) {
		throw new Error(
			`Failed to write ${CONFIG_FILE_NAME}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
