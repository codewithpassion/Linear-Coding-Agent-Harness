/**
 * Linear Configuration
 * ====================
 *
 * Configuration constants for Linear integration.
 * These values are used in prompts and for project state management.
 */

/**
 * Environment variable for Linear API key.
 * Must be set before running the application.
 * Get your API key from: https://linear.app/YOUR-TEAM/settings/api
 */
export const LINEAR_API_KEY: string | undefined = process.env["LINEAR_API_KEY"];

/**
 * Default number of issues to create during initialization.
 * Can be overridden via command line arguments.
 */
export const DEFAULT_ISSUE_COUNT: number = 50;

/**
 * Linear workflow status: Issue not yet started
 */
export const STATUS_TODO: string = "Todo";

/**
 * Linear workflow status: Issue currently being worked on
 */
export const STATUS_IN_PROGRESS: string = "In Progress";

/**
 * Linear workflow status: Issue completed
 */
export const STATUS_DONE: string = "Done";

/**
 * Label for functional feature issues (core application logic)
 */
export const LABEL_FUNCTIONAL: string = "functional";

/**
 * Label for style/UI issues (visual design, CSS, UX)
 */
export const LABEL_STYLE: string = "style";

/**
 * Label for infrastructure issues (build, deploy, tooling)
 */
export const LABEL_INFRASTRUCTURE: string = "infrastructure";

/**
 * Linear priority value for urgent issues.
 * Linear uses 0-4 scale where 1=Urgent, 4=Low, 0=No priority
 */
export const PRIORITY_URGENT: number = 1;

/**
 * Linear priority value for high priority issues.
 */
export const PRIORITY_HIGH: number = 2;

/**
 * Linear priority value for medium priority issues.
 */
export const PRIORITY_MEDIUM: number = 3;

/**
 * Linear priority value for low priority issues.
 */
export const PRIORITY_LOW: number = 4;

/**
 * Filename for local marker file that tracks Linear project initialization.
 * Contains project metadata including team_id, project_id, and meta_issue_id.
 */
export const LINEAR_PROJECT_MARKER: string = ".linear_project.json";

/**
 * Title for the meta issue used for project tracking and session handoff.
 * This issue contains session summaries and overall project progress.
 */
export const META_ISSUE_TITLE: string = "[META] Project Progress Tracker";

/**
 * Type guard to check if LINEAR_API_KEY is set.
 * Throws an error if the API key is not configured.
 */
export function requireLinearApiKey(): string {
	if (!LINEAR_API_KEY) {
		throw new Error(
			"LINEAR_API_KEY environment variable is not set. " +
				"Get your API key from: https://linear.app/YOUR-TEAM/settings/api",
		);
	}
	return LINEAR_API_KEY;
}

/**
 * Valid Linear priority values (0-4 scale)
 */
export type LinearPriority = 0 | 1 | 2 | 3 | 4;

/**
 * Valid Linear workflow states
 */
export type LinearStatus = "Todo" | "In Progress" | "Done";

/**
 * Valid label categories for issue classification
 */
export type LinearLabel = "functional" | "style" | "infrastructure";

/**
 * Interface for Linear project marker file structure
 */
export interface LinearProjectMarker {
	initialized: boolean;
	created_at: string;
	team_id: string;
	project_id: string;
	project_name: string;
	meta_issue_id: string;
	total_issues: number;
	notes?: string;
}
