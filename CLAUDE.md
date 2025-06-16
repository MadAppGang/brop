# BROP Development Instructions

## CDP Traffic Analysis Tools

### Capturing CDP Traffic

BROP includes tools to capture and analyze Chrome DevTools Protocol traffic:

```bash
# Capture native Chrome CDP traffic
export CDP_DUMP_FILE="cdp_dump_native.jsonl"
mitmdump -s tools/cdp_dump.py --mode reverse:http://localhost:9222 -p 19222

# Then connect Playwright through the proxy
const browser = await chromium.connectOverCDP('http://localhost:19222');
```

### Analyzing CDP Traffic

```bash
# Compare two CDP dumps
node tools/cdp-traffic-analyzer.js native.jsonl bridge.jsonl output.html

# Use npm scripts
pnpm run capture:cdp:native  # Start capture for native Chrome
pnpm run capture:cdp:bridge  # Start capture for bridge
pnpm run compare:cdp         # Generate comparison report
```

The analyzer creates an interactive HTML report with:
- Side-by-side message timeline
- Expandable message details
- Divergence highlighting
- Performance metrics

## Package Manager

Use `pnpm` instead of `npm` for all package management operations:

- `pnpm install` - Install dependencies
- `pnpm add <package>` - Add new dependency
- `pnpm run <script>` - Run npm scripts

## Development Workflow

- `pnpm run dev` - Start development environment with nodemon (auto-restart on file changes)
- `pnpm run bridge` - Start unified bridge server directly

## Extension Packaging

- `pnpm run pack:extension` - Create timestamped Chrome extension zip package
- `pnpm run pack:extension:clean` - Create clean 'brop-extension.zip' without timestamp
- Packages only essential Chrome extension files for distribution

## Complete Debugging Toolkit

### 1. Extension Error Collection

- `pnpm run debug:errors` - Get current extension errors
- `pnpm run debug:clear` - Clear extension errors for fresh testing
- Remote error validation: Extension collects Chrome API errors, debugger issues, and runtime failures

### 2. Extension Management

- `pnpm run debug:reload` - Remotely reload Chrome extension
- Auto-reload triggers: Extension automatically reloads when manifest.json or extension files change
- Permission fixes: Remove `activeTab` permission if "not in effect" errors occur

### 3. Bridge Server Auto-Reload

- `pnpm run dev` - Nodemon watches bridge/ files and restarts automatically
- File watching: Monitors .js, .json, .html files for changes
- Development efficiency: No manual bridge server restarts needed

### 4. Bridge Server Logs

- `pnpm run debug:logs` - Get bridge server console logs remotely
- HTTP endpoint: `http://localhost:9222/logs?limit=50&level=info`
- Log storage: Keeps last 1000 log entries in memory
- Options: `--limit <number>`, `--level <level>`, `--summary`

### 5. Complete Debug Workflow

- `pnpm run debug:workflow` - Run full debug cycle:
  1. Clear extension errors
  2. Run tests
  3. Check extension errors
  4. Get bridge logs
  5. Reload extension if needed

### 6. Testing Commands

- `pnpm run test:complete` - Complete flow test (generates 7 commands for popup testing)
- `pnpm run test:reload` - Test extension reload mechanism with measurable feature

## Automated Debug Techniques

This toolkit provides complete remote debugging capabilities:

1. **Error Monitoring**: Collect extension errors without Chrome DevTools
2. **Remote Control**: Reload extension programmatically for testing cycles
3. **Auto-Restart**: Bridge server restarts automatically on code changes
4. **Log Access**: Get bridge server logs via HTTP API for troubleshooting
5. **Workflow Automation**: Complete debug cycle with single command

## Key Files

- `nodemon.json` - Nodemon configuration for auto-restart
- `main_background.js` - Main extension background script with protocol routing
- `bridge/bridge_server.js` - Unified bridge server with HTTP logs endpoint
- `manifest.json` - Chrome extension manifest (remove activeTab permission if issues)
- `get-bridge-logs.js` - Utility to fetch bridge server logs
- Debug utilities: `debug-clear.js`, `get-extension-errors.js`, `debug-reload.js`, `debug-workflow.js`

## Testing

Available test commands:
- `pnpm run test:bridge` - Test unified bridge server (recommended)
- `pnpm run test:brop` - Test BROP protocol specifically  
- `pnpm run test:quick` - Quick CDP test
- `pnpm run test:cdp` - Test CDP functionality

Before committing changes, ensure:

1. Bridge server starts without port conflicts
2. Extension connects successfully
3. No Chrome extension permission errors
4. Run `pnpm run test:bridge` to validate functionality
5. Check bridge logs for any runtime issues

## Unified Architecture

The current system uses a unified bridge server that:
- **BROP multiplexing**: Multiple BROP clients on port 9225
- **CDP compatibility**: Playwright/Puppeteer support on port 9222
- **Extension connection**: Single extension connection on port 9224
- **No external Chrome dependency**: Everything routes through Chrome Extension APIs
- **Protocol separation**: Clean separation between BROP and CDP commands
- **Centralized logging**: All logs accessible via HTTP endpoint
- **Session management**: Proper CDP Target.* command handling for Playwright

## Port Configuration

- **Port 9222**: CDP endpoint for Playwright/Puppeteer clients
- **Port 9224**: Extension WebSocket connection
- **Port 9225**: BROP native client connections

## Architecture Simplifications

### Removed Components
- ❌ `bridge_server_multiplexed.js` - Legacy multiplexed server
- ❌ `start-multiplexed-system.js` - Outdated automation script
- ❌ External Chrome dependency on port 9223
- ❌ Separate BROP/CDP servers

### Current Components
- ✅ `bridge/bridge_server.js` - Unified server handling both protocols
- ✅ `main_background.js` - Clean protocol router
- ✅ Protocol separation within unified architecture
- ✅ Direct Chrome Extension API usage only

## Development Best Practices

1. **Start with unified bridge**: Always use `pnpm run dev` or `pnpm run bridge`
2. **Test both protocols**: Use `pnpm run test:bridge` to validate BROP and CDP
3. **Monitor logs**: Use `pnpm run debug:logs` for real-time debugging
4. **Check extension health**: Use `pnpm run debug:errors` for extension issues
5. **Clean testing**: Use `pnpm run debug:clear` before test runs

## Troubleshooting

### Common Issues

1. **Port conflicts**: Bridge server fails to start
   - Solution: Check for processes on ports 9222, 9224, 9225
   - Kill conflicting processes: `lsof -ti:9222 | xargs kill`

2. **Extension not connecting**: Bridge shows no extension connection
   - Solution: Reload extension via `pnpm run debug:reload`
   - Check extension errors: `pnpm run debug:errors`

3. **CDP commands failing**: Playwright/Puppeteer not working
   - Solution: Verify extension debugger permissions
   - Test with `pnpm run test:cdp`

4. **Performance issues**: Slow response times
   - Solution: Check bridge logs for bottlenecks
   - Monitor with `pnpm run debug:logs --limit 100`

## Extension Development Notes

- Extension uses service worker model (manifest v3)
- Protocol routing handled in `main_background.js`
- Content scripts inject into web pages for DOM access
- Popup provides real-time status and debugging interface
- No build process required - direct file loading