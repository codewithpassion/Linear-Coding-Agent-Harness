# Multi-Platform Project Management Strategy Pattern

## Goal
Extend the Linear-only autonomous coding agent harness to support three project management platforms: Linear, Plane.so, and Beads. Implement a strategy pattern allowing users to choose their preferred platform.

---

## Platform API & Usage Specifications

### 1. LINEAR (Current Implementation)

**Transport:** HTTP-based MCP Server
**Base URL:** `https://mcp.linear.app/mcp`
**Authentication:** Bearer token via `LINEAR_API_KEY` environment variable

#### Core Capabilities
- **Team Management:** `list_teams`, `get_team`
- **Project Management:** `list_projects`, `get_project`, `create_project`, `update_project`
- **Issue Management:** `list_issues`, `get_issue`, `create_issue`, `update_issue`, `list_my_issues`
- **Comments:** `list_comments`, `create_comment`
- **Workflow:** `list_issue_statuses`, `get_issue_status`
- **Labels & Users:** `list_issue_labels`, `list_users`, `get_user`

#### Data Model
- **Statuses:** "Todo", "In Progress", "Done"
- **Priorities:** 0-4 scale (0=None, 1=Urgent, 2=High, 3=Medium, 4=Low)
- **Labels:** "functional", "style", "infrastructure"
- **Issue Fields:** title, description, status, priority, teamId, projectId

#### Workflow
1. Initializer creates project + 50 issues + META issue
2. Coding agents query by status="Todo", sort by priority
3. Update status: Todo → In Progress → Done
4. Session handoff via META issue comments

#### State Marker
`.linear_project.json` contains: team_id, project_id, meta_issue_id, total_issues

---

### 2. BEADS (Git-Native Issue Tracker)

**Transport:** MCP Server (stdio) OR Direct CLI
**Installation:** `npm install -g @beads/bd` or Go binary
**Authentication:** None required (local Git-based)

#### Core Capabilities (CLI Commands)
- **Initialization:** `bd init [--quiet|--contributor|--team|--branch <name>]`
- **Issue Management:** `bd create`, `bd list`, `bd show`, `bd update`, `bd close`
- **Dependency Management:** `bd dep add/remove/tree`
- **Query:** `bd ready` (issues with no blockers), `bd info`, `bd ready --json`
- **Sync:** `bd sync` (Git synchronization)
- **Migration:** `bd migrate` (schema upgrades)

#### Data Model
- **Issue IDs:** Hash-based (bd-a1b2, bd-f14c3, bd-3e7a5b)
- **Statuses:** open, in_progress, closed
- **Priorities:** Numeric (1=highest)
- **Types:** epic, task, bug, feature, etc.
- **Dependencies:** blocks, related, parent-child, discovered-from
- **Hierarchical Children:** dot-notation (bd-a3f8e9.1, bd-a3f8e9.2)

#### Storage Architecture
- **Local SQLite:** `.beads/beads.db` (gitignored, fast queries)
- **Git JSONL:** `.beads/issues.jsonl` (committed, source of truth)
- **Auto-sync:** SQLite ↔ JSONL with 5-second debounce
- **Git Hooks:** pre-commit (immediate flush), post-merge (import)

#### Workflow
1. Initializer runs `bd init`, creates issues via `bd create --json`
2. Coding agents query `bd ready --json` for unblocked issues
3. Update status: `bd update <id> --status in_progress`
4. Complete: `bd close <id> --reason "<summary>"`
5. Link discovered work: `bd dep add <new> <parent> --type discovered-from`

#### State Marker
`.beads/issues.jsonl` + `.beads/beads.db` presence indicates initialization

#### MCP Integration Options
**Option A:** Use existing MCP server (if available)
**Option B:** Wrap CLI commands in agent-side utilities
**Option C:** Build custom MCP server wrapper around `bd` CLI

---

### 3. PLANE.SO (REST API)

**Transport:** REST API (requires MCP wrapper OR direct HTTP calls)
**Base URL:** `https://api.plane.so/` (cloud) or custom (self-hosted)
**Authentication:** API key via `X-API-Key: plane_api_<token>` header

#### Core REST Endpoints

**Workspaces & Projects:**
- `GET /api/v1/workspaces/{workspace_slug}/projects/` - List projects
- `POST /api/v1/workspaces/{workspace_slug}/projects/` - Create project
- `GET/PATCH/DELETE /api/v1/workspaces/{workspace_slug}/projects/{project_id}/` - Manage project

**Work Items (Issues):**
- `GET/POST /api/v1/workspaces/{workspace_slug}/projects/{project_id}/work-items/` - CRUD
- `GET /api/v1/workspaces/{workspace_slug}/work-items/{identifier}/` - Get by ID (e.g., PROJ-123)
- `GET /api/v1/workspaces/{workspace_slug}/work-items/search/` - Search issues

**States & Workflows:**
- `GET/POST /api/v1/workspaces/{workspace_slug}/projects/{project_id}/states/` - Manage states
- `GET/PATCH/DELETE /api/v1/workspaces/{workspace_slug}/states/{state_id}/` - State operations

**Members & Users:**
- `GET /api/v1/workspaces/{workspace_slug}/members/` - Workspace members
- `GET /api/v1/workspaces/{workspace_slug}/projects/{project_id}/members/` - Project members
- `GET /api/v1/user/` - Current user

**Additional Resources:**
- Labels, Cycles, Modules, Pages, Attachments, Comments, Custom Properties

#### Data Model
- **Work Item Fields:** name, description, state, priority, assignees, labels
- **States:** Customizable (default: Todo, In Progress, Done)
- **Priorities:** urgent, high, medium, low, none
- **Identifiers:** Readable format (PROJECT-123)

#### Rate Limiting
- **Limit:** 60 requests/minute per API key
- **Headers:** `X-RateLimit-Remaining`, `X-RateLimit-Reset`

#### Pagination
- **Type:** Cursor-based (`value:offset:is_prev`)
- **Parameters:** `per_page` (max 100), `cursor`
- **Response:** `next_cursor`, `prev_cursor`, `total_results`, `total_pages`

#### Query Features
- **fields:** Comma-separated field filtering
- **expand:** Include related resources (e.g., `?expand=assignees,state`)

#### Workflow
1. Initializer authenticates, creates workspace project, creates 50 work items
2. Coding agents query work items with state filters
3. Update state via PATCH requests
4. Comments via dedicated comment endpoints
5. Session handoff via special META work item

#### State Marker
`.plane_project.json` contains: workspace_slug, project_id, meta_work_item_id, total_issues

#### MCP Integration Required
Plane.so uses REST API (not MCP natively). Options:
- **Option A:** Create custom MCP server wrapper for Plane API
- **Option B:** Use direct HTTP calls within agent logic (breaks MCP pattern)
- **Option C:** Community MCP server (if exists)

---

## Platform Comparison Matrix

| Feature | Linear | Beads | Plane.so |
|---------|--------|-------|----------|
| **Transport** | MCP (HTTP) | CLI + Git | REST API |
| **Authentication** | Bearer token | None (local) | API key header |
| **Setup Complexity** | Medium | Low | Medium-High |
| **Network Required** | Yes | No (local) | Yes |
| **Collaboration** | Real-time | Git-based | Real-time |
| **Self-Hosted** | No | Yes (Git) | Yes |
| **Rate Limits** | Unknown | None | 60/min |
| **Issue IDs** | UUID-like | Hash-based | Readable (PROJ-123) |
| **Dependencies** | Basic | Advanced (4 types) | Basic |
| **MCP Native** | ✅ Yes | ⚠️ Possible | ❌ No (REST) |

---

## Strategy Pattern Design (High-Level)

### Core Abstraction

```typescript
interface ProjectManagementProvider {
  // Identity
  name: string; // "linear" | "beads" | "plane"

  // Environment & Setup
  validateEnvironment(): Promise<void>;
  getMcpServerConfig(): McpServerConfig | null;
  getRequiredTools(): string[];

  // State Management
  isInitialized(projectDir: string): Promise<boolean>;
  getMarkerFileName(): string;
  loadProjectState(projectDir: string): Promise<ProjectState | null>;

  // Prompts (provider-specific instructions)
  getInitializerPrompt(): Promise<string>;
  getCodingPrompt(): Promise<string>;

  // Progress Display
  printProgressSummary(projectDir: string): Promise<void>;
}

interface ProjectState {
  initialized: boolean;
  provider: "linear" | "beads" | "plane";
  created_at: string;
  project_id: string;
  project_name: string;
  meta_issue_id: string;
  total_issues: number;
  notes?: string;
  provider_data: Record<string, unknown>; // Provider-specific fields
}
```

### Implementation Strategy

**Provider Implementations:**
- `LinearProvider` (existing logic extracted)
- `BeadsProvider` (CLI or MCP wrapper)
- `PlaneProvider` (REST API with MCP wrapper OR direct HTTP)

**Provider Selection:**
1. CLI flag: `--provider linear|beads|plane` (default: linear)
2. Environment variable: `PROJECT_MANAGER_PROVIDER`
3. Saved in project marker file after initialization

**Injection Points:**
1. **client.ts:** MCP server configuration
2. **client.ts:** Tool permission allowlist
3. **progress.ts:** State detection and loading
4. **agent.ts:** Initialization check and routing
5. **agent.ts:** Prompt selection
6. **prompts/:** Provider-specific prompt templates
7. **index.ts:** CLI argument parsing

---

## User Decisions

✅ **Beads Integration:** CLI wrapper - Call `bd` commands via Bash utilities
✅ **Plane.so Integration:** Direct REST calls - HTTP client in TypeScript (no MCP wrapper)
✅ **Provider Selection:** CLI flag `--provider` + config file `.coding-agent.config.json`
✅ **Mid-Project Switching:** No - Provider locked after initialization (simpler)

---

## Implementation Requirements

Based on user decisions, the implementation will:

1. **Extract Linear logic** into `LinearProvider` class
2. **Create BeadsProvider** class that wraps `bd` CLI commands
3. **Create PlaneProvider** class that makes direct REST API calls
4. **Create strategy interface** `ProjectManagementProvider`
5. **Add provider factory** to instantiate correct provider
6. **Update CLI** to accept `--provider` flag
7. **Support config file** `.coding-agent.config.json` for defaults
8. **Maintain backward compatibility** with existing `.linear_project.json` projects
9. **Provider-specific prompts** in `prompts/` directory structure
10. **Unified project state** with provider-specific data in `provider_data` field

---

## Detailed Implementation Plan

### Phase 1: Core Abstractions (Foundation)

#### 1.1 Create Provider Interface

**File:** `src/providers/types.ts` (NEW)

```typescript
export type ProviderType = "linear" | "beads" | "plane";

export interface ProjectState {
  initialized: boolean;
  provider: ProviderType;
  created_at: string;
  project_id: string;
  project_name: string;
  meta_issue_id: string;
  total_issues: number;
  notes?: string;
  provider_data: Record<string, unknown>;
}

export interface ProjectManagementProvider {
  // Identity
  readonly name: ProviderType;

  // Environment & Configuration
  validateEnvironment(): void;
  getMcpServerConfig(): McpServerConfig | null;
  getRequiredTools(): string[];

  // State Management
  getMarkerFileName(): string;
  isInitialized(projectDir: string): Promise<boolean>;
  loadProjectState(projectDir: string): Promise<ProjectState | null>;

  // Prompts
  getInitializerPrompt(): Promise<string>;
  getCodingPrompt(): Promise<string>;

  // Progress Display
  printProgressSummary(projectDir: string): Promise<void>;
}
```

**Key Design Points:**
- `provider_data` allows provider-specific fields without polluting common interface
- `getMcpServerConfig()` returns null for providers without MCP servers (Beads CLI, Plane REST)
- `getMarkerFileName()` enables different marker files per provider

#### 1.2 Create Config File Schema

**File:** `src/config.ts` (NEW)

```typescript
export interface CodingAgentConfig {
  provider: "linear" | "beads" | "plane";
  linear?: {
    apiKey?: string; // Fallback if not in env
  };
  beads?: {
    bdPath?: string; // Custom bd binary path
  };
  plane?: {
    apiKey?: string; // Fallback if not in env
    baseUrl?: string; // Self-hosted instances
    workspaceSlug?: string; // Default workspace
  };
}

export async function loadConfig(projectDir: string): Promise<CodingAgentConfig | null> {
  const configPath = join(projectDir, ".coding-agent.config.json");
  if (!existsSync(configPath)) return null;

  const file = Bun.file(configPath);
  const content = await file.text();
  return JSON.parse(content) as CodingAgentConfig;
}

export async function saveConfig(projectDir: string, config: CodingAgentConfig): Promise<void> {
  const configPath = join(projectDir, ".coding-agent.config.json");
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}
```

---

### Phase 2: Linear Provider (Extract Existing Logic)

#### 2.1 Extract Linear Provider

**File:** `src/providers/linear-provider.ts` (NEW)

Extract and refactor existing Linear logic from:
- `src/client.ts` lines 120-126 (env validation)
- `src/client.ts` lines 166-173 (MCP config)
- `src/client.ts` lines 52-71 (LINEAR_TOOLS)
- `src/progress.ts` (state loading functions)
- `src/linear-config.ts` (constants)

```typescript
export class LinearProvider implements ProjectManagementProvider {
  readonly name = "linear" as const;

  validateEnvironment(): void {
    if (!process.env["LINEAR_API_KEY"]) {
      throw new Error("LINEAR_API_KEY not set...");
    }
  }

  getMcpServerConfig(): McpServerConfig {
    return {
      type: "http",
      url: "https://mcp.linear.app/mcp",
      headers: { Authorization: `Bearer ${process.env["LINEAR_API_KEY"]}` }
    };
  }

  getRequiredTools(): string[] {
    return LINEAR_TOOLS; // From linear-config.ts
  }

  getMarkerFileName(): string {
    return ".linear_project.json";
  }

  async isInitialized(projectDir: string): Promise<boolean> {
    // Move logic from progress.ts:isLinearInitialized()
  }

  async loadProjectState(projectDir: string): Promise<ProjectState | null> {
    // Move logic from progress.ts:loadLinearProjectState()
    // Map LinearProjectState -> ProjectState
  }

  async getInitializerPrompt(): Promise<string> {
    // Load from prompts/linear/initializer_prompt.md
  }

  async getCodingPrompt(): Promise<string> {
    // Load from prompts/linear/coding_prompt.md
  }

  async printProgressSummary(projectDir: string): Promise<void> {
    // Move logic from progress.ts:printProgressSummary()
  }
}
```

**Migration Notes:**
- Keep `src/linear-config.ts` as-is (still used by LinearProvider)
- `src/progress.ts` becomes provider-agnostic wrapper
- Existing `.linear_project.json` files auto-detected via marker filename

---

### Phase 3: Beads Provider (CLI Wrapper)

#### 3.1 Create Beads Utilities

**File:** `src/providers/beads-utils.ts` (NEW)

```typescript
interface BdIssue {
  id: string;
  title: string;
  status: "open" | "in_progress" | "closed";
  priority: number;
  type: string;
  description?: string;
}

export async function bdCommand(args: string[], cwd: string): Promise<string> {
  // Execute bd CLI command via Bun.$
  const result = await Bun.$`bd ${args.join(" ")}`.cwd(cwd).text();
  return result;
}

export async function bdList(cwd: string, status?: string): Promise<BdIssue[]> {
  const args = ["list", "--json"];
  if (status) args.push("--status", status);

  const output = await bdCommand(args, cwd);
  return JSON.parse(output) as BdIssue[];
}

export async function bdReady(cwd: string): Promise<BdIssue[]> {
  const output = await bdCommand(["ready", "--json"], cwd);
  return JSON.parse(output) as BdIssue[];
}

export async function bdCreate(
  cwd: string,
  title: string,
  options: { type?: string; priority?: number; description?: string }
): Promise<BdIssue> {
  const args = ["create", title, "--json"];
  if (options.type) args.push("-t", options.type);
  if (options.priority) args.push("-p", String(options.priority));

  const output = await bdCommand(args, cwd);
  return JSON.parse(output) as BdIssue;
}

export async function bdUpdate(
  cwd: string,
  issueId: string,
  status: string
): Promise<void> {
  await bdCommand(["update", issueId, "--status", status, "--json"], cwd);
}

export async function bdClose(
  cwd: string,
  issueId: string,
  reason: string
): Promise<void> {
  await bdCommand(["close", issueId, "--reason", reason, "--json"], cwd);
}

export async function bdInit(cwd: string): Promise<void> {
  await bdCommand(["init", "--quiet"], cwd);
}

export async function isBeadsInitialized(cwd: string): Promise<boolean> {
  return existsSync(join(cwd, ".beads", "issues.jsonl"));
}
```

#### 3.2 Create Beads Provider

**File:** `src/providers/beads-provider.ts` (NEW)

```typescript
export class BeadsProvider implements ProjectManagementProvider {
  readonly name = "beads" as const;

  validateEnvironment(): void {
    // Check if bd binary is available
    try {
      Bun.$`which bd`.quiet();
    } catch {
      throw new Error(
        "Beads CLI (bd) not found. Install: npm install -g @beads/bd"
      );
    }
  }

  getMcpServerConfig(): McpServerConfig | null {
    // Beads uses CLI, not MCP
    return null;
  }

  getRequiredTools(): string[] {
    // No MCP tools, but agents need Bash access for bd commands
    return [];
  }

  getMarkerFileName(): string {
    return ".beads/issues.jsonl"; // Beads' own marker
  }

  async isInitialized(projectDir: string): Promise<boolean> {
    return isBeadsInitialized(projectDir);
  }

  async loadProjectState(projectDir: string): Promise<ProjectState | null> {
    if (!await this.isInitialized(projectDir)) return null;

    // Query bd for project info
    const allIssues = await bdList(projectDir);
    const metaIssue = allIssues.find(i => i.title.includes("[META]"));

    return {
      initialized: true,
      provider: "beads",
      created_at: new Date().toISOString(), // Beads doesn't track this
      project_id: projectDir, // No explicit project ID in Beads
      project_name: projectDir.split("/").pop() || "Unknown",
      meta_issue_id: metaIssue?.id || "",
      total_issues: allIssues.length,
      notes: "Beads Git-based project",
      provider_data: {},
    };
  }

  async getInitializerPrompt(): Promise<string> {
    // Load from prompts/beads/initializer_prompt.md
    const file = Bun.file("prompts/beads/initializer_prompt.md");
    return await file.text();
  }

  async getCodingPrompt(): Promise<string> {
    // Load from prompts/beads/coding_prompt.md
    const file = Bun.file("prompts/beads/coding_prompt.md");
    return await file.text();
  }

  async printProgressSummary(projectDir: string): Promise<void> {
    const openIssues = await bdList(projectDir, "open");
    const inProgressIssues = await bdList(projectDir, "in_progress");
    const closedIssues = await bdList(projectDir, "closed");

    console.log("\nBeads Project Status:");
    console.log(`  Open issues: ${openIssues.length}`);
    console.log(`  In Progress: ${inProgressIssues.length}`);
    console.log(`  Closed: ${closedIssues.length}`);
  }
}
```

**Key Points:**
- Agents use `bd` CLI through Bash tool (already allowed)
- No MCP server needed
- Prompts will instruct agents on bd command syntax

---

### Phase 4: Plane Provider (REST API)

#### 4.1 Create Plane API Client

**File:** `src/providers/plane-client.ts` (NEW)

```typescript
interface PlaneWorkItem {
  id: string;
  name: string;
  description: string;
  state: string;
  priority: string;
  identifier: string; // e.g., "PROJ-123"
}

export class PlaneApiClient {
  private baseUrl: string;
  private apiKey: string;
  private workspaceSlug: string;

  constructor(apiKey: string, baseUrl = "https://api.plane.so", workspaceSlug: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.workspaceSlug = workspaceSlug;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1/workspaces/${this.workspaceSlug}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        "X-API-Key": `plane_api_${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Plane API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  }

  async listProjects(): Promise<Array<{ id: string; name: string }>> {
    return await this.request("GET", "/projects/");
  }

  async createProject(name: string, description: string): Promise<{ id: string }> {
    return await this.request("POST", "/projects/", { name, description });
  }

  async listWorkItems(projectId: string, state?: string): Promise<PlaneWorkItem[]> {
    let path = `/projects/${projectId}/work-items/`;
    if (state) path += `?state=${state}`;
    return await this.request("GET", path);
  }

  async createWorkItem(
    projectId: string,
    data: { name: string; description: string; priority?: string; state?: string }
  ): Promise<PlaneWorkItem> {
    return await this.request("POST", `/projects/${projectId}/work-items/`, data);
  }

  async updateWorkItem(
    projectId: string,
    workItemId: string,
    data: Partial<PlaneWorkItem>
  ): Promise<PlaneWorkItem> {
    return await this.request(
      "PATCH",
      `/projects/${projectId}/work-items/${workItemId}/`,
      data
    );
  }

  async createComment(
    projectId: string,
    workItemId: string,
    comment: string
  ): Promise<void> {
    await this.request(
      "POST",
      `/projects/${projectId}/work-items/${workItemId}/comments/`,
      { comment }
    );
  }
}
```

#### 4.2 Create Plane Provider

**File:** `src/providers/plane-provider.ts` (NEW)

```typescript
export class PlaneProvider implements ProjectManagementProvider {
  readonly name = "plane" as const;
  private client: PlaneApiClient | null = null;

  private async getClient(projectDir: string): Promise<PlaneApiClient> {
    if (this.client) return this.client;

    const apiKey = process.env["PLANE_API_KEY"];
    if (!apiKey) throw new Error("PLANE_API_KEY not set");

    // Load workspace slug from config or state
    const config = await loadConfig(projectDir);
    const workspaceSlug = config?.plane?.workspaceSlug || "default";
    const baseUrl = config?.plane?.baseUrl || "https://api.plane.so";

    this.client = new PlaneApiClient(apiKey, baseUrl, workspaceSlug);
    return this.client;
  }

  validateEnvironment(): void {
    if (!process.env["PLANE_API_KEY"]) {
      throw new Error("PLANE_API_KEY not set. Get from: https://app.plane.so/settings");
    }
  }

  getMcpServerConfig(): McpServerConfig | null {
    // Plane uses REST API, not MCP
    return null;
  }

  getRequiredTools(): string[] {
    return []; // No MCP tools
  }

  getMarkerFileName(): string {
    return ".plane_project.json";
  }

  async isInitialized(projectDir: string): Promise<boolean> {
    const markerPath = join(projectDir, this.getMarkerFileName());
    return existsSync(markerPath);
  }

  async loadProjectState(projectDir: string): Promise<ProjectState | null> {
    const markerPath = join(projectDir, this.getMarkerFileName());
    if (!existsSync(markerPath)) return null;

    const file = Bun.file(markerPath);
    const content = await file.text();
    return JSON.parse(content) as ProjectState;
  }

  async getInitializerPrompt(): Promise<string> {
    // Load from prompts/plane/initializer_prompt.md
    const file = Bun.file("prompts/plane/initializer_prompt.md");
    return await file.text();
  }

  async getCodingPrompt(): Promise<string> {
    // Load from prompts/plane/coding_prompt.md
    const file = Bun.file("prompts/plane/coding_prompt.md");
    return await file.text();
  }

  async printProgressSummary(projectDir: string): Promise<void> {
    const state = await this.loadProjectState(projectDir);
    if (!state) {
      console.log("\nPlane project not initialized");
      return;
    }

    const client = await this.getClient(projectDir);
    const projectId = state.project_id;

    const allItems = await client.listWorkItems(projectId);
    const todoItems = allItems.filter(i => i.state === "Todo");
    const inProgressItems = allItems.filter(i => i.state === "In Progress");
    const doneItems = allItems.filter(i => i.state === "Done");

    console.log("\nPlane Project Status:");
    console.log(`  Project: ${state.project_name}`);
    console.log(`  Todo: ${todoItems.length}`);
    console.log(`  In Progress: ${inProgressItems.length}`);
    console.log(`  Done: ${doneItems.length}`);
  }
}
```

---

### Phase 5: Provider Factory & Integration

#### 5.1 Create Provider Factory

**File:** `src/providers/factory.ts` (NEW)

```typescript
import { LinearProvider } from "./linear-provider.js";
import { BeadsProvider } from "./beads-provider.js";
import { PlaneProvider } from "./plane-provider.js";
import type { ProjectManagementProvider, ProviderType } from "./types.js";

export function createProvider(type: ProviderType): ProjectManagementProvider {
  switch (type) {
    case "linear":
      return new LinearProvider();
    case "beads":
      return new BeadsProvider();
    case "plane":
      return new PlaneProvider();
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}

export async function detectProvider(projectDir: string): Promise<ProviderType | null> {
  // Check for existing marker files (backward compatibility)
  if (existsSync(join(projectDir, ".linear_project.json"))) return "linear";
  if (existsSync(join(projectDir, ".beads", "issues.jsonl"))) return "beads";
  if (existsSync(join(projectDir, ".plane_project.json"))) return "plane";

  // Check config file
  const config = await loadConfig(projectDir);
  if (config?.provider) return config.provider;

  return null;
}
```

#### 5.2 Update Client Configuration

**File:** `src/client.ts` (MODIFY)

Key changes:
1. Remove hardcoded Linear validation (lines 120-126)
2. Remove hardcoded Linear MCP config (lines 166-173)
3. Remove hardcoded LINEAR_TOOLS (lines 52-71, move to linear-provider.ts)
4. Accept provider parameter

```typescript
export async function createQueryOptions(
  projectDir: string,
  model: string,
  provider: ProjectManagementProvider // NEW PARAMETER
): Promise<Options> {
  // Validate environment (provider-specific)
  provider.validateEnvironment();

  const claudeToken = process.env["CLAUDE_CODE_OAUTH_TOKEN"];
  if (!claudeToken) {
    throw new Error("CLAUDE_CODE_OAUTH_TOKEN not set...");
  }

  await Bun.$`mkdir -p ${projectDir}`.quiet();

  // Get provider-specific tools
  const providerTools = provider.getRequiredTools();

  // Security settings
  const securitySettings: SecuritySettings = {
    sandbox: { enabled: true, autoAllowBashIfSandboxed: true },
    permissions: {
      defaultMode: "acceptEdits",
      allow: [
        "Read(./**)",
        "Write(./**)",
        "Edit(./**)",
        "Glob(./**)",
        "Grep(./**)",
        "Bash(*)",
        ...PUPPETEER_TOOLS,
        ...providerTools, // Provider-specific tools
      ],
    },
  };

  // ... write settings file ...

  // MCP Server Configuration
  const mcpServers: Record<string, MCPServerConfiguration> = {
    puppeteer: {
      type: "stdio",
      command: "npx",
      args: ["puppeteer-mcp-server"],
    },
  };

  // Add provider MCP server if available
  const providerMcpConfig = provider.getMcpServerConfig();
  if (providerMcpConfig) {
    mcpServers[provider.name] = providerMcpConfig;
  }

  // ... rest of options ...
}
```

#### 5.3 Update Agent Session Logic

**File:** `src/agent.ts` (MODIFY)

Key changes at lines 197-238:

```typescript
export async function runAutonomousAgent(
  projectDir: string,
  model: string,
  maxIterations: number | undefined,
  providerType?: ProviderType // NEW PARAMETER
): Promise<void> {
  // Detect or use specified provider
  let detectedProvider = await detectProvider(projectDir);
  const selectedProvider = providerType || detectedProvider || "linear"; // Default to linear

  const provider = createProvider(selectedProvider);

  // Validate provider environment
  try {
    provider.validateEnvironment();
  } catch (error) {
    console.error(`Provider ${selectedProvider} validation failed:`);
    throw error;
  }

  let isFirstRun = !(await provider.isInitialized(projectDir));

  if (isFirstRun) {
    console.log(`Fresh start - will use ${selectedProvider} initializer agent`);
    await copySpecToProject(projectDir);

    // Save provider selection to config
    await saveConfig(projectDir, { provider: selectedProvider });
  } else {
    console.log(`Continuing existing ${selectedProvider} project`);
    await provider.printProgressSummary(projectDir);
  }

  let sessionNum = 1;

  while (true) {
    printSessionHeader(sessionNum, isFirstRun);

    // Get provider-specific prompt
    const prompt = isFirstRun
      ? await provider.getInitializerPrompt()
      : await provider.getCodingPrompt();

    const [status, response] = await runAgentSession(
      prompt,
      projectDir,
      model,
      provider // Pass provider to session
    );

    // ... existing continuation logic ...

    isFirstRun = false;
    sessionNum++;
  }
}
```

**File:** `src/agent.ts` function `runAgentSession` (MODIFY)

```typescript
export async function runAgentSession(
  prompt: string,
  projectDir: string,
  model: string,
  provider: ProjectManagementProvider // NEW PARAMETER
): Promise<AgentSessionResult> {
  console.log("Sending prompt to Claude Agent SDK...\n");

  try {
    // Pass provider to createQueryOptions
    const options = await createQueryOptions(projectDir, model, provider);

    const result = query({ prompt, options });

    // ... existing streaming logic ...
  } catch (error) {
    // ... existing error handling ...
  }
}
```

#### 5.4 Update CLI Entry Point

**File:** `src/index.ts` (MODIFY)

Add `--provider` flag parsing:

```typescript
interface CliArguments {
  projectDir: string;
  maxIterations: number | undefined;
  model: string;
  provider?: "linear" | "beads" | "plane"; // NEW
}

export function parseArgs(): CliArguments {
  const args = process.argv.slice(2);
  const result: CliArguments = {
    projectDir: CONFIG.DEFAULT_PROJECT_DIR,
    maxIterations: undefined,
    model: CONFIG.DEFAULT_MODEL,
    provider: undefined, // NEW
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      // ... existing cases ...

      case "--provider":
        if (i + 1 < args.length) {
          const nextArg = args[i + 1];
          if (!nextArg) {
            throw new Error(`${arg} requires a value`);
          }
          if (!["linear", "beads", "plane"].includes(nextArg)) {
            throw new Error(`Invalid provider: ${nextArg}. Must be: linear, beads, or plane`);
          }
          result.provider = nextArg as "linear" | "beads" | "plane";
          i++;
        } else {
          throw new Error(`${arg} requires a value`);
        }
        break;

      // ... existing cases ...
    }
  }

  return result;
}
```

Update `main()`:

```typescript
export async function main(): Promise<void> {
  try {
    const args = parseArgs();

    validateEnvironment(); // Still validate Claude token

    const projectDir = resolveProjectDir(args.projectDir);

    // Pass provider to runAutonomousAgent
    await runAutonomousAgent(projectDir, args.model, args.maxIterations, args.provider);
  } catch (error) {
    // ... existing error handling ...
  }
}
```

Update `printHelp()`:

```typescript
function printHelp(): void {
  console.log(`
Autonomous Coding Agent Demo - Long-running agent harness

Usage:
  bun run src/index.ts [options]

Options:
  --project-dir, -p <path>    Directory for the project (default: ${CONFIG.DEFAULT_PROJECT_DIR})
  --max-iterations, -m <num>  Maximum number of agent iterations (default: unlimited)
  --model <model>             Claude model to use (default: ${CONFIG.DEFAULT_MODEL})
  --provider <type>           Project management provider: linear, beads, or plane (default: auto-detect or linear)
  --help, -h                  Show this help message

Examples:
  # Start fresh project with Linear (default)
  bun run src/index.ts --project-dir ./my_app

  # Start with Beads
  bun run src/index.ts --project-dir ./my_app --provider beads

  # Start with Plane.so
  bun run src/index.ts --project-dir ./my_app --provider plane

  # Continue existing project (auto-detects provider)
  bun run src/index.ts --project-dir ./my_app

Environment Variables:
  CLAUDE_CODE_OAUTH_TOKEN    Claude Code OAuth token (required)
  LINEAR_API_KEY             Linear API key (required if using Linear)
  PLANE_API_KEY              Plane.so API key (required if using Plane)
`);
}
```

---

### Phase 6: Provider-Specific Prompts

#### 6.1 Reorganize Prompt Directory

**Current Structure:**
```
prompts/
├── app_spec.txt
├── initializer_prompt.md
└── coding_prompt.md
```

**New Structure:**
```
prompts/
├── app_spec.txt (shared)
├── linear/
│   ├── initializer_prompt.md (move existing)
│   └── coding_prompt.md (move existing)
├── beads/
│   ├── initializer_prompt.md (NEW - adapt for bd CLI)
│   └── coding_prompt.md (NEW - adapt for bd CLI)
└── plane/
    ├── initializer_prompt.md (NEW - adapt for Plane API)
    └── coding_prompt.md (NEW - adapt for Plane API)
```

#### 6.2 Create Beads Prompts

**File:** `prompts/beads/initializer_prompt.md` (NEW)

Key differences from Linear version:
- Instruct to run `bd init` first
- Create issues using `bd create "<title>" -t epic/task -p 1-4 --json`
- Create META issue same way
- Explain `bd dep add` for dependencies
- Explain `bd sync` for Git synchronization

**File:** `prompts/beads/coding_prompt.md` (NEW)

Key differences from Linear version:
- Query ready issues: `bd ready --json`
- Update status: `bd update <id> --status in_progress`
- Complete: `bd close <id> --reason "<summary>"`
- Link discovered work: `bd dep add <new> <parent> --type discovered-from`
- No need to query external API - all local CLI

#### 6.3 Create Plane Prompts

**File:** `prompts/plane/initializer_prompt.md` (NEW)

Key differences from Linear version:
- Explain Plane REST API authentication (X-API-Key header)
- Create project via POST /api/v1/workspaces/{workspace}/projects/
- Create work items via POST /projects/{id}/work-items/
- Note rate limiting (60 req/min)
- Write `.plane_project.json` marker file

**File:** `prompts/plane/coding_prompt.md` (NEW)

Key differences from Linear version:
- Query work items via GET /work-items/?state=Todo
- Update state via PATCH /work-items/{id}/ with {"state": "In Progress"}
- Create comments via POST /work-items/{id}/comments/
- Handle pagination (cursor-based)
- Respect rate limits

---

### Phase 7: Refactor Existing Code

#### 7.1 Refactor Progress Module

**File:** `src/progress.ts` (MODIFY)

Make provider-agnostic:

```typescript
// Remove Linear-specific functions, keep only:
export function printSessionHeader(sessionNum: number, isInitializer: boolean): void {
  // Keep as-is
}

// Remove:
// - loadLinearProjectState() -> moved to LinearProvider
// - isLinearInitialized() -> moved to LinearProvider
// - printProgressSummary() -> moved to providers
```

#### 7.2 Update Prompts Module

**File:** `src/prompts.ts` (MODIFY IF EXISTS)

If this file exists, update to be provider-aware or remove if logic moved to providers.

---

### Phase 8: Environment Validation

#### 8.1 Update Environment Check

**File:** `src/index.ts` function `validateEnvironment()` (MODIFY)

```typescript
export function validateEnvironment(): void {
  // Only check Claude token here (required for all providers)
  if (!process.env["CLAUDE_CODE_OAUTH_TOKEN"]) {
    console.error("Error: CLAUDE_CODE_OAUTH_TOKEN environment variable not set");
    console.error("\nRun 'claude setup-token' after installing the Claude Code CLI.");
    console.error("\nThen set it:");
    console.error("  export CLAUDE_CODE_OAUTH_TOKEN='your-token-here'");
    process.exit(1);
  }

  // Provider-specific validation happens in provider.validateEnvironment()
}
```

---

### Phase 9: Backward Compatibility

#### 9.1 Auto-Detection Logic

The `detectProvider()` function in `factory.ts` ensures backward compatibility:

1. Check for `.linear_project.json` → use Linear
2. Check for `.beads/issues.jsonl` → use Beads
3. Check for `.plane_project.json` → use Plane
4. Check `.coding-agent.config.json` → use config value
5. Default to Linear (existing behavior)

#### 9.2 Migration Path

Users with existing Linear projects:
- No action required
- Auto-detected as Linear projects
- Continue working as before

#### 9.3 Provider Lock-In

Once initialized, provider is locked:
- Saved in `.coding-agent.config.json`
- Detected from marker file
- Cannot switch mid-project (as per user decision)

---

## File Manifest

### New Files to Create

1. `src/providers/types.ts` - Provider interface and shared types
2. `src/providers/linear-provider.ts` - Linear provider implementation
3. `src/providers/beads-provider.ts` - Beads provider implementation
4. `src/providers/beads-utils.ts` - Beads CLI wrapper utilities
5. `src/providers/plane-provider.ts` - Plane provider implementation
6. `src/providers/plane-client.ts` - Plane REST API client
7. `src/providers/factory.ts` - Provider factory and detection
8. `src/config.ts` - Configuration file handling
9. `prompts/beads/initializer_prompt.md` - Beads initializer instructions
10. `prompts/beads/coding_prompt.md` - Beads coding agent instructions
11. `prompts/plane/initializer_prompt.md` - Plane initializer instructions
12. `prompts/plane/coding_prompt.md` - Plane coding agent instructions

### Files to Modify

1. `src/client.ts` - Remove Linear hardcoding, accept provider parameter
2. `src/agent.ts` - Add provider detection and routing
3. `src/index.ts` - Add `--provider` CLI flag parsing
4. `src/progress.ts` - Remove Linear-specific functions (move to provider)

### Files to Move

1. `prompts/initializer_prompt.md` → `prompts/linear/initializer_prompt.md`
2. `prompts/coding_prompt.md` → `prompts/linear/coding_prompt.md`

### Files to Keep As-Is

1. `src/linear-config.ts` - Still used by LinearProvider
2. `src/security.ts` - Provider-agnostic
3. `src/prompts.ts` - Provider-agnostic (if exists)
4. `prompts/app_spec.txt` - Shared across providers

---

## Implementation Sequence

### Step 1: Foundation (Do First)
1. Create `src/providers/types.ts`
2. Create `src/config.ts`
3. Create `src/providers/factory.ts` (stub implementations)

### Step 2: Extract Linear (Preserve Existing Functionality)
1. Create `src/providers/linear-provider.ts`
2. Move prompts: `prompts/{initializer,coding}_prompt.md` → `prompts/linear/`
3. Test: Ensure existing Linear projects still work

### Step 3: Add Beads
1. Create `src/providers/beads-utils.ts`
2. Create `src/providers/beads-provider.ts`
3. Create `prompts/beads/initializer_prompt.md`
4. Create `prompts/beads/coding_prompt.md`
5. Test: Initialize and run Beads project

### Step 4: Add Plane
1. Create `src/providers/plane-client.ts`
2. Create `src/providers/plane-provider.ts`
3. Create `prompts/plane/initializer_prompt.md`
4. Create `prompts/plane/coding_prompt.md`
5. Test: Initialize and run Plane project

### Step 5: Integration
1. Modify `src/client.ts` - Accept provider parameter
2. Modify `src/agent.ts` - Add provider routing
3. Modify `src/index.ts` - Add `--provider` flag
4. Modify `src/progress.ts` - Remove Linear-specific code

### Step 6: Testing & Documentation
1. Test all three providers end-to-end
2. Test backward compatibility with existing Linear projects
3. Update README.md with multi-provider usage
4. Update CLAUDE.md with provider instructions

---

## Risk Areas & Mitigation

### Risk 1: Beads CLI Not Available
**Mitigation:** `BeadsProvider.validateEnvironment()` checks for `bd` binary and provides clear installation instructions

### Risk 2: Plane API Rate Limiting
**Mitigation:** Document rate limits in Plane prompts; agents should batch operations and add delays between requests

### Risk 3: Breaking Existing Linear Projects
**Mitigation:** Auto-detection logic prioritizes marker files; no changes to existing projects unless user explicitly switches

### Risk 4: Provider-Specific Prompt Quality
**Mitigation:** Base new prompts on proven Linear prompts; adapt tool syntax while maintaining workflow patterns

### Risk 5: Complex Error Handling for REST API
**Mitigation:** Plane client includes proper error handling with descriptive messages; prompts instruct agents on retry logic

### Risk 6: Git Conflicts with Beads Sync
**Mitigation:** Prompts explain `bd sync` workflow; agents instructed to sync before/after sessions

---

## Testing Strategy

### Unit Tests
- Provider interface compliance (each provider implements all methods)
- Config file loading/saving
- Provider factory creation
- Auto-detection logic

### Integration Tests
- Linear: Full session with existing MCP server
- Beads: Full session with CLI commands
- Plane: Full session with REST API (mock server)

### End-to-End Tests
- Initialize + run 3 sessions with each provider
- Backward compatibility: Existing Linear project auto-detected
- Provider switching prevented after initialization

---

## Success Criteria

✅ All three providers (Linear, Beads, Plane) fully functional
✅ Existing Linear projects continue working without modification
✅ Provider selection via `--provider` flag and `.coding-agent.config.json`
✅ Provider-specific prompts adapted for each platform
✅ Clean abstraction with strategy pattern
✅ No mid-project provider switching
✅ Comprehensive error messages for missing dependencies
✅ Documentation updated with multi-provider usage examples
