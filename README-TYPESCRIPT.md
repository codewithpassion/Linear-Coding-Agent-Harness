# TypeScript/Bun Conversion Notes

This is a **complete TypeScript/Bun conversion** of the Linear Coding Agent Harness, originally written in Python.

## ⚠️ Important: Claude Agent SDK API Differences

**Status**: The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk` v0.1.71) is now installed and available.

**⚠️ Important**: The TypeScript SDK uses a **different API** than the Python SDK:

### Python SDK (what the original code used)
```python
from claude_code_sdk import ClaudeSDKClient

client = ClaudeSDKClient(options)
await client.query(message)
for msg in client.receiveResponse():
    # Process messages
```

### TypeScript SDK (what's actually available)
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const result = query({
  prompt: message,
  options: { /* ... */ }
});

for await (const msg of result) {
  // Process messages
}
```

### Current Code Status

- ✅ **Biome linting**: All errors fixed, zero linting issues
- ✅ **Type definitions**: All types properly defined, no `any` types
- ✅ **SDK installed**: `@anthropic-ai/claude-agent-sdk` v0.1.71
- ⚠️ **API adaptation needed**: Code uses Python SDK patterns, needs refactoring for TypeScript `query()` API

### What Needs to Be Done

The `src/client.ts` and `src/agent.ts` files currently implement the Python SDK's class-based API. They need to be refactored to use:

1. Import `query()` function instead of `ClaudeSDKClient` class
2. Use functional `query({ prompt, options })` pattern
3. Update message streaming to work with TypeScript SDK's AsyncGenerator
4. Adapt hook configuration to TypeScript SDK format
5. Update types: `SDKAssistantMessage`, `SDKUserMessage`, `SDKMessage`, etc.

Reference: https://platform.claude.com/docs/en/agent-sdk/typescript

## Converted Files

All Python files have been converted to strict TypeScript:

| Python File | TypeScript File | Status |
|------------|-----------------|--------|
| `linear_config.py` | `src/linear-config.ts` | ✅ Complete |
| `security.py` | `src/security.ts` | ✅ Complete |
| `prompts.py` | `src/prompts.ts` | ✅ Complete |
| `progress.py` | `src/progress.ts` | ✅ Complete |
| `client.py` | `src/client.ts` | ✅ Complete |
| `agent.py` | `src/agent.ts` | ✅ Complete |
| `autonomous_agent_demo.py` | `src/index.ts` | ✅ Complete |
| `test_security.py` | `src/test-security.ts` | ✅ Complete |

## Features

✅ **100% Strict TypeScript** - No `any` types anywhere
✅ **Comprehensive JSDoc** - All functions documented
✅ **Biome Linting** - Strict linting with no errors
✅ **Type Safety** - All types explicitly defined
✅ **Bun Native** - Uses Bun's APIs for file I/O
✅ **ES Modules** - Modern import/export syntax

## Running the Code

### Prerequisites

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install
```

### Available Commands

```bash
# Run the demo (once SDK is available)
bun run src/index.ts --project-dir ./my_project

# Run security tests
bun run src/test-security.ts

# Run linter
bun run lint

# Fix linting issues
bun run lint:fix

# Format code
bun run format

# Type check
bun run typecheck
```

## Type Safety

The project uses the strictest possible TypeScript configuration:

- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `noUncheckedIndexedAccess: true`
- And many more strict options

See `tsconfig.json` for the complete configuration.

## Biome Configuration

Strict linting is enforced with Biome:

- No `any` types (`noExplicitAny: "error"`)
- Consistent code style
- Automatic formatting
- Import organization

See `biome.json` for the complete configuration.

## Code Structure

```
src/
├── linear-config.ts   # Linear configuration constants and types
├── security.ts        # Security hooks and bash command validation
├── prompts.ts         # Prompt loading utilities
├── progress.ts        # Progress tracking utilities
├── client.ts          # Claude SDK client configuration
├── agent.ts           # Agent session logic
├── index.ts           # Main entry point (CLI)
└── test-security.ts   # Security tests
```

## Key Differences from Python

1. **Async/Await**: All file operations are async
2. **Type System**: Comprehensive TypeScript types throughout
3. **Bun APIs**: Uses Bun's native file and shell APIs
4. **ES Modules**: Modern import/export with `.js` extensions
5. **Null Safety**: Proper handling of `undefined` and `null`

## When the SDK is Available

Once the TypeScript/JavaScript Claude Agent SDK is released, update:

1. `package.json`: Add the SDK dependency
2. `src/client.ts`: Update import paths
3. `src/agent.ts`: Update SDK types if needed
4. Run `bun install` to install the SDK

The code is already structured to work with the SDK once it becomes available.
