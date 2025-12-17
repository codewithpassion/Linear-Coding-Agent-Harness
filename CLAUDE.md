# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a **multi-provider** autonomous coding agent harness available in both **Python** (Linear-only) and **TypeScript/Bun** (multi-provider) versions. It demonstrates a two-agent pattern where an initializer agent creates project issues from a specification, and subsequent coding agents implement features by working through those issues.

**Key Concept**: All work tracking happens in your chosen provider (Linear, Beads, or Plane.so), not local files. Agents communicate through issue comments and status updates.

### Supported Providers

The **TypeScript/Bun version** supports three project management backends:

1. **Linear** (MCP via HTTP) - Real-time collaboration, requires LINEAR_API_KEY
2. **Beads** (Git-Native CLI) - Local-first, works offline, no API keys needed
3. **Plane.so** (REST API) - Self-hostable, requires PLANE_API_KEY

The **Python version** currently supports Linear only.

### Available Implementations

1. **Python** (Original) - `*.py` files, uses `claude-code-sdk` Python package
2. **TypeScript/Bun** (Converted) - `src/*.ts` files, strict TypeScript with no `any` types

**Note**: The TypeScript version is a complete conversion but requires the Claude Agent SDK for TypeScript/JavaScript, which is not yet publicly available. See `README-TYPESCRIPT.md` for details.

## Common Commands

### Running the Demo (Python)

```bash
# Start a fresh project
python autonomous_agent_demo.py --project-dir ./my_project

# Continue existing project
python autonomous_agent_demo.py --project-dir ./my_project

# Test with limited iterations
python autonomous_agent_demo.py --project-dir ./my_project --max-iterations 3

# Use different model
python autonomous_agent_demo.py --project-dir ./my_project --model claude-sonnet-4-5-20250929
```

### Running the Demo (TypeScript/Bun)

```bash
# Start a fresh project with Linear (default)
bun run src/index.ts --project-dir ./my_project

# Start with Beads (Git-native, works offline)
bun run src/index.ts --project-dir ./my_project --provider beads

# Start with Plane.so
bun run src/index.ts --project-dir ./my_project --provider plane

# Continue existing project (auto-detects provider from marker files)
bun run src/index.ts --project-dir ./my_project

# Test with limited iterations
bun run src/index.ts --project-dir ./my_project --max-iterations 3 --provider beads

# Use different model
bun run src/index.ts --project-dir ./my_project --model claude-sonnet-4-5-20250929
```

### Development

```bash
# Python: Install dependencies
pip install -r requirements.txt

# Python: Run security tests
python test_security.py

# TypeScript/Bun: Install dependencies
bun install

# TypeScript/Bun: Run security tests
bun run src/test-security.ts

# TypeScript/Bun: Lint code
bun run lint

# TypeScript/Bun: Type check
bun run typecheck
```

### Required Environment Variables

```bash
# Claude Code OAuth token (from 'claude setup-token') - REQUIRED FOR ALL PROVIDERS
export CLAUDE_CODE_OAUTH_TOKEN='your-token-here'

# Provider-specific authentication:

# Linear (Python + TypeScript)
export LINEAR_API_KEY='lin_api_xxxxxxxxxxxxx'
# Get from: https://linear.app/YOUR-TEAM/settings/api

# Beads (TypeScript only) - No API key needed!
# Install CLI: npm install -g @beads/bd

# Plane.so (TypeScript only)
export PLANE_API_KEY='your-plane-api-key'
# Get from: https://app.plane.so/settings
```

## Architecture

### Two-Agent Pattern

1. **Initializer Agent (Session 1)**
   - Reads `app_spec.txt` from `prompts/`
   - Creates project and 50 issues in chosen provider (Linear/Beads/Plane)
   - Creates META issue for session handoff
   - Sets up project structure (`init.sh`, git, marker file)
   - Prompt: `prompts/{provider}/initializer_prompt.md`

2. **Coding Agent (Sessions 2+)**
   - Queries provider for Todo issues (highest priority first)
   - Runs regression tests on previously completed features
   - Claims issue (status → In Progress)
   - Implements feature and tests via Puppeteer MCP
   - Marks complete (status → Done) with comment
   - Updates META issue with session summary
   - Prompt: `prompts/{provider}/coding_prompt.md`

### Multi-Provider Architecture (TypeScript/Bun)

The TypeScript version implements a clean **strategy pattern** for swappable project management backends:

**Provider Interface** (`src/providers/types.ts`):
```typescript
interface ProjectManagementProvider {
  readonly name: ProviderType;  // "linear" | "beads" | "plane"

  // Environment & Configuration
  validateEnvironment(): void;
  getMcpServerConfig(): MCPServerConfiguration | null;
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

**Provider Detection Precedence** (highest to lowest):
1. **Marker Files**: `.linear_project.json` → Linear, `.beads/issues.jsonl` → Beads, `.plane_project.json` → Plane
2. **Config File**: `.coding-agent.config.json` `provider` field
3. **CLI Flag**: `--provider linear|beads|plane`
4. **Default**: Linear

**Provider Implementations**:
- **LinearProvider** (`src/providers/linear-provider.ts`) - Uses Linear MCP over HTTP
- **BeadsProvider** (`src/providers/beads-provider.ts`) - Uses `bd` CLI via Bash tool
- **PlaneProvider** (`src/providers/plane-provider.ts`) - Uses direct REST API calls

### Core Modules

**Python (Linear-only)**:
- **`autonomous_agent_demo.py`**: Main entry point, CLI argument parsing
- **`agent.py`**: Agent session loop and continuation logic
- **`client.py`**: Claude SDK client configuration, MCP server setup (Linear + Puppeteer)
- **`security.py`**: Bash command allowlist and validation hooks
- **`prompts.py`**: Prompt template loading utilities
- **`progress.py`**: Progress tracking via `.linear_project.json`
- **`linear_config.py`**: Linear configuration constants

**TypeScript/Bun (Multi-provider)**:
- **`src/index.ts`**: Main entry point, CLI argument parsing with `--provider` flag
- **`src/agent.ts`**: Agent session loop with provider detection
- **`src/client.ts`**: Claude SDK client configuration, dynamic MCP setup
- **`src/security.ts`**: Bash command allowlist and validation hooks
- **`src/config.ts`**: Config file management (`.coding-agent.config.json`)
- **`src/providers/types.ts`**: Provider interface and ProjectState type
- **`src/providers/factory.ts`**: Provider creation and auto-detection
- **`src/providers/linear-provider.ts`**: Linear MCP implementation (268 lines)
- **`src/providers/beads-provider.ts`**: Beads CLI implementation (192 lines)
- **`src/providers/beads-utils.ts`**: Beads CLI wrapper utilities (196 lines)
- **`src/providers/plane-provider.ts`**: Plane REST implementation (296 lines)
- **`src/providers/plane-client.ts`**: Plane REST API client (342 lines)

### MCP Servers Used

| Server | Transport | Used By | Purpose |
|--------|-----------|---------|---------|
| **Linear** | HTTP (`https://mcp.linear.app/mcp`) | Linear provider | Project management, issue tracking |
| **Puppeteer** | stdio (`npx puppeteer-mcp-server`) | All providers | Browser automation for UI testing |

**Note**: Only Linear uses an MCP server for project management. Beads uses CLI commands via the Bash tool, and Plane uses direct REST API calls via fetch().

### Security Model (Defense in Depth)

1. **OS Sandbox**: Bash commands run in isolated environment
2. **Filesystem Restrictions**: File operations restricted to project directory (`cwd`)
3. **Bash Allowlist**: Only specific commands permitted (see `security.ALLOWED_COMMANDS`)
4. **Security Hooks**: `bash_security_hook` validates commands pre-execution
5. **MCP Permissions**: Explicitly allowed tools in `.claude_settings.json`

Allowed commands: `ls`, `cat`, `pwd`, `npm`, `node`, `git`, `mkdir`, `cp`, `chmod` (+x only), `pkill` (dev processes only), `bd` (Beads CLI), and custom `init.sh` scripts.

### Provider Integration Details

#### Linear (MCP via HTTP)

**Marker File**: `.linear_project.json`

**Key Linear MCP Tools** (18 total):
- `mcp__linear__create_project`: Create Linear project (initializer only)
- `mcp__linear__create_issue`: Create issues from spec (initializer creates 50)
- `mcp__linear__list_issues`: Query issues by status/priority
- `mcp__linear__update_issue`: Change status (Todo → In Progress → Done)
- `mcp__linear__create_comment`: Add implementation notes to issues
- `mcp__linear__list_teams`: Get team ID for project setup

**Workflow States**: Todo → In Progress → Done

**Session Handoff**: Via issue comments and status transitions

#### Beads (Git-Native CLI)

**Marker File**: `.beads/issues.jsonl` (Git-committed database)

**Key CLI Commands** (via Bash tool):
- `bd init`: Initialize Beads in project
- `bd create`: Create new issue with hash-based ID (e.g., `bd-a1b2`)
- `bd list --status open`: List open issues
- `bd ready --json`: Get issues with no blockers
- `bd update <id> --status in_progress`: Claim issue
- `bd close <id> --reason done`: Mark complete

**Workflow States**: open → in_progress → closed

**Session Handoff**: Via issue descriptions and Git commits

**Advanced Features**:
- 4 dependency types (blocks, blocked_by, relates_to, duplicates)
- Hierarchical issues (dot-notation like `bd-a1b2.1`)
- Works completely offline (Git-based storage)

#### Plane.so (REST API)

**Marker File**: `.plane_project.json`

**Key API Endpoints** (via PlaneApiClient):
- `POST /projects/`: Create project
- `POST /work-items/`: Create work item
- `GET /work-items/?state=todo`: List work items by state
- `PATCH /work-items/<id>/`: Update work item state
- `POST /comments/`: Add comments to work items

**Workflow States**: Todo → In Progress → Done (customizable)

**Session Handoff**: Via work item comments and state transitions

**Rate Limiting**: 60 requests/minute (1-second delay enforced by PlaneApiClient)

## Key Implementation Patterns

### Security Hook Pattern

```python
# security.py - Pre-tool-use hook validates bash commands
async def bash_security_hook(input_data, tool_use_id=None, context=None):
    command = input_data.get("tool_input", {}).get("command", "")
    commands = extract_commands(command)

    for cmd in commands:
        if cmd not in ALLOWED_COMMANDS:
            return {"decision": "block", "reason": f"Command '{cmd}' not allowed"}

    # Extra validation for sensitive commands
    if "pkill" in commands:
        allowed, reason = validate_pkill_command(command)
        if not allowed:
            return {"decision": "block", "reason": reason}

    return {}  # Allow
```

Hooks are registered in `client.py` via `ClaudeCodeOptions.hooks`.

### Agent Session Loop

```python
# agent.py - Main autonomous loop
async def run_autonomous_agent(project_dir, model, max_iterations):
    is_first_run = not is_linear_initialized(project_dir)

    while True:
        client = create_client(project_dir, model)  # Fresh context each iteration

        if is_first_run:
            prompt = get_initializer_prompt()
            is_first_run = False
        else:
            prompt = get_coding_prompt()

        async with client:
            status, response = await run_agent_session(client, prompt, project_dir)

        await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)
```

Each session gets a fresh `ClaudeSDKClient` instance (fresh context window).

### MCP Server Configuration

```python
# client.py - Streamable HTTP transport for Linear MCP
mcp_servers={
    "puppeteer": {"command": "npx", "args": ["puppeteer-mcp-server"]},
    "linear": {
        "type": "http",
        "url": "https://mcp.linear.app/mcp",
        "headers": {"Authorization": f"Bearer {linear_api_key}"}
    }
}
```

Linear uses HTTP transport (recommended over SSE for production).

## Customizing the Demo

### Changing the Application Spec

Edit `prompts/app_spec.txt` to specify a different application to build. The initializer agent will read this file and create Linear issues based on its contents.

### Adjusting Issue Count

**Python**: Edit `prompts/initializer_prompt.md` and change "50 issues" to your desired count. Also update `linear_config.DEFAULT_ISSUE_COUNT` for consistency.

**TypeScript/Bun**: Edit `prompts/{provider}/initializer_prompt.md` (where `{provider}` is `linear`, `beads`, or `plane`) and change "50 issues" to your desired count.

### Adding Allowed Commands

Edit `security.py`:

```python
ALLOWED_COMMANDS = {
    "ls", "cat", "npm", "node", "git",
    # Add your commands here
    "python", "pytest",  # Example additions
}
```

For commands needing extra validation (like `pkill`, `chmod`), add them to `COMMANDS_NEEDING_EXTRA_VALIDATION` and implement a validation function.

### Modifying Prompts

**Python (Linear-only)**:
- **Initializer**: `prompts/initializer_prompt.md` - Instructions for setting up Linear project and issues
- **Coding**: `prompts/coding_prompt.md` - Instructions for implementing features from Linear issues

Both prompts are loaded fresh each session via `prompts.py`.

**TypeScript/Bun (Multi-provider)**:
- **Linear**:
  - Initializer: `prompts/linear/initializer_prompt.md` - Uses Linear MCP tools
  - Coding: `prompts/linear/coding_prompt.md` - Linear workflow
- **Beads**:
  - Initializer: `prompts/beads/initializer_prompt.md` - Uses `bd` CLI commands
  - Coding: `prompts/beads/coding_prompt.md` - Git-based workflow with dependencies
- **Plane**:
  - Initializer: `prompts/plane/initializer_prompt.md` - Uses REST API with fetch()
  - Coding: `prompts/plane/coding_prompt.md` - REST workflow with rate limiting

All prompts are loaded dynamically based on the detected or selected provider.

## Generated Project Structure

After running, the project directory contains provider-specific marker files:

### Linear Projects
```
my_project/
├── .linear_project.json      # Linear project state (marker file)
├── .claude_settings.json     # Security settings (auto-generated)
├── app_spec.txt              # Copied from prompts/
├── init.sh                   # Environment setup script (created by initializer)
└── [application files]       # Generated by coding agents
```

**`.linear_project.json` format**:
```json
{
  "initialized": true,
  "provider": "linear",
  "created_at": "2025-01-15T10:30:00Z",
  "project_id": "PROJECT-xyz789",
  "project_name": "Claude.ai Clone",
  "meta_issue_id": "ISSUE-meta001",
  "total_issues": 50,
  "provider_data": {
    "team_id": "TEAM-abc123"
  }
}
```

### Beads Projects
```
my_project/
├── .beads/
│   ├── issues.jsonl          # Git-committed issue database (marker file)
│   └── beads.db              # SQLite cache (gitignored)
├── .claude_settings.json
├── app_spec.txt
├── init.sh
└── [application files]
```

### Plane Projects
```
my_project/
├── .plane_project.json       # Plane project state (marker file)
├── .claude_settings.json
├── app_spec.txt
├── init.sh
└── [application files]
```

**`.plane_project.json` format**:
```json
{
  "initialized": true,
  "provider": "plane",
  "created_at": "2025-01-15T10:30:00Z",
  "project_id": "abc123-def456",
  "project_name": "Claude.ai Clone",
  "meta_issue_id": "PROJ-1",
  "total_issues": 50,
  "provider_data": {
    "workspace_slug": "my-workspace",
    "project_identifier": "PROJ"
  }
}
```

## Testing Verification Requirements

**Critical Pattern**: Coding agents MUST verify features through browser automation (Puppeteer), not just backend tests. The prompts enforce this:

- Navigate to feature in browser
- Take screenshots to verify visual appearance
- Test complete user workflows end-to-end
- Check for console errors
- Verify UI bugs (contrast, layout, text rendering)

This ensures production-quality UI implementation, not just functional code.

## Troubleshooting

### Initializer Session Appears to Hang

Normal behavior - creating 50 issues with detailed descriptions takes time. For Plane, rate limiting means this takes about 1 minute. Watch for tool output in console:
- Linear: `[Tool: mcp__linear__create_issue]`
- Beads: `[Tool: Bash]` with `bd create` commands
- Plane: REST API calls with 1-second delays

### Command Blocked by Security Hook

The agent tried a disallowed command. Add to `security.ALLOWED_COMMANDS` if safe, or implement validation logic if the command needs restrictions.

### Provider-Specific Issues

**Linear MCP Connection Failed**:
- Verify `LINEAR_API_KEY` is valid
- Check API key has read/write permissions at https://linear.app/YOUR-TEAM/settings/api
- Ensure Linear MCP server is accessible at `https://mcp.linear.app/mcp`

**Beads CLI Not Found** (TypeScript only):
- Install via `npm install -g @beads/bd`
- Or via Go: `go install github.com/beads-os/bd@latest`
- Verify with `bd --version`

**Plane API Key Not Set** (TypeScript only):
- Get API key from https://app.plane.so/settings
- Export as `PLANE_API_KEY` environment variable
- Configure workspace slug in `.coding-agent.config.json`

**Provider Not Auto-Detected**:
- Check for marker files in project directory
- Linear: `.linear_project.json`
- Beads: `.beads/issues.jsonl`
- Plane: `.plane_project.json`
- Use `--provider` flag to explicitly set provider for new projects

### Agent Not Continuing After Session

Check `AUTO_CONTINUE_DELAY_SECONDS` in `agent.py`. Default is 3 seconds between sessions. Increase if needed for debugging.

## Design Principles

1. **Provider as Source of Truth**: Never use local text files for work tracking - query your chosen provider (Linear/Beads/Plane)
2. **Stateless Sessions**: Each session gets fresh context; handoff via provider comments
3. **Defense in Depth**: Multiple security layers (sandbox + filesystem + allowlist + hooks)
4. **UI-First Testing**: Always verify features through browser automation (Puppeteer), not just API tests
5. **Clean Handoffs**: Sessions end with detailed META issue comments for next agent
6. **Provider Abstraction** (TypeScript): Clean strategy pattern allows swapping backends without changing agent logic
7. **Backward Compatibility**: Existing Linear projects work identically after multi-provider refactor
