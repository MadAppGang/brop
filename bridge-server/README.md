# BROP Bridge Server

A WebSocket bridge server that enables communication between Chrome extensions and external automation tools like Playwright.

## Architecture

The bridge server provides three WebSocket interfaces:

```
┌─────────────────┐   CDP Protocol   ┌──────────────────┐   WebSocket   ┌─────────────────┐
│   Playwright    │ ◄─────────────► │  Bridge Server   │ ◄───────────► │ Chrome Extension│
│   (CDP Client)  │   Port 9222     │                  │   Port 9224   │                 │
└─────────────────┘                 │                  │               └─────────────────┘
                                    │                  │
┌─────────────────┐   BROP Protocol │                  │
│   BROP Client   │ ◄─────────────► │                  │
│                 │   Port 9223     │                  │
└─────────────────┘                 └──────────────────┘
```

### Ports:

- **9222**: CDP Server (for Playwright and other CDP clients)
- **9223**: BROP Server (for custom BROP clients)  
- **9224**: Extension Server (Chrome extension connects here as a client)
- **9225**: HTTP Server (CDP discovery endpoints)

## Installation

```bash
npm install
```

## Usage

### 1. Start the Bridge Server

```bash
npm start
```

You should see:
```
🌉 BROP Bridge Server (Node.js)
==================================================
Starting multi-protocol bridge server...

🎭 CDP Server: ws://localhost:9222 (for Playwright)
🔧 BROP Server: ws://localhost:9223 (for BROP clients)
🔌 Extension Server: ws://localhost:9224 (extension connects here)
🌐 HTTP Server: http://localhost:9225 (CDP discovery)

📡 Waiting for Chrome extension to connect...
```

### 2. Load the Chrome Extension

- Load the BROP extension in Chrome
- The extension will automatically connect to the bridge server
- You should see: `🔌 Chrome extension connected`

### 3. Use Playwright

```python
from playwright.async_api import async_playwright

async with async_playwright() as p:
    browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
    page = browser.contexts[0].pages[0]
    await page.goto("https://example.com")
    title = await page.title()
    print(f"Page title: {title}")
    await browser.close()
```

## How It Works

1. **Chrome Extension** connects as a WebSocket client to port 9224
2. **External tools** (Playwright, BROP clients) connect to ports 9222/9223
3. **Bridge server** routes messages between the extension and external clients
4. **Commands** are translated between CDP and BROP protocols as needed

## Protocol Translation

### CDP Commands → Extension
```json
// CDP Input
{
  "id": 1,
  "method": "Runtime.evaluate", 
  "params": { "expression": "document.title" }
}

// Extension Format
{
  "type": "cdp_command",
  "id": 1,
  "method": "Runtime.evaluate",
  "params": { "expression": "document.title" }
}
```

### BROP Commands → Extension
```json
// BROP Input
{
  "id": "req_1",
  "command": {
    "type": "execute_console",
    "params": { "code": "console.log('test')" }
  }
}

// Extension Format  
{
  "type": "brop_command",
  "id": "req_1", 
  "command": {
    "type": "execute_console",
    "params": { "code": "console.log('test')" }
  }
}
```

## Debugging

### Check Server Status
```bash
curl http://localhost:9225/json/version
```

### Monitor Connections
The server logs all connections and message routing:
```
🔌 Chrome extension connected
🎭 CDP client connected: /page/1
🔧 BROP client connected
🎭 CDP: Runtime.evaluate
🔧 BROP: execute_console
```

## Development

### Start in Development Mode
```bash
npm run dev
```

### Environment Variables
- `PORT_CDP=9222` - CDP server port
- `PORT_BROP=9223` - BROP server port  
- `PORT_EXTENSION=9224` - Extension server port
- `PORT_HTTP=9225` - HTTP discovery port

## Troubleshooting

### Extension Not Connecting
1. Check that the extension is loaded in Chrome
2. Verify the extension's WebSocket connection code
3. Check browser console for connection errors

### Playwright Connection Failed
1. Ensure bridge server is running on port 9222
2. Check that extension is connected to bridge
3. Verify HTTP discovery endpoint: `curl http://localhost:9225/json`

### BROP Client Issues
1. Connect to `ws://localhost:9223` 
2. Send test message to verify bridge routing
3. Check server logs for message processing errors

## License

MIT License