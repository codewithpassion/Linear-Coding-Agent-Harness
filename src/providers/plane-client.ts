/**
 * Plane.so REST API Client
 *
 * Provides type-safe wrappers around Plane's REST API endpoints.
 * Reference: ai_docs/beads-plane.md lines 86-150
 */

/**
 * Plane work item structure
 */
export interface PlaneWorkItem {
	/** Unique identifier (UUID) */
	id: string;
	/** Work item title */
	name: string;
	/** Markdown description */
	description: string;
	/** State name (e.g., "Todo", "In Progress", "Done") */
	state: string;
	/** Priority level */
	priority: "urgent" | "high" | "medium" | "low" | "none";
	/** Readable identifier (e.g., "PROJ-123") */
	identifier: string;
	/** ISO 8601 timestamp of creation */
	created_at?: string;
	/** ISO 8601 timestamp of last update */
	updated_at?: string;
}

/**
 * Plane project structure
 */
export interface PlaneProject {
	/** Unique identifier (UUID) */
	id: string;
	/** Project name */
	name: string;
	/** Project description */
	description: string;
	/** Readable identifier (e.g., "PROJ") */
	identifier: string;
}

/**
 * Plane state structure
 */
export interface PlaneState {
	/** Unique identifier (UUID) */
	id: string;
	/** State name (e.g., "Todo", "In Progress", "Done") */
	name: string;
	/** State color (hex) */
	color: string;
	/** Group (e.g., "backlog", "started", "completed", "cancelled") */
	group: string;
}

/**
 * Plane user structure
 */
export interface PlaneUser {
	/** Unique identifier (UUID) */
	id: string;
	/** User email */
	email: string;
	/** Display name */
	display_name?: string;
}

/**
 * Plane API pagination response
 *
 * Note: Currently unused but defined for future pagination support.
 * Plane uses cursor-based pagination with these fields.
 */
// interface PaginatedResponse<T> {
// 	/** Result items */
// 	results: T[];
// 	/** Next page cursor */
// 	next_cursor: string | null;
// 	/** Previous page cursor */
// 	prev_cursor: string | null;
// 	/** Total number of results */
// 	total_results: number;
// 	/** Total number of pages */
// 	total_pages: number;
// }

/**
 * Plane API client
 *
 * Handles authentication, rate limiting, and request/response formatting
 * for the Plane.so REST API.
 */
export class PlaneApiClient {
	private baseUrl: string;
	private apiKey: string;
	private workspaceSlug: string;
	private lastRequestTime = 0;
	private readonly minRequestInterval = 1000; // 1 second between requests (60 req/min)

	/**
	 * Create a new Plane API client
	 *
	 * @param apiKey - Plane API key (without "plane_api_" prefix)
	 * @param baseUrl - Base URL (e.g., "https://api.plane.so")
	 * @param workspaceSlug - Workspace slug
	 */
	constructor(apiKey: string, baseUrl: string, workspaceSlug: string) {
		this.apiKey = apiKey;
		this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
		this.workspaceSlug = workspaceSlug;
	}

	/**
	 * Rate limiting: Wait if needed before making a request
	 * Plane has a 60 req/min limit, so we enforce 1 second between requests
	 */
	private async rateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < this.minRequestInterval) {
			const waitTime = this.minRequestInterval - timeSinceLastRequest;
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		this.lastRequestTime = Date.now();
	}

	/**
	 * Make a request to Plane API with rate limiting and error handling
	 */
	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		// Enforce rate limiting
		await this.rateLimit();

		const url = `${this.baseUrl}/api/v1/workspaces/${this.workspaceSlug}${path}`;

		try {
			const response = await fetch(url, {
				method,
				headers: {
					"X-API-Key": `plane_api_${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: body ? JSON.stringify(body) : undefined,
			});

			// Check rate limit headers
			const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
			if (rateLimitRemaining && Number.parseInt(rateLimitRemaining) < 10) {
				console.warn(
					`Warning: Plane API rate limit approaching (${rateLimitRemaining} requests remaining)`,
				);
			}

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Plane API error: ${response.status} ${response.statusText}\n${errorText}`);
			}

			return (await response.json()) as T;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Plane API request failed: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * List all projects in workspace
	 */
	async listProjects(): Promise<PlaneProject[]> {
		return await this.request<PlaneProject[]>("GET", "/projects/");
	}

	/**
	 * Create a new project
	 *
	 * @param name - Project name
	 * @param description - Project description
	 * @param identifier - Project identifier (e.g., "PROJ")
	 * @returns Created project
	 */
	async createProject(
		name: string,
		description: string,
		identifier: string,
	): Promise<PlaneProject> {
		return await this.request<PlaneProject>("POST", "/projects/", {
			name,
			description,
			identifier,
		});
	}

	/**
	 * Get a project by ID
	 */
	async getProject(projectId: string): Promise<PlaneProject> {
		return await this.request<PlaneProject>("GET", `/projects/${projectId}/`);
	}

	/**
	 * List work items in a project with optional filtering
	 *
	 * @param projectId - Project ID
	 * @param state - Optional state filter (state name)
	 * @param priority - Optional priority filter
	 * @returns Array of work items
	 */
	async listWorkItems(
		projectId: string,
		filters?: {
			state?: string;
			priority?: string;
		},
	): Promise<PlaneWorkItem[]> {
		let path = `/projects/${projectId}/work-items/`;

		const params = new URLSearchParams();
		if (filters?.state) {
			params.append("state", filters.state);
		}
		if (filters?.priority) {
			params.append("priority", filters.priority);
		}

		const queryString = params.toString();
		if (queryString) {
			path += `?${queryString}`;
		}

		return await this.request<PlaneWorkItem[]>("GET", path);
	}

	/**
	 * Get a work item by identifier (e.g., "PROJ-123")
	 *
	 * @param identifier - Work item identifier
	 * @returns Work item
	 */
	async getWorkItemByIdentifier(identifier: string): Promise<PlaneWorkItem> {
		return await this.request<PlaneWorkItem>("GET", `/work-items/${identifier}/`);
	}

	/**
	 * Create a work item
	 *
	 * @param projectId - Project ID
	 * @param data - Work item data
	 * @returns Created work item
	 */
	async createWorkItem(
		projectId: string,
		data: {
			name: string;
			description: string;
			priority?: "urgent" | "high" | "medium" | "low" | "none";
			state?: string;
		},
	): Promise<PlaneWorkItem> {
		return await this.request<PlaneWorkItem>("POST", `/projects/${projectId}/work-items/`, {
			name: data.name,
			description: data.description,
			priority: data.priority || "medium",
			state: data.state,
		});
	}

	/**
	 * Update a work item
	 *
	 * @param projectId - Project ID
	 * @param workItemId - Work item ID
	 * @param data - Fields to update
	 * @returns Updated work item
	 */
	async updateWorkItem(
		projectId: string,
		workItemId: string,
		data: Partial<Pick<PlaneWorkItem, "name" | "description" | "state" | "priority">>,
	): Promise<PlaneWorkItem> {
		return await this.request<PlaneWorkItem>(
			"PATCH",
			`/projects/${projectId}/work-items/${workItemId}/`,
			data,
		);
	}

	/**
	 * List states for a project
	 *
	 * @param projectId - Project ID
	 * @returns Array of states
	 */
	async listStates(projectId: string): Promise<PlaneState[]> {
		return await this.request<PlaneState[]>("GET", `/projects/${projectId}/states/`);
	}

	/**
	 * Create a comment on a work item
	 *
	 * @param projectId - Project ID
	 * @param workItemId - Work item ID
	 * @param comment - Comment text (markdown supported)
	 */
	async createComment(projectId: string, workItemId: string, comment: string): Promise<void> {
		await this.request<void>("POST", `/projects/${projectId}/work-items/${workItemId}/comments/`, {
			comment,
		});
	}

	/**
	 * Get current user info
	 *
	 * @returns Current user information
	 */
	async getCurrentUser(): Promise<PlaneUser> {
		// Note: This endpoint doesn't use workspace slug
		const url = `${this.baseUrl}/api/v1/user/`;

		await this.rateLimit();

		const response = await fetch(url, {
			method: "GET",
			headers: {
				"X-API-Key": `plane_api_${this.apiKey}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Plane API error: ${response.status} ${response.statusText}\n${errorText}`);
		}

		return (await response.json()) as PlaneUser;
	}
}
