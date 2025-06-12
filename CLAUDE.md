# BROP Development Instructions

## Package Manager
Use `pnpm` instead of `npm` for all package management operations:
- `pnpm install` - Install dependencies
- `pnpm add <package>` - Add new dependency
- `pnpm run <script>` - Run npm scripts

## Development Workflow
- `pnpm run dev` - Start development environment with nodemon (auto-restart on file changes)
- `pnpm run dev:legacy` - Use legacy auto-reload script (bridge-auto-reload.js)
- `pnpm run bridge` - Start bridge server directly without auto-reload

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
- `pnpm run dev` - Nodemon watches bridge-server/ files and restarts automatically
- File watching: Monitors .js, .json, .html files for changes
- Development efficiency: No manual bridge server restarts needed

### 4. Bridge Server Logs
- `pnpm run debug:logs` - Get bridge server console logs remotely
- HTTP endpoint: `http://localhost:9225/logs?limit=50&level=info`
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
- `background_bridge_client.js` - Main extension background script with error collection
- `bridge-server/bridge_server.js` - Bridge server with HTTP logs endpoint
- `manifest.json` - Chrome extension manifest (remove activeTab permission if issues)
- `get-bridge-logs.js` - Utility to fetch bridge server logs
- Debug utilities: `debug-clear.js`, `get-extension-errors.js`, `debug-reload.js`, `debug-workflow.js`

## Testing
Before committing changes, ensure:
1. Bridge server starts without port conflicts
2. Extension connects successfully
3. No Chrome extension permission errors
4. Run debug workflow to validate functionality
5. Check bridge logs for any runtime issues