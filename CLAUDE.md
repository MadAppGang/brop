# MCP-BROP Development Instructions

MCP-BROP (Model Context Protocol - Browser Remote Operations Protocol) is a browser automation system that bridges Chrome Extension APIs with industry-standard protocols, enabling AI agents and automation tools to control Chrome browsers.

## Architecture Overview

### Unified Bridge Server Architecture

The system uses a **unified bridge server** (`bridge/bridge_server.js`) that handles both BROP and CDP protocols without requiring an external Chrome instance:

- **BROP Protocol (Port 9225)**: Native browser automation commands
- **CDP Protocol (Port 9222)**: Chrome DevTools Protocol compatibility for Playwright/Puppeteer
- **Extension Connection (Port 9224)**: WebSocket connection to Chrome extension
- **No External Chrome Required**: Everything routes through Chrome Extension APIs

### Key Components

1. **Chrome Extension** (Manifest V3)
   - `main_background.js`: Service worker handling protocol routing
   - Content scripts for DOM manipulation
   - Popup UI for real-time status monitoring
   - Direct Chrome Extension API usage

2. **Bridge Server** (`bridge/bridge_server.js`)
   - Unified server handling both BROP and CDP
   - Protocol separation with dedicated handlers
   - HTTP endpoints for logs and debugging
   - Session management for complex automation

3. **MCP Server** (`bridge/mcp-server.js`)
   - Model Context Protocol interface for AI agents
   - Dual-mode operation (server when port 9223 free, relay when occupied)
   - STDIO transport for Claude and other AI tools
   - Complete browser automation tool suite

## Package Manager

Use `pnpm` for all package management:
```bash
pnpm install        # Install dependencies
pnpm add <package>  # Add new dependency
pnpm run <script>   # Run npm scripts
```

## Development Workflow

### Starting Development

```bash
pnpm run dev        # Start with auto-reload (recommended)
pnpm run bridge     # Start bridge server directly
pnpm run mcp        # Start MCP server for AI integration
```

### Testing

```bash
pnpm run test:bridge     # Test unified bridge (recommended)
pnpm run test:wikipedia  # Run real-world Wikipedia tests
pnpm run test:cdp        # Test CDP compatibility
pnpm run test:brop       # Test BROP protocol
```

### Extension Management

```bash
pnpm run pack:extension        # Create timestamped zip
pnpm run pack:extension:clean  # Create clean 'brop-extension.zip'
```

## Debugging Toolkit

### Extension Debugging

```bash
pnpm run debug:errors     # Get current extension errors
pnpm run debug:clear      # Clear errors for fresh testing
pnpm run debug:reload     # Remotely reload extension
```

### Bridge Server Debugging

```bash
pnpm run debug:logs       # Get bridge server logs
# HTTP API: http://localhost:9222/logs?limit=50&level=info
```

### Complete Debug Workflow

```bash
pnpm run debug:workflow   # Full debug cycle:
# 1. Clear extension errors
# 2. Run tests
# 3. Check extension errors
# 4. Get bridge logs
# 5. Reload extension if needed
```

## CDP Traffic Analysis

### Real-time CDP Logging

The bridge server now includes comprehensive CDP message logging:

```bash
# View last 50 CDP messages in pretty format
pnpm run debug:cdp

# View all CDP logs as JSON
pnpm run cdp:logs

# Export CDP logs for analysis
pnpm run cdp:logs:export

# View logs with custom options
node tools/cdp-log-viewer.js -l 100 -f pretty
```

#### CDP Log Endpoints

- **HTTP API**: `http://localhost:9222/cdp-logs`
- **Query Parameters**: 
  - `limit`: Number of logs to return
  - `format`: `json` (default) or `jsonl`

### Capturing CDP Traffic

```bash
# Capture native Chrome CDP traffic
export CDP_DUMP_FILE="reports/cdp_dump_native.jsonl"
pnpm run capture:cdp:native

# Capture bridge CDP traffic (from logs)
pnpm run cdp:logs:export

# Or capture during test run
export CDP_DUMP_FILE="reports/cdp_dump_bridge.jsonl"
pnpm run capture:cdp:bridge
```

### Analyzing CDP Traffic

```bash
# Compare two CDP dumps
pnpm run cdp:analyze

# Or manually:
node tools/cdp-traffic-analyzer.js native.jsonl bridge.jsonl output.html
```

## Protocol Details

### BROP Protocol Commands

Native browser automation commands handled by `brop_server.js`:
- `navigate_to_url` - Browser navigation
- `get_page_content` - Content extraction with Readability
- `get_simplified_dom` - DOM structure extraction
- `get_console_logs` - Console log capture
- `execute_console` - JavaScript execution
- `click_element`, `type_text` - Element interaction
- `create_tab`, `close_tab`, `list_tabs` - Tab management
- `get_screenshot` - Screenshot capture
- Extension management commands

### CDP Protocol Support

Full Chrome DevTools Protocol compatibility:
- Target and session management
- Runtime evaluation
- Page navigation and lifecycle
- Network interception
- Browser context handling

## Message Flow

```
Client → Bridge Server → Chrome Extension → Chrome APIs
              ↓                    ↓
         Protocol Router    Protocol Handlers
                            (BROP/CDP)
```

## Port Configuration

- **9222**: CDP endpoint (Playwright/Puppeteer)
- **9224**: Extension WebSocket connection
- **9225**: BROP native client connections

## Troubleshooting

### Port Conflicts

```bash
# Check for processes on ports
lsof -ti:9222,9224,9225

# Kill conflicting processes
lsof -ti:9222 | xargs kill
```

### Extension Not Connecting

1. Check extension errors: `pnpm run debug:errors`
2. Reload extension: `pnpm run debug:reload`
3. Verify manifest permissions

### CDP Commands Failing

1. Test with: `pnpm run test:cdp`
2. Check bridge logs: `pnpm run debug:logs`
3. Verify debugger permissions in manifest

### Performance Issues

1. Monitor logs: `pnpm run debug:logs --limit 100`
2. Check for message bottlenecks
3. Review CDP traffic analysis

## Best Practices

1. **Always use unified bridge**: Start with `pnpm run dev`
2. **Test both protocols**: Use `pnpm run test:bridge`
3. **Monitor continuously**: Keep logs open during development
4. **Clean testing**: Clear errors before test runs
5. **Check extension health**: Regular error monitoring

## Key Files

- `bridge/bridge_server.js` - Unified bridge server
- `main_background.js` - Extension background script
- `manifest.json` - Chrome extension manifest
- `package.json` - Project configuration
- `nodemon.json` - Auto-reload configuration

## Before Committing

1. Ensure bridge server starts without conflicts
2. Verify extension connects successfully
3. Run `pnpm run test:bridge` successfully
4. Check for Chrome permission errors
5. Review bridge logs for runtime issues