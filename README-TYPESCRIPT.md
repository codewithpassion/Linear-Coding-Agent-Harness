# TypeScript/Bun Implementation (Multi-Provider)

This is a **complete TypeScript/Bun implementation** of the Autonomous Coding Agent Harness with **multi-provider support** for Linear, Beads, and Plane.so.

## Multi-Provider Architecture

The TypeScript version implements a clean strategy pattern for swappable project management backends:

### Supported Providers

1. **Linear** (MCP via HTTP)
   - Transport: MCP Server
   - Authentication: LINEAR_API_KEY
   - 18 MCP tools for issue management

2. **Beads** (Git-Native)
   - Transport: CLI commands via Bash
   - Authentication: None (local Git-based)
   - Works completely offline

3. **Plane.so** (REST API)
   - Transport: Direct HTTP requests
   - Authentication: PLANE_API_KEY
   - Rate limiting (60 req/min)

### Browser Automation Providers

1. **Chrome DevTools** (MCP via stdio) - **Default**
   - 24+ tools including network inspection, performance profiling, console access
   - Requires Chrome with remote debugging (auto-launched if not running)
   - MCP command: `npx chrome-devtools-mcp@latest --browser-url http://localhost:9222`

2. **Puppeteer** (MCP via stdio)
   - 7 basic tools for lightweight browser automation
   - Headless browser automation
   - MCP command: `npx puppeteer-mcp-server`

## Quick Start

### Prerequisites

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Set up authentication
export CLAUDE_CODE_OAUTH_TOKEN='your-token'
export LINEAR_API_KEY='your-linear-key'  # For Linear
export PLANE_API_KEY='your-plane-key'    # For Plane

# Install Beads CLI (if using Beads)
npm install -g @beads/bd
```

### Run with Different Providers

```bash
# Linear (default PM) + Chrome DevTools (default browser)
bun run src/index.ts --project-dir ./my_project

# Beads (Git-native, works offline)
bun run src/index.ts --project-dir ./my_project --provider beads

# Plane.so
bun run src/index.ts --project-dir ./my_project --provider plane

# Use Puppeteer instead of Chrome DevTools
bun run src/index.ts --project-dir ./my_project --browser puppeteer

# Combine PM and browser provider selection
bun run src/index.ts --project-dir ./my_project --provider beads --browser chrome-devtools

# With limited iterations
bun run src/index.ts --project-dir ./my_project --max-iterations 3 --provider beads
```

### Chrome DevTools Setup

```bash
# Option 1: Auto-launch (recommended)
# The agent will automatically start Chrome with remote debugging
bun run src/index.ts --project-dir ./my_project --browser chrome-devtools

# Option 2: Manual launch
google-chrome --remote-debugging-port=9222 &
bun run src/index.ts --project-dir ./my_project --browser chrome-devtools

# Option 3: Custom port
export CHROME_DEVTOOLS_URL=http://localhost:9333
google-chrome --remote-debugging-port=9333 &
bun run src/index.ts --project-dir ./my_project --browser chrome-devtools
```

### Building a Standalone Executable

You can build a self-contained executable that includes the Bun runtime:

```bash
# Build standalone executable (outputs to dist/coding-agent)
bun run build:standalone

# Run the executable directly
./dist/coding-agent --project-dir ./my_project --provider beads

# Distribute the executable (no Bun installation needed on target machine)
cp dist/coding-agent /usr/local/bin/coding-agent
coding-agent --help
```

**Benefits**:
- Single ~100MB executable (includes Bun runtime)
- No Node.js or Bun installation required on target machine
- Faster startup than interpreted execution
- Ideal for distribution and deployment

**Note**: The executable still requires environment variables (CLAUDE_CODE_OAUTH_TOKEN, LINEAR_API_KEY, etc.) and external tools (bd CLI for Beads, npx for MCP servers, Chrome for Chrome DevTools).

## Provider Implementation Details

### Architecture Overview

```typescript
// Core abstraction
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

### Provider Implementations

#### LinearProvider (`src/providers/linear-provider.ts`)
- Extracted from original hardcoded Linear logic
- Uses MCP Server at `https://mcp.linear.app/mcp`
- 18 Linear-specific MCP tools
- Marker file: `.linear_project.json`
- Prompts: `prompts/linear/`

#### BeadsProvider (`src/providers/beads-provider.ts`)
- Wraps `bd` CLI tool via `beads-utils.ts`
- No MCP server needed (uses Bash tool)
- Hash-based issue IDs (e.g., `bd-a1b2`)
- Marker file: `.beads/issues.jsonl`
- Prompts: `prompts/beads/`
- Advanced features: 4 dependency types, hierarchical issues

**Beads CLI Utilities** (`src/providers/beads-utils.ts`):
- `bdInit()` - Initialize Beads
- `bdList(status?)` - List issues
- `bdReady()` - Get ready issues (no blockers)
- `bdCreate()` - Create issue
- `bdUpdate()` - Update status
- `bdClose()` - Close with reason

#### PlaneProvider (`src/providers/plane-provider.ts`)
- Direct REST API client (`plane-client.ts`)
- Automatic rate limiting (1 sec between requests)
- Workspace-aware configuration
- Marker file: `.plane_project.json`
- Prompts: `prompts/plane/`

**Plane REST Client** (`src/providers/plane-client.ts`):
- Full TypeScript API client
- Rate limiting built-in
- Projects, work items, comments, states
- Error handling with status codes

### Provider Auto-Detection

The factory automatically detects providers based on marker files:

```typescript
// Detection precedence:
// 1. Marker files (highest priority)
//    - .linear_project.json → Linear
//    - .beads/issues.jsonl → Beads
//    - .plane_project.json → Plane
// 2. Config file (.coding-agent.config.json)
// 3. CLI flag (--provider)
// 4. Default (linear)

const provider = await detectAndCreateProvider(
  projectDir,
  cliProvider,
  defaultProvider
);
```

## Available Commands

```bash
# Run the agent
bun run src/index.ts --project-dir ./my_project [--provider linear|beads|plane]

# Development commands
bun run lint              # Run linter
bun run lint:fix          # Fix linting issues
bun run format            # Format code
bun run typecheck         # Type check
bun run src/test-security.ts  # Run security tests
```

## Configuration File

Create `.coding-agent.config.json` in your project directory:

```json
{
  "provider": "plane",
  "linear": {
    "apiKey": "optional-override"
  },
  "beads": {
    "bdPath": "/custom/path/to/bd"
  },
  "plane": {
    "apiKey": "optional-override",
    "baseUrl": "https://api.plane.so",
    "workspaceSlug": "your-workspace"
  }
}
```

## Type Safety

The project uses the strictest possible TypeScript configuration:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

All provider implementations:
- ✅ No `any` types
- ✅ Comprehensive JSDoc comments
- ✅ Proper null/undefined handling
- ✅ Type-safe promise chains

## Code Structure

```
src/
├── providers/                  # Multi-provider implementation
│   ├── types.ts                # Provider interface & ProjectState
│   ├── factory.ts              # Provider creation & auto-detection
│   ├── linear-provider.ts      # Linear MCP implementation
│   ├── beads-provider.ts       # Beads CLI implementation
│   ├── beads-utils.ts          # bd CLI wrappers
│   ├── plane-provider.ts       # Plane REST implementation
│   └── plane-client.ts         # Plane API client
├── config.ts                   # Config file handling
├── linear-config.ts            # Linear constants (used by LinearProvider)
├── security.ts                 # Security hooks & validation
├── prompts.ts                  # Prompt loading utilities
├── progress.ts                 # Progress display (provider-agnostic)
├── client.ts                   # Claude SDK configuration
├── agent.ts                    # Agent session logic
├── index.ts                    # CLI entry point
└── test-security.ts            # Security tests
```

## Prompt Organization

```
prompts/
├── app_spec.txt                # Shared specification
├── linear/                     # Linear-specific
│   ├── initializer_prompt.md   # Uses MCP tools
│   └── coding_prompt.md        # Linear workflow
├── beads/                      # Beads-specific
│   ├── initializer_prompt.md   # Uses bd CLI
│   └── coding_prompt.md        # Git-based workflow
└── plane/                      # Plane-specific
    ├── initializer_prompt.md   # REST API usage
    └── coding_prompt.md        # Rate-limited workflow
```

## Provider Comparison

| Aspect | Linear | Beads | Plane |
|--------|--------|-------|-------|
| **Transport** | MCP (HTTP) | CLI + Git | REST API |
| **Code Size** | 268 lines | 192 + 196 lines | 296 + 342 lines |
| **Network** | Required | Not required | Required |
| **API Calls** | MCP tools | Local commands | fetch() |
| **Rate Limiting** | N/A | None | 60/min (enforced) |
| **Collaboration** | Real-time | Git-based | Real-time |

## Environment Variables

| Variable | Required For | Purpose |
|----------|--------------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | All providers | Claude Agent SDK auth |
| `LINEAR_API_KEY` | Linear only | Linear MCP access |
| `PLANE_API_KEY` | Plane only | Plane REST API access |

## Examples

### Using Linear (Default MCP)

```bash
export CLAUDE_CODE_OAUTH_TOKEN='your-token'
export LINEAR_API_KEY='lin_api_xxxxx'

bun run src/index.ts --project-dir ./linear_project
```

Project will have:
- `.linear_project.json` marker file
- Issues managed via Linear MCP
- Real-time visibility in Linear workspace

### Using Beads (Local Git-Based)

```bash
export CLAUDE_CODE_OAUTH_TOKEN='your-token'
npm install -g @beads/bd  # One-time setup

bun run src/index.ts --project-dir ./beads_project --provider beads
```

Project will have:
- `.beads/issues.jsonl` Git-committed database
- `.beads/beads.db` SQLite cache (gitignored)
- All work tracked in Git
- **Works completely offline**

### Using Plane (REST API)

```bash
export CLAUDE_CODE_OAUTH_TOKEN='your-token'
export PLANE_API_KEY='your-plane-key'

# Create config file
echo '{
  "provider": "plane",
  "plane": {
    "workspaceSlug": "my-workspace",
    "baseUrl": "https://api.plane.so"
  }
}' > beads_project/.coding-agent.config.json

bun run src/index.ts --project-dir ./plane_project --provider plane
```

Project will have:
- `.plane_project.json` marker file
- Work items managed via Plane REST API
- Rate limiting (1 second between requests)
- Visibility in Plane workspace

## Key Differences from Python

1. **Type System**: Comprehensive TypeScript types throughout
2. **Provider Pattern**: Clean strategy pattern with interface
3. **Async/Await**: All file operations are async
4. **Bun APIs**: Native file and shell APIs
5. **ES Modules**: Modern import/export with `.js` extensions
6. **Null Safety**: Proper handling of `undefined` and `null`
7. **Multi-Provider**: Three implementations vs. Python's Linear-only

## Provider-Specific Features

### Linear
- ✅ Full MCP integration
- ✅ 18 Linear-specific tools
- ✅ Real-time collaboration
- ✅ UUID-like issue IDs

### Beads
- ✅ Git-native storage
- ✅ Hash-based IDs
- ✅ 4 dependency types
- ✅ Hierarchical issues (dot-notation)
- ✅ Works offline
- ✅ No API keys needed

### Plane
- ✅ Self-hostable
- ✅ Readable IDs (PROJ-123)
- ✅ Rate limiting built-in
- ✅ Full REST API client
- ✅ Workspace configuration
- ✅ Type-safe API calls

## Testing

```bash
# Security tests (provider-agnostic)
bun run src/test-security.ts

# Type checking (all providers)
bun run typecheck

# Linting (all providers)
bun run lint

# Test provider instantiation
bun -e "import { createProvider } from './src/providers/factory.js'; \
        console.log('Linear:', createProvider('linear').name); \
        console.log('Beads:', createProvider('beads').name); \
        console.log('Plane:', createProvider('plane').name);"
```

## Troubleshooting

**TypeScript errors after adding providers**
Run `bun run typecheck` to see detailed errors. All provider code is strictly typed.

**Beads CLI not found**
Install via `npm install -g @beads/bd` or Go: `go install github.com/beads-os/bd@latest`

**Plane workspace slug missing**
Add to `.coding-agent.config.json` in your project directory with `plane.workspaceSlug` field.

**Provider not auto-detected**
Check for marker files:
- Linear: `.linear_project.json`
- Beads: `.beads/issues.jsonl`
- Plane: `.plane_project.json`

## Contributing

When adding new providers:

1. Implement `ProjectManagementProvider` interface
2. Add provider to `factory.ts` switch statement
3. Create provider-specific prompts in `prompts/{provider}/`
4. Update `ProviderType` union in `types.ts`
5. Add environment validation
6. Document in this README

## Migration from Python

The TypeScript version has feature parity with Python plus:
- ✨ Multi-provider support (Linear, Beads, Plane)
- ✨ Strategy pattern architecture
- ✨ Type-safe provider implementations
- ✨ Auto-detection from marker files
- ✨ Configuration file support

See `CLAUDE.md` for detailed architecture documentation.

## License

MIT License - see [LICENSE](LICENSE) for details.
