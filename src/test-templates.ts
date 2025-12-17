#!/usr/bin/env bun
/**
 * Template Engine Test Script
 *
 * Verifies that the Handlebars templating system works correctly
 * by rendering prompts with different provider combinations.
 */

import { PuppeteerProvider } from "./browser-providers/puppeteer-provider.js";
import { LinearProvider } from "./providers/linear-provider.js";
import { TemplateEngine } from "./templates/engine.js";

async function main() {
	console.log("🧪 Testing Template Engine\n");
	console.log("=".repeat(80));

	const engine = new TemplateEngine();
	const browserProvider = new PuppeteerProvider();
	const projectProvider = new LinearProvider();

	// Build context
	const context = TemplateEngine.buildContext(browserProvider, projectProvider);

	console.log("\n📦 Template Context:");
	console.log(JSON.stringify(context, null, 2));

	console.log(`\n${"=".repeat(80)}`);
	console.log("\n🔍 Testing Coding Prompt Rendering\n");

	try {
		const codingPrompt = await engine.render("coding", context);
		console.log("✅ Coding prompt rendered successfully");
		console.log(`   Length: ${codingPrompt.length} characters`);

		// Check that the prompt contains expected Puppeteer tool references
		const hasNavigate = codingPrompt.includes("mcp__puppeteer__puppeteer_navigate");
		const hasScreenshot = codingPrompt.includes("mcp__puppeteer__puppeteer_screenshot");
		const hasClick = codingPrompt.includes("mcp__puppeteer__puppeteer_click");
		const hasPuppeteer = codingPrompt.includes("Puppeteer");

		console.log(`   Contains navigate tool: ${hasNavigate ? "✅" : "❌"}`);
		console.log(`   Contains screenshot tool: ${hasScreenshot ? "✅" : "❌"}`);
		console.log(`   Contains click tool: ${hasClick ? "✅" : "❌"}`);
		console.log(`   Contains Puppeteer name: ${hasPuppeteer ? "✅" : "❌"}`);

		if (!hasNavigate || !hasScreenshot || !hasClick || !hasPuppeteer) {
			throw new Error("Coding prompt missing expected Puppeteer tool references");
		}
	} catch (error) {
		console.error("❌ Coding prompt rendering failed:");
		console.error(error);
		process.exit(1);
	}

	console.log(`\n${"=".repeat(80)}`);
	console.log("\n🔍 Testing Initializer Prompt Rendering\n");

	try {
		const initializerPrompt = await engine.render("initializer", context);
		console.log("✅ Initializer prompt rendered successfully");
		console.log(`   Length: ${initializerPrompt.length} characters`);

		// Check that the prompt contains expected Linear tool references
		const hasLinear = initializerPrompt.includes("Linear");
		const hasLinearTools = initializerPrompt.includes("mcp__linear__");

		console.log(`   Contains Linear name: ${hasLinear ? "✅" : "❌"}`);
		console.log(`   Contains Linear tools: ${hasLinearTools ? "✅" : "❌"}`);

		if (!hasLinear || !hasLinearTools) {
			throw new Error("Initializer prompt missing expected Linear references");
		}
	} catch (error) {
		console.error("❌ Initializer prompt rendering failed:");
		console.error(error);
		process.exit(1);
	}

	console.log(`\n${"=".repeat(80)}`);
	console.log("\n✅ All template tests passed!");
	console.log("\n📝 Summary:");
	console.log("   - Handlebars engine initialized correctly");
	console.log("   - Partials loaded and registered");
	console.log("   - Custom helpers (ifBrowser, toolList, var) working");
	console.log("   - Coding prompt renders with browser-specific tools");
	console.log("   - Initializer prompt renders with project-specific content");
	console.log("\n🎉 Template engine is ready for use!");
}

main().catch((error) => {
	console.error("❌ Test failed:", error);
	process.exit(1);
});
