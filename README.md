# BROP - Browser Remote Operations Protocol

A Chrome extension that provides native browser automation capabilities through a WebSocket bridge server, Chrome extension interface, and **Model Context Protocol (MCP) server**.

## Features

- **🌉 Bridge Server**: WebSocket server providing Chrome DevTools Protocol (CDP) compatibility
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
pnpm run bridge       # Production bridge server only
```

4. **Start MCP server (optional):**

```bash
pnpm run mcp          # Auto-detects server/relay mode
# OR
pnpm run mcp:inspect  # Start with MCP Inspector
```

**Note:** No build process required! The extension works immediately after loading.

## Usage

### Bridge Server

Start the development server with auto-reload:

```bash
pnpm run dev
```

The bridge server provides:

- **WebSocket endpoint**: `ws://localhost:9223` (BROP clients)
- **Extension endpoint**: `ws://localhost:9224` (Chrome extension connects here)
- **HTTP logs endpoint**: `http://localhost:9225/logs` (debugging)
- **Chrome DevTools Protocol compatibility**
- **Real-time logging and debugging**

### MCP Server

The MCP server provides AI agents with browser automation capabilities:

```bash
pnpm run mcp  # STDIO transport on auto-detected mode
```

**Dual-Mode Operation:**

- **Server Mode**: When port 9223 is free, starts full BROP bridge servers
- **Relay Mode**: When port 9223 is occupied, connects as client to existing server

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
const ws = new WebSocket("ws://localhost:9223");

ws.onopen = () => {
  // Send CDP-compatible commands
  ws.send(
    JSON.stringify({
      id: 1,
      method: "Runtime.evaluate",
      params: { expression: "document.title" },
    })
  );
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log("Response:", response);
};
```

## API Reference

### Bridge Server Commands

The bridge server supports Chrome DevTools Protocol (CDP) methods:

#### Runtime Commands

- `Runtime.evaluate`: Execute JavaScript in page context
- `Runtime.getProperties`: Get object properties
- `Runtime.callFunctionOn`: Call function on remote object

#### Page Commands

- `Page.navigate`: Navigate to a URL
- `Page.captureScreenshot`: Capture page screenshot
- `Page.getLayoutMetrics`: Get page layout information

#### DOM Commands

- `DOM.getDocument`: Get document root node
- `DOM.querySelector`: Query for elements
- `DOM.getOuterHTML`: Get element HTML

#### Native BROP Commands

- `get_simplified_dom`: Get simplified DOM structure (HTML/Markdown via Readability)
- `get_console_logs`: Retrieve browser console logs
- `get_page_content`: Extract page content and metadata
- `navigate_to_url`: Navigate to a specific URL
- `create_tab`: Create new browser tab
- `close_tab`: Close specific tab
- `list_tabs`: List all open tabs
- `activate_tab`: Switch to specific tab
- `click_element`: Click element by CSS selector
- `type_text`: Type text into input fields

### Response Format

All responses follow CDP format:

- `id`: Request identifier
- `result`: Command result data (on success)
- `error`: Error information (on failure)

## Architecture

```
┌─────────────────┐    STDIO/WebSocket   ┌──────────────────┐    WebSocket    ┌──────────────────┐
│   MCP Client    │ ◄─────────────────► │   MCP Server     │ ◄─────────────► │  Bridge Server   │
│  (AI Agents)    │                     │  (port 3000)     │                 │  (port 9223)     │
└─────────────────┘                     └──────────────────┘                 └──────────────────┘
                                                                                        │
┌─────────────────┐    WebSocket         ┌──────────────────┐                         │ WebSocket
│   Client App    │ ◄─────────────────► │  Bridge Server   │                         │ (port 9224)
│  (JavaScript)   │      CDP/BROP       │  (Node.js)       │                         ▼
└─────────────────┘                     └──────────────────┘                ┌──────────────────┐
                                                                             │  Chrome Extension │
                                                                             │  Background Script│
                                                                             └──────────────────┘
                                                                                      │
                                                                                      │ Chrome APIs
                                                                                      ▼
                                                                             ┌──────────────────┐
                                                                             │   Web Pages      │
                                                                             │  Content Scripts │
                                                                             └──────────────────┘
```

### Components

1. **MCP Server** (`bridge/mcp.js`): Model Context Protocol server with dual-mode operation (STDIO transport)
2. **Bridge Server** (`bridge/bridge_server.js`): Node.js WebSocket server providing CDP/BROP compatibility
3. **Background Script** (`background_bridge_client.js`): Extension service worker handling automation commands
4. **Content Script** (`content.js`): Injected into web pages for DOM interaction and monitoring
5. **Injected Script** (`injected.js`): Runs in page context for enhanced JavaScript execution
6. **Popup** (`popup.html/js`): Extension UI showing service status and debugging tools
7. **Content Extractor** (`content-extractor.js`): Advanced content extraction with Readability and semantic markdown
8. **DOM Simplifier** (`dom_simplifier.js`): Utility for extracting simplified DOM structures
9. **Client Library** (`client/`): JavaScript client library for BROP integration

## Development

### Development Mode

Start the bridge server with auto-reload:

```bash
pnpm run dev
```

### Testing

**MCP Server Tests:**

```bash
pnpm run test:mcp        # Test MCP server modes
```

**BROP Protocol Tests:**

```bash
cd tests
./run_all_brop_tests.sh  # Comprehensive test suite
```

**Individual Tests:**

```bash
node tests/working_brop_test.js
node tests/test_bridge_connection.js
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
curl http://localhost:9225/json/version
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
6. **Run tests:** `pnpm run test:mcp` or `cd tests && ./run_all_brop_tests.sh`

## Roadmap

- [x] **MCP Server Implementation** - Complete Model Context Protocol support
- [x] **Advanced Content Extraction** - Mozilla Readability and semantic markdown
- [x] **Extension Packaging** - Production-ready Chrome extension packaging
- [x] **Dual-Mode MCP** - Server/relay mode detection and switching
- [ ] Enhanced debugging and monitoring tools
- [ ] Firefox extension support
- [ ] Additional CDP method implementations
- [ ] Performance optimizations
- [ ] TypeScript conversion
- [ ] npm package for JavaScript client library

## Related Documentation

- **[MCP_README.md](MCP_README.md)** - Complete MCP server documentation and usage examples
- **[CLAUDE.md](CLAUDE.md)** - Development instructions and debugging toolkit
- **[CLIENT_SETUP.md](CLIENT_SETUP.md)** - JavaScript client library setup and usage
