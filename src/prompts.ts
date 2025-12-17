/**
 * Prompt Loading Utilities
 * =========================
 *
 * Functions for loading prompt templates from the prompts directory.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Get the directory path of the current module
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path to the prompts directory
 */
const PROMPTS_DIR = path.join(__dirname, "..", "prompts");

/**
 * Load a prompt template from the prompts directory.
 *
 * @param name - The name of the prompt file (without the .md extension)
 * @returns The contents of the prompt file
 * @throws Error if the file cannot be read
 */
export async function loadPrompt(name: string): Promise<string> {
	const promptPath = path.join(PROMPTS_DIR, `${name}.md`);
	const file = Bun.file(promptPath);
	return await file.text();
}

/**
 * Load the initializer prompt.
 *
 * @returns The initializer prompt template
 * @throws Error if the file cannot be read
 */
export async function getInitializerPrompt(): Promise<string> {
	return await loadPrompt("initializer_prompt");
}

/**
 * Load the coding agent prompt.
 *
 * @returns The coding agent prompt template
 * @throws Error if the file cannot be read
 */
export async function getCodingPrompt(): Promise<string> {
	return await loadPrompt("coding_prompt");
}

/**
 * Copy the app spec file into the project directory for the agent to read.
 *
 * @param projectDir - The path to the project directory
 * @throws Error if the file cannot be copied
 */
export async function copySpecToProject(projectDir: string): Promise<void> {
	const specSource = path.join(PROMPTS_DIR, "app_spec.txt");
	const specDest = path.join(projectDir, "app_spec.txt");

	// Check if destination already exists
	const destFile = Bun.file(specDest);
	const destExists = await destFile.exists();

	if (!destExists) {
		// Read source file and write to destination
		const sourceFile = Bun.file(specSource);
		const content = await sourceFile.text();
		await Bun.write(specDest, content);
		console.log("Copied app_spec.txt to project directory");
	}
}
