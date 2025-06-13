# BROP MCP Server

Model Context Protocol server for Browser Remote Operations Protocol (BROP) - Control Chrome browser remotely via MCP tools.

## Overview

The BROP MCP Server enables AI assistants to control Chrome browsers through the Model Context Protocol. It provides a comprehensive set of tools for browser automation including navigation, content extraction, JavaScript execution, and tab management.

## Installation

### As NPX Executable (Recommended)

```bash
# Install globally
npm install -g @madappgang/brop-mcp

# Or use directly with npx
npx @madappgang/brop-mcp
```

### From Source

```bash
git clone https://github.com/madappgang/mcp-brop.git
cd mcp-brop/bridge
pnpm install
```

## Usage

### 1. Add to Claude Desktop

Add the server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "brop": {
      "command": "npx",
      "args": ["-y", "@madappgang/brop-mcp"]
    }
  }
}
```

### 2. Load Chrome Extension

- Install the BROP Chrome extension
- The extension will automatically connect when the MCP server starts

### 3. Start Using BROP Tools

The server provides these MCP tools:

- `brop_navigate` - Navigate to URLs
- `brop_get_page_content` - Get raw page content
- `brop_get_simplified_content` - Get cleaned content (HTML/Markdown)
- `brop_execute_script` - Run JavaScript
- `brop_click_element` - Click elements
- `brop_type_text` - Type into inputs
- `brop_create_page` - Create new tabs
- `brop_close_tab` - Close tabs
- `brop_list_tabs` - List all tabs
- `brop_activate_tab` - Switch tabs
- `brop_get_server_status` - Check server status

## Architecture

The MCP server operates in two modes:

### Server Mode (Default)
- Starts BROP bridge servers on ports 9223/9224
- Chrome extension connects directly
- Full standalone operation

### Relay Mode (Fallback)
- Connects to existing BROP server
- Used when port 9223 is already occupied
- Relays commands through existing bridge

```
┌─────────────────┐   MCP Protocol   ┌──────────────────┐   WebSocket   ┌─────────────────┐
│   Claude/AI     │ ◄─────────────► │   BROP MCP       │ ◄───────────► │ Chrome Extension│
│   Assistant     │     STDIO       │   Server         │   Port 9224   │                 │
└─────────────────┘                 └──────────────────┘               └─────────────────┘
```

## Example Usage

### Navigate and Extract Content

```json
// Navigate to a website
{
  "tool": "brop_navigate",
  "arguments": {
    "url": "https://example.com"
  }
}

// Get simplified content as markdown
{
  "tool": "brop_get_simplified_content", 
  "arguments": {
    "tabId": 1,
    "format": "markdown"
  }
}
```

### Automate Form Filling

```json
// Type into search field
{
  "tool": "brop_type_text",
  "arguments": {
    "selector": "input[name='search']",
    "text": "hello world"
  }
}

// Click search button
{
  "tool": "brop_click_element",
  "arguments": {
    "selector": "button[type='submit']"
  }
}
```

### Execute Custom JavaScript

```json
{
  "tool": "brop_execute_script",
  "arguments": {
    "script": "return document.title + ' - ' + window.location.href;"
  }
}
```

## Development

### Local Development

```bash
# Install dependencies
pnpm install

# Start MCP server
pnpm run mcp

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node mcp-server.js
```

### Testing

```bash
# Start bridge server directly
pnpm run dev

# Run debug workflow
pnpm run debug:workflow
```

## Configuration

### Environment Variables

- `PORT_BROP=9223` - BROP server port
- `PORT_EXTENSION=9224` - Extension server port

### MCP Server Configuration

The server supports standard MCP configuration options and can be customized through the MCP client configuration.

## Troubleshooting

### Extension Not Connecting

1. Ensure Chrome extension is loaded and active
2. Check that WebSocket ports 9223/9224 are available
3. Verify extension permissions in Chrome

### MCP Connection Issues

1. Test with MCP Inspector: `npx @modelcontextprotocol/inspector node mcp-server.js`
2. Check STDIO transport is working properly
3. Verify all dependencies are installed

### Tool Execution Errors

1. Use `brop_get_server_status` to check connection status
2. Ensure target tab exists before executing commands
3. Check browser console for JavaScript errors

## API Reference

### Tool Schemas

All tools use Zod schema validation. See `mcp-server.js` for complete parameter definitions.

### Return Format

All tools return results in MCP-compatible format:

```json
{
  "content": [
    {
      "type": "text", 
      "text": "JSON stringified result"
    }
  ]
}
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions welcome! Please see contributing guidelines in the repository.