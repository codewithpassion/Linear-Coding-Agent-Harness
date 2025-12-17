# Autonomous Coding Agent Harness (Multi-Provider)

A minimal harness demonstrating long-running autonomous coding with the Claude Agent SDK. This demo implements a two-agent pattern (initializer + coding agent) with **multiple project management backends** for tracking all work.

## Key Features

- **Multi-Provider Support**: Choose between Linear, Beads, or Plane.so for project management
- **Real-time Visibility**: Watch agent progress in your chosen platform
- **Session Handoff**: Agents communicate via issue comments and status updates
- **Two-Agent Pattern**: Initializer creates project & issues, coding agents implement them
- **Browser Testing**: Puppeteer MCP for UI verification
- **Claude Opus 4.5**: Uses Claude's most capable model by default

## Supported Providers

### Linear (Default - MCP via HTTP)
- **Transport**: MCP Server over HTTP
- **Authentication**: API key via LINEAR_API_KEY
- **Best for**: Teams already using Linear
- **Network**: Required

### Beads (Git-Native Issue Tracker)
- **Transport**: CLI tool (`bd`)
- **Authentication**: None (local Git-based)
- **Best for**: Local-first workflow, no external dependencies
- **Network**: Not required (works offline)

### Plane.so (Self-Hostable Project Management)
- **Transport**: REST API
- **Authentication**: API key via PLANE_API_KEY
- **Best for**: Self-hosted or Plane.so cloud users
- **Network**: Required

## Prerequisites

### 1. Install Claude Code CLI and Python SDK

```bash
# Install Claude Code CLI (latest version required)
npm install -g @anthropic-ai/claude-code

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Set Up Authentication

You need Claude Code authentication plus provider-specific credentials:

**Claude Code OAuth Token (Required for all providers):**
```bash
# Generate the token using Claude Code CLI
claude setup-token

# Set the environment variable
export CLAUDE_CODE_OAUTH_TOKEN='your-oauth-token-here'
```

**Provider-Specific Authentication:**

#### Linear
```bash
# Get your API key from: https://linear.app/YOUR-TEAM/settings/api
export LINEAR_API_KEY='lin_api_xxxxxxxxxxxxx'
```

#### Beads
```bash
# Install Beads CLI
npm install -g @beads/bd

# Or via Go
go install github.com/beads-os/bd@latest

# No API key needed - Beads is Git-based and local
```

#### Plane.so
```bash
# Get your API key from: https://app.plane.so/settings
export PLANE_API_KEY='your-plane-api-key'

# Optional: Configure workspace in .coding-agent.config.json
echo '{
  "provider": "plane",
  "plane": {
    "workspaceSlug": "your-workspace",
    "baseUrl": "https://api.plane.so"
  }
}' > .coding-agent.config.json
```

### 3. Verify Installation

```bash
claude --version  # Should be latest version
pip show claude-code-sdk  # Check SDK is installed

# For Beads
bd --version  # If using Beads provider
```

## Quick Start

### Linear (Default)
```bash
python autonomous_agent_demo.py --project-dir ./my_project
```

### Beads
```bash
python autonomous_agent_demo.py --project-dir ./my_project --provider beads
```

### Plane.so
```bash
python autonomous_agent_demo.py --project-dir ./my_project --provider plane
```

For testing with limited iterations:
```bash
python autonomous_agent_demo.py --project-dir ./my_project --max-iterations 3 --provider beads
```

## How It Works

### Multi-Provider Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│                    MULTI-PROVIDER ARCHITECTURE                   │
├──────────────────────────────────────────────────────────────────┤
│  app_spec.txt ──► Initializer Agent ──► Provider Issues (50)    │
│                                              │                    │
│                    ┌─────────────────────────▼─────────────────┐ │
│                    │   PROVIDER (Linear / Beads / Plane)       │ │
│                    │  ┌─────────────────────────────────────┐  │ │
│                    │  │ Issue: Auth - Login flow            │  │ │
│                    │  │ Status: Todo → In Progress → Done   │  │ │
│                    │  │ Comments: [implementation notes]    │  │ │
│                    │  └─────────────────────────────────────┘  │ │
│                    └────────────────────────────────────────────┘ │
│                                              │                    │
│                    Coding Agent queries provider                 │
│                    ├── Search for Todo issues                    │
│                    ├── Update status to In Progress              │
│                    ├── Implement & test with Puppeteer           │
│                    ├── Add comment with implementation notes     │
│                    └── Update status to Done                     │
└──────────────────────────────────────────────────────────────────┘
```

### Two-Agent Pattern

1. **Initializer Agent (Session 1):**
   - Reads `app_spec.txt`
   - Creates project in chosen provider (Linear project, Beads init, or Plane workspace)
   - Creates 50 issues with detailed test steps
   - Creates a META issue for session tracking
   - Sets up project structure, `init.sh`, and git

2. **Coding Agent (Sessions 2+):**
   - Queries provider for highest-priority Todo issue
   - Runs verification tests on previously completed features
   - Claims issue (status → In Progress)
   - Implements the feature
   - Tests via Puppeteer browser automation
   - Adds implementation comment to issue
   - Marks complete (status → Done)
   - Updates META issue with session summary

### Provider-Specific Details

#### Linear Workflow
- Uses MCP tools (18 Linear-specific tools)
- HTTP transport to `https://mcp.linear.app/mcp`
- Issues have UUID-like IDs
- Real-time collaboration

#### Beads Workflow
- Uses `bd` CLI commands via Bash tool
- Git-based storage in `.beads/issues.jsonl`
- Hash-based IDs (e.g., `bd-a1b2`)
- Works completely offline
- Advanced dependency tracking

#### Plane Workflow
- Uses direct REST API calls
- Rate limited to 60 requests/minute
- Readable IDs (e.g., `PROJ-123`)
- Self-hostable or cloud-based

## Environment Variables

| Variable | Description | Required For |
|----------|-------------|--------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token (from `claude setup-token`) | All providers |
| `LINEAR_API_KEY` | Linear API key for MCP access | Linear only |
| `PLANE_API_KEY` | Plane.so API key for REST API | Plane only |

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--project-dir` | Directory for the project | `./autonomous_demo_project` |
| `--max-iterations` | Max agent iterations | Unlimited |
| `--model` | Claude model to use | `claude-opus-4-5-20251101` |
| `--provider` | Project management provider (`linear`, `beads`, `plane`) | Auto-detect or `linear` |

## Project Structure

```
linear-agent-harness/
├── autonomous_agent_demo.py  # Main entry point (Python)
├── agent.py                  # Agent session logic
├── client.py                 # Claude SDK + MCP client configuration
├── security.py               # Bash command allowlist and validation
├── progress.py               # Progress tracking utilities
├── prompts.py                # Prompt loading utilities
├── linear_config.py          # Linear configuration constants
├── src/                      # TypeScript/Bun version
│   ├── providers/            # Multi-provider implementations
│   │   ├── types.ts          # Provider interface
│   │   ├── factory.ts        # Provider creation and auto-detection
│   │   ├── linear-provider.ts
│   │   ├── beads-provider.ts
│   │   ├── beads-utils.ts
│   │   ├── plane-provider.ts
│   │   └── plane-client.ts
│   ├── config.ts             # Configuration file handling
│   └── index.ts              # TypeScript entry point
├── prompts/
│   ├── app_spec.txt          # Application specification (shared)
│   ├── linear/               # Linear-specific prompts
│   │   ├── initializer_prompt.md
│   │   └── coding_prompt.md
│   ├── beads/                # Beads-specific prompts
│   │   ├── initializer_prompt.md
│   │   └── coding_prompt.md
│   └── plane/                # Plane-specific prompts
│       ├── initializer_prompt.md
│       └── coding_prompt.md
└── requirements.txt          # Python dependencies
```

## Generated Project Structure

After running, your project directory will contain provider-specific marker files:

### Linear Projects
```
my_project/
├── .linear_project.json      # Linear project state (marker file)
├── app_spec.txt              # Copied specification
├── init.sh                   # Environment setup script
├── .claude_settings.json     # Security settings
└── [application files]       # Generated application code
```

### Beads Projects
```
my_project/
├── .beads/
│   ├── issues.jsonl          # Git-committed issue database (marker file)
│   └── beads.db              # SQLite cache (gitignored)
├── app_spec.txt
├── init.sh
├── .claude_settings.json
└── [application files]
```

### Plane Projects
```
my_project/
├── .plane_project.json       # Plane project state (marker file)
├── app_spec.txt
├── init.sh
├── .claude_settings.json
└── [application files]
```

## MCP Servers Used

| Server | Transport | Used By |
|--------|-----------|---------|
| **Linear** | HTTP (Streamable HTTP) | Linear provider |
| **Puppeteer** | stdio | All providers (browser testing) |

Note: Beads and Plane don't use MCP servers - Beads uses CLI commands, Plane uses direct REST API calls.

## Provider Comparison

| Feature | Linear | Beads | Plane |
|---------|--------|-------|-------|
| **Transport** | MCP (HTTP) | CLI + Git | REST API |
| **Authentication** | API key | None (local) | API key |
| **Network Required** | Yes | No | Yes |
| **Rate Limit** | N/A | None | 60 req/min |
| **Issue IDs** | UUID-like | Hash-based (bd-a1b2) | Readable (PROJ-123) |
| **Dependencies** | Basic | Advanced (4 types) | Basic |
| **Self-Hosted** | No | Yes (Git) | Yes |
| **Collaboration** | Real-time | Git-based | Real-time |

## Security Model

This demo uses defense-in-depth security (see `security.py` and `client.py`):

1. **OS-level Sandbox:** Bash commands run in an isolated environment
2. **Filesystem Restrictions:** File operations restricted to project directory
3. **Bash Allowlist:** Only specific commands permitted (npm, node, git, bd, etc.)
4. **MCP Permissions:** Tools explicitly allowed in security settings

## Provider Setup

### Linear Setup
1. Create a Linear workspace with at least one team
2. Get an API key with read/write permissions (Settings > API)
3. The agent will automatically detect your team and create a project

### Beads Setup
1. Install Beads CLI: `npm install -g @beads/bd`
2. No additional configuration needed
3. Issues are stored in Git (`.beads/issues.jsonl`)

### Plane Setup
1. Sign up at plane.so or deploy self-hosted instance
2. Get API key from Settings
3. Configure workspace slug in `.coding-agent.config.json`

## Customization

### Changing the Application

Edit `prompts/app_spec.txt` to specify a different application to build.

### Adjusting Issue Count

Edit the provider-specific `prompts/{provider}/initializer_prompt.md` and change "50 issues" to your desired count.

### Modifying Allowed Commands

Edit `security.py` to add or remove commands from `ALLOWED_COMMANDS`.

## Troubleshooting

**"CLAUDE_CODE_OAUTH_TOKEN not set"**
Run `claude setup-token` to generate a token, then export it.

**"LINEAR_API_KEY not set"** (Linear provider only)
Get your API key from `https://linear.app/YOUR-TEAM/settings/api`

**"Beads CLI (bd) not found"** (Beads provider only)
Install via `npm install -g @beads/bd` or Go: `go install github.com/beads-os/bd@latest`

**"PLANE_API_KEY not set"** (Plane provider only)
Get your API key from `https://app.plane.so/settings`

**"Plane workspace slug not configured"** (Plane provider only)
Add workspace slug to `.coding-agent.config.json` or project state file.

**"Appears to hang on first run"**
Normal behavior. The initializer is creating a project and 50 issues with detailed descriptions. For Plane, rate limiting means this takes about 1 minute.

**"Command blocked by security hook"**
The agent tried to run a disallowed command. Add it to `ALLOWED_COMMANDS` in `security.py` if needed.

**"MCP server connection failed"** (Linear provider only)
Verify your `LINEAR_API_KEY` is valid and has appropriate permissions. The Linear MCP server uses HTTP transport at `https://mcp.linear.app/mcp`.

## Viewing Progress

### Linear
Open your Linear workspace to see:
- The project created by the initializer agent
- All 50 issues organized under the project
- Real-time status changes (Todo → In Progress → Done)
- Implementation comments on each issue

### Beads
Use Git and bd CLI:
```bash
cd my_project
bd list --status open
bd list --status closed
git log  # See session commits and META issue updates
```

### Plane
Open your Plane workspace to see:
- The project created by the initializer
- All 50 work items with states
- Comments on each work item
- Real-time progress tracking

## TypeScript/Bun Version

See [README-TYPESCRIPT.md](README-TYPESCRIPT.md) for details on the TypeScript/Bun implementation with multi-provider support.

## License

MIT License - see [LICENSE](LICENSE) for details.
