/**
 * Interactive Configuration Initialization
 *
 * Provides an interactive CLI flow for creating/updating .coding-agent.config.json files.
 * Prompts users for provider selection, provider-specific settings, and browser preferences.
 */

import { existsSync } from "node:fs";
import * as readline from "node:readline/promises";
import type { BrowserProviderType } from "./browser-providers/types.js";
import {
	CONFIG_FILE_NAME,
	type CodingAgentConfig,
	loadConfig,
	saveConfig,
} from "./config.js";
import type { ProviderType } from "./providers/types.js";

/**
 * Interactive configuration builder
 */
export class ConfigInitializer {
	private rl: readline.Interface;

	constructor() {
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
	}

	/**
	 * Prompt user with a question and optional default value
	 */
	private async prompt(question: string, defaultValue?: string): Promise<string> {
		const suffix = defaultValue ? ` (default: ${defaultValue})` : "";
		const answer = await this.rl.question(`${question}${suffix}: `);
		return answer.trim() || defaultValue || "";
	}

	/**
	 * Prompt user to select from multiple options
	 */
	private async select(
		question: string,
		options: readonly string[],
		defaultValue?: string,
	): Promise<string> {
		console.log(`\n${question}`);
		for (let i = 0; i < options.length; i++) {
			const option = options[i];
			const isDefault = option === defaultValue;
			console.log(`  ${i + 1}. ${option}${isDefault ? " (default)" : ""}`);
		}

		const answer = await this.prompt("Enter number", defaultValue ? "1" : undefined);
		const index = Number.parseInt(answer, 10) - 1;

		if (Number.isNaN(index) || index < 0 || index >= options.length) {
			if (defaultValue) {
				return defaultValue;
			}
			throw new Error("Invalid selection");
		}

		const selected = options[index];
		if (!selected) {
			throw new Error("Invalid selection");
		}

		return selected;
	}

	/**
	 * Prompt user for yes/no question
	 */
	private async confirm(question: string, defaultValue = false): Promise<boolean> {
		const suffix = defaultValue ? " (Y/n)" : " (y/N)";
		const answer = await this.rl.question(`${question}${suffix}: `);
		const normalized = answer.trim().toLowerCase();

		if (normalized === "") {
			return defaultValue;
		}

		return normalized === "y" || normalized === "yes";
	}

	/**
	 * Run the interactive configuration flow
	 */
	async run(projectDir: string): Promise<void> {
		try {
			console.log("\n🔧 Coding Agent Configuration Initializer");
			console.log("==========================================\n");

			// Check for existing config
			const existingConfig = await loadConfig(projectDir);
			const isUpdate = existingConfig !== null;

			if (isUpdate) {
				console.log(`Found existing configuration in ${CONFIG_FILE_NAME}\n`);
				const shouldUpdate = await this.confirm("Update existing configuration?", true);
				if (!shouldUpdate) {
					console.log("Configuration unchanged.");
					return;
				}
			}

			// Build new configuration
			const config: CodingAgentConfig = await this.buildConfig(existingConfig);

			// Preview configuration
			console.log("\n📋 Configuration Preview:");
			console.log("========================");
			console.log(JSON.stringify(config, null, 2));

			// Confirm save
			const shouldSave = await this.confirm("\nSave this configuration?", true);
			if (!shouldSave) {
				console.log("Configuration not saved.");
				return;
			}

			// Save configuration
			await saveConfig(projectDir, config);
			console.log(`\n✅ Configuration saved to ${projectDir}/${CONFIG_FILE_NAME}`);

			// Print next steps
			this.printNextSteps(config);
		} finally {
			this.rl.close();
		}
	}

	/**
	 * Build configuration object through interactive prompts
	 */
	private async buildConfig(
		existing: CodingAgentConfig | null,
	): Promise<CodingAgentConfig> {
		// Select provider
		const provider = (await this.select(
			"Select project management provider:",
			["linear", "beads", "plane"] as const,
			existing?.provider || "linear",
		)) as ProviderType;

		// Select browser provider
		const browser = (await this.select(
			"Select browser automation provider:",
			["chrome-devtools", "puppeteer"] as const,
			existing?.browser || "chrome-devtools",
		)) as BrowserProviderType;

		// Build base config
		const config: CodingAgentConfig = {
			provider,
			browser,
		};

		// Provider-specific configuration
		switch (provider) {
			case "linear":
				await this.configureLinear(config, existing);
				break;
			case "beads":
				await this.configureBeads(config, existing);
				break;
			case "plane":
				await this.configurePlane(config, existing);
				break;
		}

		// Browser-specific configuration
		if (browser === "chrome-devtools") {
			await this.configureChromeDevTools(config, existing);
		}

		return config;
	}

	/**
	 * Configure Linear-specific settings
	 */
	private async configureLinear(
		config: CodingAgentConfig,
		existing: CodingAgentConfig | null,
	): Promise<void> {
		console.log("\n📌 Linear Configuration");
		console.log("Note: LINEAR_API_KEY can also be set via environment variable");

		const configureApiKey = await this.confirm("Set Linear API key in config file?", false);
		if (configureApiKey) {
			const apiKey = await this.prompt(
				"Linear API key",
				existing?.linear?.apiKey || process.env["LINEAR_API_KEY"],
			);
			if (apiKey) {
				config.linear = { apiKey };
			}
		}
	}

	/**
	 * Configure Beads-specific settings
	 */
	private async configureBeads(
		config: CodingAgentConfig,
		existing: CodingAgentConfig | null,
	): Promise<void> {
		console.log("\n📌 Beads Configuration");
		console.log("Note: Beads works offline and requires no API keys");

		const configureCustomPath = await this.confirm(
			"Use custom path to bd CLI?",
			!!existing?.beads?.bdPath,
		);
		if (configureCustomPath) {
			const bdPath = await this.prompt(
				"Path to bd binary",
				existing?.beads?.bdPath || "bd",
			);
			if (bdPath && bdPath !== "bd") {
				config.beads = { bdPath };
			}
		}
	}

	/**
	 * Configure Plane-specific settings
	 */
	private async configurePlane(
		config: CodingAgentConfig,
		existing: CodingAgentConfig | null,
	): Promise<void> {
		console.log("\n📌 Plane Configuration");
		console.log("Note: PLANE_API_KEY can also be set via environment variable");

		// API Key
		const configureApiKey = await this.confirm("Set Plane API key in config file?", false);
		let apiKey: string | undefined;
		if (configureApiKey) {
			apiKey = await this.prompt(
				"Plane API key",
				existing?.plane?.apiKey || process.env["PLANE_API_KEY"],
			);
		}

		// Workspace slug (required)
		const workspaceSlug = await this.prompt(
			"Workspace slug (required)",
			existing?.plane?.workspaceSlug,
		);

		if (!workspaceSlug) {
			throw new Error("Workspace slug is required for Plane");
		}

		// Base URL (optional, for self-hosted)
		const configureSelfHosted = await this.confirm(
			"Using self-hosted Plane instance?",
			!!existing?.plane?.baseUrl,
		);

		let baseUrl: string | undefined;
		if (configureSelfHosted) {
			baseUrl = await this.prompt(
				"Plane base URL",
				existing?.plane?.baseUrl || "https://api.plane.so",
			);
		}

		// Build Plane config
		config.plane = {
			workspaceSlug,
			...(apiKey && { apiKey }),
			...(baseUrl && baseUrl !== "https://api.plane.so" && { baseUrl }),
		};
	}

	/**
	 * Configure Chrome DevTools-specific settings
	 */
	private async configureChromeDevTools(
		config: CodingAgentConfig,
		existing: CodingAgentConfig | null,
	): Promise<void> {
		console.log("\n📌 Chrome DevTools Configuration");
		console.log("Note: Chrome will be auto-launched if not running");

		const configureCustomUrl = await this.confirm(
			"Use custom Chrome debugging URL?",
			!!existing?.chromeDevTools?.browserUrl,
		);

		if (configureCustomUrl) {
			const browserUrl = await this.prompt(
				"Chrome DevTools URL",
				existing?.chromeDevTools?.browserUrl || "http://localhost:9222",
			);
			if (browserUrl && browserUrl !== "http://localhost:9222") {
				config.chromeDevTools = { browserUrl };
			}
		}
	}

	/**
	 * Print next steps after configuration
	 */
	private printNextSteps(config: CodingAgentConfig): void {
		console.log("\n📚 Next Steps:");
		console.log("==============");

		// Environment variable reminders
		const envVars: string[] = ["CLAUDE_CODE_OAUTH_TOKEN"];

		switch (config.provider) {
			case "linear":
				if (!config.linear?.apiKey) {
					envVars.push("LINEAR_API_KEY");
				}
				break;
			case "plane":
				if (!config.plane?.apiKey) {
					envVars.push("PLANE_API_KEY");
				}
				break;
			case "beads":
				console.log("\n1. Install Beads CLI:");
				console.log("   npm install -g @beads/bd");
				break;
		}

		if (envVars.length > 0) {
			console.log("\n1. Set required environment variables:");
			for (const envVar of envVars) {
				console.log(`   export ${envVar}='your-value-here'`);
			}
		}

		console.log("\n2. Run the agent:");
		console.log("   bun run src/index.ts --project-dir <your-project-dir>");

		console.log("\n3. Or update this config later:");
		console.log("   bun run src/index.ts --init --project-dir <your-project-dir>");
	}

	/**
	 * Close the readline interface
	 */
	close(): void {
		this.rl.close();
	}
}

/**
 * Run the interactive configuration initializer
 *
 * @param projectDir - Absolute path to project directory
 */
export async function initializeConfig(projectDir: string): Promise<void> {
	// Ensure project directory exists
	if (!existsSync(projectDir)) {
		throw new Error(
			`Project directory does not exist: ${projectDir}\nCreate it first with: mkdir -p ${projectDir}`,
		);
	}

	const initializer = new ConfigInitializer();
	await initializer.run(projectDir);
}
