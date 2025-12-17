# Browser Providers

This directory implements the **browser provider strategy pattern** for the Linear Coding Agent Harness. It allows the agent to use different browser automation backends (Puppeteer MCP or Chrome DevTools MCP) interchangeably.

## Architecture

The browser provider pattern follows the same design as the project management provider pattern (`src/providers/`):

```
src/browser-providers/
├── types.ts                      # Core interfaces and types
├── puppeteer-provider.ts         # Puppeteer MCP implementation
├── chrome-devtools-provider.ts   # Chrome DevTools MCP implementation
├── factory.ts                    # Provider creation and detection
├── index.ts                      # Public API exports
└── README.md                     # This file
```

## Supported Providers

### 1. Puppeteer (Default for Python version)

- **MCP Server**: `npx puppeteer-mcp-server`
- **Transport**: stdio
- **Browser**: Launches its own headless Chrome automatically
- **Pros**: Zero configuration, works out of the box
- **Cons**: Headless only, can't see what the agent is doing

**Tools**:
- `mcp__puppeteer__puppeteer_navigate` - Navigate to URL
- `mcp__puppeteer__puppeteer_screenshot` - Take screenshots
- `mcp__puppeteer__puppeteer_click` - Click elements
- `mcp__puppeteer__puppeteer_fill` - Fill form fields
- `mcp__puppeteer__puppeteer_select` - Select dropdowns
- `mcp__puppeteer__puppeteer_hover` - Hover over elements
- `mcp__puppeteer__puppeteer_evaluate` - Execute JavaScript

### 2. Chrome DevTools (Default for TypeScript version)

- **MCP Server**: `npx chrome-devtools-mcp@latest --browser-url http://localhost:9222`
- **Transport**: stdio
- **Browser**: Connects to existing Chrome instance with remote debugging enabled
- **Pros**: Visual feedback, can watch agent work in real-time, access to Network panel
- **Cons**: Requires Chrome to be running with `--remote-debugging-port=9222`

**Tools**:
- `mcp__chrome-devtools__navigate_page` - Navigate to URL
- `mcp__chrome-devtools__take_screenshot` - Take screenshots
- `mcp__chrome-devtools__take_snapshot` - DOM snapshots for accessibility
- `mcp__chrome-devtools__click` - Click elements
- `mcp__chrome-devtools__fill` - Fill form fields
- `mcp__chrome-devtools__wait_for_selector` - Wait for elements
- `mcp__chrome-devtools__evaluate_script` - Execute JavaScript
- `mcp__chrome-devtools__list_network_requests` - Inspect network activity
- `mcp__chrome-devtools__get_page_info` - Get page metadata

## Usage

### Basic Usage

```typescript
import { createBrowserProvider } from "./browser-providers/index.js";

// Create Puppeteer provider
const puppeteer = createBrowserProvider("puppeteer");

// Create Chrome DevTools provider
const chromeDevTools = createBrowserProvider("chrome-devtools");

// Get MCP server configuration
const mcpConfig = puppeteer.getMcpServerConfig();
// { type: "stdio", command: "npx", args: ["puppeteer-mcp-server"] }

// Get required tools for security settings
const tools = puppeteer.getRequiredTools();
// ["mcp__puppeteer__puppeteer_navigate", ...]

// Get template variables for prompts
const vars = puppeteer.getTemplateVariables();
// { navigate_tool: "mcp__puppeteer__puppeteer_navigate", ... }
```

### Auto-Detection

The factory can automatically detect the browser provider based on:

1. **CLI flag** (`--browser chrome-devtools`) - highest priority
2. **Config file** (`.coding-agent.config.json` `browser` field)
3. **Environment variable** (`BROWSER_PROVIDER=chrome-devtools`)
4. **Default** (`chrome-devtools`)

```typescript
import { detectAndCreateBrowserProvider } from "./browser-providers/index.js";

// Auto-detect and create provider
const provider = await detectAndCreateBrowserProvider(
  "/path/to/project",
  cliBrowser, // Optional CLI override
  browserUrl  // Optional Chrome DevTools URL
);

// Validate environment (throws if Chrome not running for Chrome DevTools)
await provider.validateEnvironment();

// Ensure browser is running (may auto-launch Chrome)
await provider.ensureBrowserRunning();
```

### Integration with Client

The browser provider integrates with `src/client.ts` to configure MCP servers:

```typescript
import { createQueryOptions } from "./client.js";
import { detectAndCreateBrowserProvider } from "./browser-providers/index.js";

const browserProvider = await detectAndCreateBrowserProvider(projectDir);
const options = await createQueryOptions(projectDir, model, projectProvider, browserProvider);
```

## Configuration

### Chrome DevTools Setup

**Option 1: Manual Launch**

```bash
# Linux
google-chrome --remote-debugging-port=9222

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**Option 2: Custom URL**

Set the `CHROME_DEVTOOLS_URL` environment variable:

```bash
export CHROME_DEVTOOLS_URL=http://localhost:9223
```

Or configure in `.coding-agent.config.json`:

```json
{
  "provider": "linear",
  "browser": "chrome-devtools",
  "chromeDevTools": {
    "browserUrl": "http://localhost:9223"
  }
}
```

**Option 3: Auto-Launch**

The Chrome DevTools provider will attempt to auto-launch Chrome if it's not running. It tries common paths:
- `google-chrome`
- `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (macOS)
- `/usr/bin/google-chrome` (Linux)
- `/usr/bin/chromium` (Linux)

### Config File

Add browser preference to `.coding-agent.config.json`:

```json
{
  "provider": "linear",
  "browser": "chrome-devtools"
}
```

## Provider Interface

All browser providers implement the `BrowserProvider` interface:

```typescript
interface BrowserProvider {
  // Identity
  readonly name: BrowserProviderType;
  readonly displayName: string;

  // Environment & Configuration
  validateEnvironment(): Promise<void>;
  getMcpServerConfig(): MCPServerConfiguration;
  getRequiredTools(): string[];
  getToolDefinitions(): BrowserToolDefinition[];
  getTemplateVariables(): Record<string, string>;

  // Browser Management
  getBrowserUrl(): string | null;
  ensureBrowserRunning(): Promise<void>;
}
```

## Template Integration

Browser providers expose template variables for provider-agnostic prompts:

```handlebars
{{!-- Prompt template using browser variables --}}

Use the {{var browser.variables "navigate_tool"}} to navigate to the URL.

Then use {{var browser.variables "screenshot_tool"}} to verify the UI.

{{!-- Conditional content based on browser --}}
{{#ifBrowser "chrome-devtools"}}
You can also use {{var browser.variables "list_network_requests"}} to inspect API calls.
{{/ifBrowser}}

{{!-- List all available tools --}}
Available browser automation tools:
{{toolList browser.tools}}
```

This allows prompts to work with both Puppeteer and Chrome DevTools without duplication.

## Design Principles

1. **Clean Abstraction**: Browser provider is independent of project management provider
2. **Zero Configuration**: Puppeteer works out of the box with no setup
3. **Visual Feedback**: Chrome DevTools allows watching the agent work in real-time
4. **Helpful Errors**: Clear error messages when Chrome isn't running
5. **Auto-Launch**: Chrome DevTools attempts to auto-launch Chrome when possible
6. **Template Variables**: Prompts can be browser-agnostic using template substitution

## Future Providers

Potential future browser providers:

- **Playwright MCP** - Multi-browser support (Chromium, Firefox, WebKit)
- **Selenium Grid** - Remote browser automation
- **BrowserBase** - Cloud browser service with session recording

The provider interface is designed to support these extensions.
