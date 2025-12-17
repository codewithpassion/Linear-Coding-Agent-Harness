# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Linear-integrated autonomous coding agent harness available in both **Python** and **TypeScript/Bun** versions. It demonstrates a two-agent pattern where an initializer agent creates Linear issues from a specification, and subsequent coding agents implement features by working through those issues.

**Key Concept**: All work tracking happens in Linear (via MCP), not local files. Agents communicate through Linear issue comments and status updates.

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
# Start a fresh project (when SDK is available)
bun run src/index.ts --project-dir ./my_project

# Continue existing project
bun run src/index.ts --project-dir ./my_project

# Test with limited iterations
bun run src/index.ts --project-dir ./my_project --max-iterations 3

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
# Claude Code OAuth token (from 'claude setup-token')
export CLAUDE_CODE_OAUTH_TOKEN='your-token-here'

# Linear API key (from https://linear.app/YOUR-TEAM/settings/api)
export LINEAR_API_KEY='lin_api_xxxxxxxxxxxxx'
```

## Architecture

### Two-Agent Pattern

1. **Initializer Agent (Session 1)**
   - Reads `app_spec.txt` from `prompts/`
   - Creates Linear project and 50 issues via Linear MCP
   - Creates META issue for session handoff
   - Sets up project structure (`init.sh`, git, `.linear_project.json`)
   - Prompt: `prompts/initializer_prompt.md`

2. **Coding Agent (Sessions 2+)**
   - Queries Linear for Todo issues (highest priority first)
   - Runs regression tests on previously completed features
   - Claims issue (status → In Progress)
   - Implements feature and tests via Puppeteer MCP
   - Marks complete (status → Done) with comment
   - Updates META issue with session summary
   - Prompt: `prompts/coding_prompt.md`

### Core Modules

- **`autonomous_agent_demo.py`**: Main entry point, CLI argument parsing
- **`agent.py`**: Agent session loop and continuation logic
- **`client.py`**: Claude SDK client configuration, MCP server setup (Linear + Puppeteer)
- **`security.py`**: Bash command allowlist and validation hooks
- **`prompts.py`**: Prompt template loading utilities
- **`progress.py`**: Progress tracking via `.linear_project.json`
- **`linear_config.py`**: Linear configuration constants

### MCP Servers Used

| Server | Transport | Purpose |
|--------|-----------|---------|
| **Linear** | HTTP (`https://mcp.linear.app/mcp`) | Project management, issue tracking |
| **Puppeteer** | stdio (`npx puppeteer-mcp-server`) | Browser automation for UI testing |

### Security Model (Defense in Depth)

1. **OS Sandbox**: Bash commands run in isolated environment
2. **Filesystem Restrictions**: File operations restricted to project directory (`cwd`)
3. **Bash Allowlist**: Only specific commands permitted (see `security.ALLOWED_COMMANDS`)
4. **Security Hooks**: `bash_security_hook` validates commands pre-execution
5. **MCP Permissions**: Explicitly allowed tools in `.claude_settings.json`

Allowed commands: `ls`, `cat`, `pwd`, `npm`, `node`, `git`, `mkdir`, `cp`, `chmod` (+x only), `pkill` (dev processes only), and custom `init.sh` scripts.

### Linear Integration Details

**Marker File**: `.linear_project.json` in project directory indicates initialization complete.

**Key Linear MCP Tools**:
- `mcp__linear__create_project`: Create Linear project (initializer only)
- `mcp__linear__create_issue`: Create issues from spec (initializer creates 50)
- `mcp__linear__list_issues`: Query issues by status/priority
- `mcp__linear__update_issue`: Change status (Todo → In Progress → Done)
- `mcp__linear__create_comment`: Add implementation notes to issues
- `mcp__linear__list_teams`: Get team ID for project setup

**Workflow States**:
- `Todo`: Issue not started
- `In Progress`: Agent actively working
- `Done`: Feature implemented and verified

**Session Handoff**: Agents communicate via:
- Issue comments (implementation details, blockers)
- META issue comments (session summaries)
- Issue status transitions

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

Edit `prompts/initializer_prompt.md` and change "50 issues" to your desired count. Also update `linear_config.DEFAULT_ISSUE_COUNT` for consistency.

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

- **Initializer**: `prompts/initializer_prompt.md` - Instructions for setting up Linear project and issues
- **Coding**: `prompts/coding_prompt.md` - Instructions for implementing features from Linear issues

Both prompts are loaded fresh each session via `prompts.py`.

## Generated Project Structure

After running, the project directory contains:

```
my_project/
├── .linear_project.json      # Linear project state (team_id, project_id, meta_issue_id)
├── .claude_settings.json     # Security settings (auto-generated)
├── app_spec.txt              # Copied from prompts/
├── init.sh                   # Environment setup script (created by initializer)
└── [application files]       # Generated by coding agents
```

**`.linear_project.json` format**:
```json
{
  "initialized": true,
  "created_at": "2025-01-15T10:30:00Z",
  "team_id": "TEAM-abc123",
  "project_id": "PROJECT-xyz789",
  "project_name": "Claude.ai Clone",
  "meta_issue_id": "ISSUE-meta001",
  "total_issues": 50,
  "notes": "Project initialized by initializer agent"
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

Normal behavior - creating 50 Linear issues with detailed descriptions takes time. Watch for `[Tool: mcp__linear__create_issue]` output in console.

### Command Blocked by Security Hook

The agent tried a disallowed command. Add to `security.ALLOWED_COMMANDS` if safe, or implement validation logic if the command needs restrictions.

### Linear MCP Connection Failed

- Verify `LINEAR_API_KEY` is valid
- Check API key has read/write permissions at https://linear.app/YOUR-TEAM/settings/api
- Ensure Linear MCP server is accessible at `https://mcp.linear.app/mcp`

### Agent Not Continuing After Session

Check `AUTO_CONTINUE_DELAY_SECONDS` in `agent.py`. Default is 3 seconds between sessions. Increase if needed for debugging.

## Design Principles

1. **Linear as Source of Truth**: Never use local text files for work tracking - query Linear
2. **Stateless Sessions**: Each session gets fresh context; handoff via Linear comments
3. **Defense in Depth**: Multiple security layers (sandbox + filesystem + allowlist + hooks)
4. **UI-First Testing**: Always verify features through browser automation, not just API tests
5. **Clean Handoffs**: Sessions end with detailed META issue comments for next agent
