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

## Debugging Commands
- `pnpm run debug:clear` - Clear extension errors
- `pnpm run debug:errors` - Get current extension errors
- `pnpm run debug:reload` - Reload Chrome extension
- `pnpm run debug:workflow` - Run complete debug workflow

## Key Files
- `nodemon.json` - Nodemon configuration for auto-restart
- `background_bridge_client.js` - Main extension background script
- `bridge-server/bridge_server.js` - Bridge server implementation
- `manifest.json` - Chrome extension manifest (remove activeTab permission if issues)

## Testing
Before committing changes, ensure:
1. Bridge server starts without port conflicts
2. Extension connects successfully
3. No Chrome extension permission errors
4. Run debug workflow to validate functionality