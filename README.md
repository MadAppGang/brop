# BROP - Browser Remote Operations Protocol

A Chrome extension that provides native browser automation capabilities through a unified WebSocket bridge server, Chrome extension interface, and **Model Context Protocol (MCP) server**.

## Features

- **🌉 Unified Bridge Server**: Single WebSocket server providing both BROP and Chrome DevTools Protocol (CDP) compatibility
- **🔧 MCP Server**: Model Context Protocol interface for AI agents and tools (dual-mode: server/relay)
- **🧩 Chrome Extension**: Native Chrome extension for direct browser control and automation
- **📝 Content Extraction**: Advanced content extraction with Mozilla Readability and semantic markdown
- **⚙️ JavaScript Execution**: Execute code in page context and capture console logs
- **🎯 DOM Operations**: Simplified DOM extraction and element interaction
- **📸 Screenshot Capture**: Take screenshots of browser tabs
- **🧭 Navigation Control**: Navigate pages with status monitoring
- **🔍 Debug Toolkit**: Comprehensive debugging and monitoring tools
- **📦 Extension Packaging**: Production-ready Chrome extension packaging

## Installation

1. **Install dependencies:**

```bash
pnpm install
```

2. **Load the extension in Chrome:**

   - **Option A:** Load unpacked extension

     - Open Chrome and go to `chrome://extensions/`
     - Enable "Developer mode"
     - Click "Load unpacked" and select this directory

   - **Option B:** Install packaged extension
     ```bash
     pnpm run pack:extension:clean  # Creates brop-extension.zip
     ```
     - Drag and drop the zip file to `chrome://extensions/`

3. **Start the bridge server:**

```bash
pnpm run dev          # Development mode with auto-reload
# OR
pnpm run bridge       # Production bridge server
```

4. **Start MCP server (optional):**

```bash
pnpm run mcp          # Auto-detects server/relay mode
```

**Note:** No build process required! The extension works immediately after loading.

## Usage

### Bridge Server

Start the development server with auto-reload:

```bash
pnpm run dev
```

The unified bridge server provides:

- **BROP endpoint**: `ws://localhost:9225` (BROP clients)
- **Extension endpoint**: `ws://localhost:9224` (Chrome extension connects here)
- **CDP endpoint**: `ws://localhost:9222` (Playwright/CDP clients)
- **HTTP logs endpoint**: `http://localhost:9222/logs` (debugging)
- **Chrome DevTools Protocol compatibility**
- **Real-time logging and debugging**

### MCP Server

The MCP server provides AI agents with browser automation capabilities:

```bash
pnpm run mcp  # STDIO transport on auto-detected mode
```

**Dual-Mode Operation:**

- **Server Mode**: When port 9225 is free, starts full BROP bridge servers
- **Relay Mode**: When port 9225 is occupied, connects as client to existing server

**Available Tools:** `brop_navigate`, `brop_get_page_content`, `brop_get_simplified_content`, `brop_execute_script`, `brop_click_element`, `brop_type_text`, `brop_create_page`, `brop_close_tab`, `brop_list_tabs`, `brop_activate_tab`, `brop_get_server_status`

See **[MCP_README.md](MCP_README.md)** for complete MCP documentation.

### Chrome Extension

Once loaded, the extension will:

- Show a popup with service status and connection details
- Inject content scripts into pages for DOM operations
- Run background scripts to handle automation commands
- Provide debugging and monitoring tools

### JavaScript Client

Connect to the bridge server using WebSocket:

```javascript
// BROP commands
const bropWs = new WebSocket("ws://localhost:9225");

bropWs.onopen = () => {
  bropWs.send(
    JSON.stringify({
      id: 1,
      method: "navigate_to_url",
      params: { url: "https://example.com" },
    })
  );
};

// CDP commands (Playwright/Puppeteer compatible)
const cdpWs = new WebSocket("ws://localhost:9222/devtools/browser/brop-bridge");

cdpWs.onopen = () => {
  cdpWs.send(
    JSON.stringify({
      id: 1,
      method: "Runtime.evaluate",
      params: { expression: "document.title" },
    })
  );
};
```

## API Reference

### Bridge Server Commands

The bridge server supports both BROP and Chrome DevTools Protocol (CDP) methods:

#### BROP Commands (Port 9225)

- `navigate_to_url`: Navigate to a specific URL
- `get_page_content`: Extract page content and metadata
- `get_simplified_dom`: Get simplified DOM structure (HTML/Markdown via Readability)
- `get_console_logs`: Retrieve browser console logs
- `create_tab`: Create new browser tab
- `close_tab`: Close specific tab
- `list_tabs`: List all open tabs
- `activate_tab`: Switch to specific tab
- `click_element`: Click element by CSS selector
- `type_text`: Type text into input fields
- `get_screenshot`: Capture page screenshot

#### CDP Commands (Port 9222)

- `Runtime.evaluate`: Execute JavaScript in page context
- `Runtime.getProperties`: Get object properties
- `Runtime.callFunctionOn`: Call function on remote object
- `Page.navigate`: Navigate to a URL
- `Page.captureScreenshot`: Capture page screenshot
- `Page.getLayoutMetrics`: Get page layout information
- `DOM.getDocument`: Get document root node
- `DOM.querySelector`: Query for elements
- `DOM.getOuterHTML`: Get element HTML
- `Target.*`: Target management for Playwright compatibility

### Response Format

All responses follow CDP format:

- `id`: Request identifier
- `result`: Command result data (on success)
- `error`: Error information (on failure)

## Architecture

```
┌─────────────────┐    STDIO/WebSocket   ┌──────────────────┐    WebSocket    ┌──────────────────┐
│   MCP Client    │ ◄─────────────────► │   MCP Server     │ ◄─────────────► │  Bridge Server   │
│  (AI Agents)    │                     │  (port 3000)     │                 │  (port 9225)     │
└─────────────────┘                     └──────────────────┘                 └──────────────────┘
                                                                                        │
┌─────────────────┐    WebSocket         ┌──────────────────┐                         │ WebSocket
│ BROP Client App │ ◄─────────────────► │  Unified Bridge  │                         │ (port 9224)
│  (JavaScript)   │      Port 9225      │     Server       │                         ▼
└─────────────────┘                     │  (Node.js)       │                ┌──────────────────┐
                                        └──────────────────┘                │  Chrome Extension │
┌─────────────────┐    WebSocket                  │                         │  Background Script│
│ CDP Client App  │ ◄─────────────────────────────┘                         └──────────────────┘
│ (Playwright)    │      Port 9222                                                   │
└─────────────────┘                                                                  │ Chrome APIs
                                                                                      ▼
                                                                             ┌──────────────────┐
                                                                             │   Web Pages      │
                                                                             │  Content Scripts │
                                                                             └──────────────────┘
```

### Components

1. **MCP Server** (`bridge/mcp.js`): Model Context Protocol server with dual-mode operation (STDIO transport)
2. **Unified Bridge Server** (`bridge/bridge_server.js`): Node.js WebSocket server providing both BROP and CDP compatibility
3. **Background Script** (`main_background.js`): Extension service worker handling automation commands
4. **Content Script** (`content.js`): Injected into web pages for DOM interaction and monitoring
5. **Injected Script** (`injected.js`): Runs in page context for enhanced JavaScript execution
6. **Popup** (`popup.html/js`): Extension UI showing service status and debugging tools
7. **Content Extractor** (`content-extractor.js`): Advanced content extraction with Readability and semantic markdown
8. **DOM Simplifier** (`dom_simplifier.js`): Utility for extracting simplified DOM structures

## Development

### Development Mode

Start the bridge server with auto-reload:

```bash
pnpm run dev
```

### Testing

**Bridge Server Tests:**

```bash
pnpm run test:bridge     # Test unified bridge server
pnpm run test:brop       # Test BROP protocol specifically
pnpm run test:cdp        # Test CDP functionality
pnpm run test:quick      # Quick CDP test
```

**MCP Server Tests:**

```bash
pnpm run test:mcp        # Test MCP server modes
```

**Extension Packaging:**

```bash
pnpm run pack:extension        # Timestamped zip
pnpm run pack:extension:clean  # Clean brop-extension.zip
```

## Debug Toolkit

BROP includes comprehensive debugging tools accessible via npm scripts:

### Extension Error Collection

```bash
pnpm run debug:errors    # Get current extension errors
pnpm run debug:clear     # Clear extension errors for fresh testing
```

### Extension Management

```bash
pnpm run debug:reload    # Remotely reload Chrome extension
```

### Bridge Server Logs

```bash
pnpm run debug:logs      # Get bridge server console logs remotely
```

### Complete Debug Workflow

```bash
pnpm run debug:workflow  # Run full debug cycle
```

### Testing Commands

```bash
pnpm run test:complete   # Complete flow test
pnpm run test:reload     # Test extension reload mechanism
```

## Limitations

- Chrome extension permissions and security model
- Limited to Chrome/Chromium browsers
- Extension API overhead compared to direct browser control
- Cannot access chrome:// internal pages (security restriction)
- Requires bridge server to be running for external connections

## Security Notes

- The extension requests broad permissions for full functionality
- All communication uses Chrome's secure runtime messaging and WebSocket
- Bridge server runs locally on configurable ports
- Runs within Chrome's security sandbox
- No external Chrome dependency - everything routes through extension APIs

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with the BROP test suite
5. Submit a pull request

## Development & Debugging

For detailed development instructions, see **[CLAUDE.md](CLAUDE.md)** - Complete debugging toolkit and workflow guide.

### Quick Debug Commands

**Extension Console (chrome://extensions/ → BROP → Inspect views):**

```javascript
// Check bridge server connection
bridgeConnection.isConnected;

// View recent activity logs
logs.getLogs(10);

// Check extension status
extensionAPI.getStatus();
```

**Page Console (F12 on any webpage):**

```javascript
// Test content script
window.BROP?.getConsoleLogs();

// Test simplified DOM
window.BROP?.getSimplifiedDOM();
```

**Bridge Server Debug:**

```bash
# View real-time logs
pnpm run debug:logs

# Check server status
curl http://localhost:9222/json/version
```

## Extension UI Features

The extension popup includes:

### 🎛️ **Service Control**

- **Service Status** - Bridge server connection indicator
- **Extension Health** - Background script and content script status
- **Debug Controls** - Quick access to debugging functions

### 📊 **Activity Monitoring**

- **Real-time Logs** - See automation commands as they execute
- **Performance Metrics** - Response times and success rates
- **Error Tracking** - Monitor and diagnose issues

### ⚙️ **Settings & Tools**

- **Connection Settings** - Configure bridge server endpoints
- **Debug Utilities** - Access to error collection and diagnostics
- **Extension Management** - Reload and reset functions

## Quick Start

1. **Install dependencies:** `pnpm install`
2. **Load the extension** in Chrome developer mode (or use `pnpm run pack:extension:clean`)
3. **Start bridge server:** `pnpm run dev`
4. **Start MCP server (optional):** `pnpm run mcp`
5. **Open the popup** and verify connection
6. **Run tests:** `pnpm run test:bridge` or `pnpm run test:mcp`

## Roadmap

- [x] **Unified Bridge Server** - Single server handling both BROP and CDP protocols
- [x] **MCP Server Implementation** - Complete Model Context Protocol support
- [x] **Advanced Content Extraction** - Mozilla Readability and semantic markdown
- [x] **Extension Packaging** - Production-ready Chrome extension packaging
- [x] **Dual-Mode MCP** - Server/relay mode detection and switching
- [x] **No External Chrome Dependency** - Everything routes through extension APIs
- [ ] Enhanced debugging and monitoring tools
- [ ] Firefox extension support
- [ ] Additional CDP method implementations
- [ ] Performance optimizations
- [ ] TypeScript conversion
- [ ] npm package for JavaScript client library

## Related Documentation

- **[MCP_README.md](MCP_README.md)** - Complete MCP server documentation and usage examples
- **[CLAUDE.md](CLAUDE.md)** - Development instructions and debugging toolkit
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and component overview