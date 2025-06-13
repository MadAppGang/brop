# MCP BROP Server

Model Context Protocol (MCP) interface for Browser Remote Operations Protocol (BROP).

## Overview

The MCP BROP Server provides a standardized MCP interface for browser automation through BROP. It can operate in two modes:

### 🔧 Server Mode

- **When**: Port 9223 is available (no existing BROP server running)
- **Action**: Starts full BROP bridge servers on ports 9223 and 9224
- **Use case**: Primary MCP server instance

### 🔗 Relay Mode

- **When**: Port 9223 is occupied (existing BROP server detected)
- **Action**: Connects as a BROP client to the existing server
- **Use case**: Multiple MCP server instances sharing one BROP server

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start MCP Server

```bash
# Auto-detects mode based on port 9223 availability
pnpm run mcp

# Or directly (STDIO transport)
node bridge/mcp.js

# For MCP Inspector
pnpm run mcp:inspect
```

### 3. Connect MCP Client

The MCP server uses **STDIO transport** and supports the following:

**Protocol Methods:**
- `ping` - Test connectivity and get server status

**Available Tools:**

- `brop_navigate` - Navigate to a URL
- `brop_get_page_content` - Get basic page content (raw HTML and text)
- `brop_get_simplified_content` - Get cleaned content (HTML via Readability or Markdown)
- `brop_execute_script` - Execute JavaScript
- `brop_click_element` - Click elements by CSS selector
- `brop_type_text` - Type text into input fields
- `brop_create_page` - Create a new browser page/tab
- `brop_close_tab` - Close a browser tab
- `brop_list_tabs` - List all open browser tabs
- `brop_activate_tab` - Switch to/activate a specific tab
- `brop_get_server_status` - Get server status and connection info

## Usage Examples

### Basic Connectivity Test (Ping)

Test server connectivity and get status information:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "ping",
  "params": {}
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "status": "pong",
    "timestamp": "2025-06-13T10:37:38.254Z",
    "mode": "server",
    "uptime": 15432,
    "connections": {
      "extensionConnected": true,
      "bropConnected": false
    }
  }
}
```

### Basic MCP Client Connection

```javascript
const WebSocket = require("ws");
const client = new WebSocket("ws://localhost:3000");

client.on("open", () => {
  // Test connectivity first
  client.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "ping",
      params: {}
    })
  );
  
  // List available tools
  client.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    })
  );
});

client.on("message", (message) => {
  const data = JSON.parse(message);
  console.log("Response:", data);
});
```

### Navigate to URL

```javascript
client.send(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "brop_navigate",
      arguments: {
        url: "https://example.com",
      },
    },
  })
);
```

### Get Basic Page Content

```javascript
client.send(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "brop_get_page_content",
      arguments: {
        tabId: 123,
      },
    },
  })
);
```

### Get Simplified Content (Readability HTML)

```javascript
client.send(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "brop_get_simplified_content",
      arguments: {
        tabId: 123,
        format: "html",
        enableDetailedResponse: true,
      },
    },
  })
);
```

### Get Simplified Content (Semantic Markdown)

```javascript
client.send(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "brop_get_simplified_content",
      arguments: {
        tabId: 123,
        format: "markdown",
      },
    },
  })
);
```

### Execute JavaScript

```javascript
client.send(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "brop_execute_script",
      arguments: {
        script: "document.title",
      },
    },
  })
);
```

### Create New Page
```javascript
client.send(JSON.stringify({
  jsonrpc: '2.0',
  id: 7,
  method: 'tools/call',
  params: {
    name: 'brop_create_page',
    arguments: {
      url: 'https://google.com',
      active: true
    }
  }
}));
```

### List All Tabs
```javascript
client.send(JSON.stringify({
  jsonrpc: '2.0',
  id: 8,
  method: 'tools/call',
  params: {
    name: 'brop_list_tabs',
    arguments: {
      includeContent: false
    }
  }
}));
```

### Activate/Switch to Tab
```javascript
client.send(JSON.stringify({
  jsonrpc: '2.0',
  id: 9,
  method: 'tools/call',
  params: {
    name: 'brop_activate_tab',
    arguments: {
      tabId: 123
    }
  }
}));
```

### Close Tab
```javascript
client.send(JSON.stringify({
  jsonrpc: '2.0',
  id: 10,
  method: 'tools/call',
  params: {
    name: 'brop_close_tab',
    arguments: {
      tabId: 123
    }
  }
}));
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│   MCP Server    │───▶│   BROP Server   │
│                 │    │   (port 3000)   │    │   (port 9223)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                               │
                                               ▼
                                       ┌─────────────────┐
                                       │ Chrome Extension│
                                       │   (port 9224)   │
                                       └─────────────────┘
```

### Server Mode Flow

1. MCP Server checks port 9223 availability
2. Starts BROP bridge servers on 9223/9224
3. Chrome extension connects to port 9224
4. MCP clients connect to port 3000
5. Commands flow: MCP Client → MCP Server → BROP Bridge → Chrome Extension

### Relay Mode Flow

1. MCP Server detects port 9223 is occupied
2. Connects as BROP client to existing server on 9223
3. MCP clients connect to port 3000
4. Commands flow: MCP Client → MCP Server → BROP Client → BROP Server → Chrome Extension

## Testing

### Run Mode Tests

```bash
pnpm run test:mcp
```

This tests both server and relay modes automatically.

### Manual Testing

```bash
# Terminal 1: Start bridge server
pnpm run bridge

# Terminal 2: Start MCP server (will be in relay mode)
pnpm run mcp

# Terminal 3: Test MCP connection
node -e "
const WebSocket = require('ws');
const client = new WebSocket('ws://localhost:3000');
client.on('open', () => {
  client.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'}));
});
client.on('message', (msg) => {
  console.log(JSON.parse(msg));
  client.close();
});
"
```

## Configuration

### Environment Variables

- `MCP_PORT` - MCP server port (default: 3000)
- `BROP_HOST` - BROP server host (default: localhost)
- `BROP_PORT` - BROP server port (default: 9223)

### Command Line Options

```bash
node mcp-server.js --port 3001 --brop-port 9225
```

## Error Handling

The MCP server provides detailed error responses following MCP specification:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Chrome extension not connected"
  }
}
```

Common error codes:

- `-32000` - BROP server error
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32700` - Parse error

## Development

### Project Structure

```
├── mcp-server.js           # Main MCP server
├── test-mcp-modes.js       # Mode testing script
├── bridge/          # BROP bridge server
│   └── bridge_server.js
└── package.json            # Scripts and dependencies
```

### Adding New Tools

1. Add tool definition to `getMCPTools()`
2. Add handler in `handleMCPToolCall()`
3. Add BROP command conversion in `convertMCPToolToBROPCommand()`

### Debugging

- Use `console.log` in MCP server for debugging
- Check BROP bridge logs: `pnpm run debug:logs`
- Monitor extension errors: `pnpm run debug:errors`

## Integration with MCP Clients

This server is compatible with any MCP client including:

- Claude Desktop
- Cline
- Custom MCP implementations

Simply configure your MCP client to connect to `ws://localhost:3000`.

## License

MIT - See main project license.
