/**
 * Template Engine for Dynamic Prompt Generation
 *
 * Uses Handlebars to generate prompts dynamically based on browser provider
 * and project management provider combinations, avoiding duplication.
 */

import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import type { BrowserProvider, BrowserToolDefinition } from "../browser-providers/types.js";
import type { ProjectManagementProvider } from "../providers/types.js";

/**
 * Context data passed to templates
 */
export interface TemplateContext {
	browser: {
		name: string;
		displayName: string;
		tools: BrowserToolDefinition[];
		variables: Record<string, string>;
	};
	provider: {
		name: string;
		displayName: string;
	};
}

/**
 * Template Engine using Handlebars
 *
 * Provides dynamic prompt generation with custom helpers for browser
 * and provider-specific content.
 */
export class TemplateEngine {
	private handlebars: typeof Handlebars;
	private partialsDir: string;
	private templatesDir: string;
	private partialsLoaded = false;

	constructor() {
		this.handlebars = Handlebars.create();

		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		this.partialsDir = path.join(__dirname, "..", "..", "prompts", "templates", "partials");
		this.templatesDir = path.join(__dirname, "..", "..", "prompts", "templates");

		this.registerHelpers();
	}

	/**
	 * Register custom Handlebars helpers
	 */
	private registerHelpers(): void {
		// Helper: {{#ifBrowser "chrome-devtools"}}...{{/ifBrowser}}
		// Conditionally render content based on browser provider
		this.handlebars.registerHelper(
			"ifBrowser",
			function (this: unknown, browserName: string, options: Handlebars.HelperOptions) {
				const currentBrowser = options.data.root.browser?.name;
				if (currentBrowser === browserName) {
					return options.fn(this);
				}
				return options.inverse(this);
			},
		);

		// Helper: {{toolList browser.tools}}
		// Format tool list as markdown
		this.handlebars.registerHelper("toolList", (tools: BrowserToolDefinition[]) => {
			if (!tools || tools.length === 0) {
				return "No tools available";
			}

			return tools
				.map((tool) => {
					let line = `- \`${tool.name}\` - ${tool.description}`;
					if (tool.example) {
						line += `\n  Example: \`${tool.example}\``;
					}
					return line;
				})
				.join("\n");
		});

		// Helper: {{var browser.variables "navigate_tool"}}
		// Variable lookup with optional fallback
		this.handlebars.registerHelper(
			"var",
			(obj: Record<string, string>, key: string, fallback?: string) => {
				if (obj && typeof obj === "object" && key in obj) {
					return obj[key];
				}
				return fallback ?? `{{${key}}}`;
			},
		);
	}

	/**
	 * Load and register all partials from the partials directory
	 */
	private async registerPartials(): Promise<void> {
		if (this.partialsLoaded) {
			return;
		}

		try {
			const glob = new Bun.Glob("*.hbs");
			const files = await Array.fromAsync(glob.scan(this.partialsDir));

			for (const file of files) {
				const partialPath = path.join(this.partialsDir, file);
				const partialName = path.basename(file, ".hbs");

				const content = await Bun.file(partialPath).text();
				this.handlebars.registerPartial(partialName, content);
			}

			this.partialsLoaded = true;
		} catch (error) {
			// If partials directory doesn't exist, that's okay - just continue
			console.warn(`Warning: Could not load partials from ${this.partialsDir}:`, error);
			this.partialsLoaded = true;
		}
	}

	/**
	 * Render a template with the given context
	 *
	 * @param templateName - Name of the template file (without .hbs extension)
	 * @param context - Template context data
	 * @returns Rendered template content
	 */
	async render(templateName: string, context: TemplateContext): Promise<string> {
		// Ensure partials are loaded
		await this.registerPartials();

		const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);

		try {
			const templateContent = await Bun.file(templatePath).text();
			const template = this.handlebars.compile(templateContent);
			return template(context);
		} catch (error) {
			throw new Error(
				`Failed to render template "${templateName}": ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Build template context from providers
	 *
	 * @param browserProvider - Browser automation provider
	 * @param projectProvider - Project management provider
	 * @returns Template context ready for rendering
	 */
	static buildContext(
		browserProvider: BrowserProvider,
		projectProvider: ProjectManagementProvider,
	): TemplateContext {
		return {
			browser: {
				name: browserProvider.name,
				displayName: browserProvider.displayName,
				tools: browserProvider.getToolDefinitions(),
				variables: browserProvider.getTemplateVariables(),
			},
			provider: {
				name: projectProvider.name,
				displayName: projectProvider.name, // Can be enhanced later with a display name field
			},
		};
	}
}
