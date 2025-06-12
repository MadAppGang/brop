# BROP CDP Clients

This directory contains multiple Chrome DevTools Protocol (CDP) client implementations for controlling Chrome through the BROP extension.

## Available Clients

### 1. Python Clients
- **`playwright_embedded_example.py`** - Playwright integration with BROP
- **`working_example.py`** - Working Playwright example that bypasses context issues  
- **`simple_test.py`** - Direct CDP commands testing

### 2. JavaScript/Node.js Clients
- **`brop_cdp_client.js`** - Full-featured JavaScript CDP client (ES6 modules)
- **`node_cdp_example.js`** - Node.js CDP client example ✅ **WORKING**
- **`javascript_example.js`** - ES6 module example

### 3. Browser Client
- **`browser_cdp_example.html`** - HTML page with browser-based CDP client

## Quick Start

### Prerequisites
1. **Bridge Server Running:**
   ```bash
   cd ../bridge-server
   node bridge_server.js
   ```

2. **Chrome Extension Loaded:**
   - Load the BROP extension in Chrome
   - Extension popup should show "Bridge Connected"

### Node.js Example (Recommended)
```bash
node node_cdp_example.js
```

**Output Example:**
```
🚀 BROP Node.js CDP Example
🔗 Connected to BROP bridge server
📋 Getting browser version...
   Browser: Chrome/BROP-Extension
🎯 Getting available targets...
   Found 14 page targets
🌐 Navigating to example.com...
📸 Taking screenshot...
   💾 Screenshot saved as brop_node_screenshot.png
✅ BROP Node.js example completed successfully!
```

### Python Example
```bash
python working_example.py
```

### Browser Example
1. Open `browser_cdp_example.html` in Chrome
2. Click "Connect to BROP"
3. Use the buttons to control the browser

## Client Features

### Node.js CDP Client (`node_cdp_example.js`)
**Status: ✅ FULLY WORKING**

**Features:**
- ✅ Browser version detection
- ✅ Target (tab) discovery  
- ✅ Page navigation
- ✅ JavaScript evaluation
- ✅ Screenshot capture
- ✅ Page interaction
- ✅ Real-time logging

**Example Usage:**
```javascript
const { NodeBROPCDPClient } = require('./node_cdp_example.js');

const cdp = new NodeBROPCDPClient();
await cdp.connect();

// Get browser version
const version = await cdp.sendCommand('Browser.getVersion');

// Navigate to page
await cdp.sendCommand('Page.navigate', { url: 'https://example.com' });

// Take screenshot
const screenshot = await cdp.sendCommand('Page.captureScreenshot');
```

### JavaScript CDP Client (`brop_cdp_client.js`)
**Status: ✅ FEATURE COMPLETE**

**Features:**
- Full CDP domain support (Browser, Target, Page, Runtime, etc.)
- Event listening capabilities
- Promise-based API
- Automatic reconnection
- Error handling
- Works in both Node.js and browser environments

**Example Usage:**
```javascript
import { BROPCDPClient } from './brop_cdp_client.js';

const cdp = new BROPCDPClient();

// Use domain-based API
await cdp.Browser.getVersion();
await cdp.Target.getTargets();
await cdp.Page.navigate({ url: 'https://example.com' });

// Listen for events
cdp.Runtime.addEventListener('consoleAPICalled', (event) => {
    console.log('Console:', event.params.args);
});
```

### Browser HTML Client (`browser_cdp_example.html`)
**Status: ✅ READY TO USE**

**Features:**
- Interactive web interface
- Real-time logging
- Screenshot display
- No installation required
- Visual feedback

**Usage:**
1. Open the HTML file in Chrome
2. Click "Connect to BROP"  
3. Use buttons to control browser

## CDP Commands Supported

### Browser Domain
- `Browser.getVersion` - Get browser version info
- `Browser.setDownloadBehavior` - Configure downloads  
- `Browser.createBrowserContext` - Create isolated context
- `Browser.disposeBrowserContext` - Remove context
- `Browser.getBrowserContexts` - List contexts

### Target Domain  
- `Target.getTargets` - List all tabs/targets
- `Target.createTarget` - Create new tab
- `Target.activateTarget` - Switch to tab
- `Target.closeTarget` - Close tab
- `Target.attachToTarget` - Attach debugger
- `Target.setAutoAttach` - Auto-attach to new targets
- `Target.getTargetInfo` - Get target details

### Page Domain
- `Page.navigate` - Navigate to URL
- `Page.captureScreenshot` - Take screenshot
- `Page.enable` - Enable page events
- `Page.getFrameTree` - Get frame structure

### Runtime Domain
- `Runtime.evaluate` - Execute JavaScript
- `Runtime.enable` - Enable runtime events
- `Runtime.addBinding` - Add function binding

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDP Client    │───▶│  Bridge Server  │───▶│ Chrome Extension│
│  (Your Code)    │    │   (Node.js)     │    │     (BROP)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │              ws://localhost:9222              │
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                               │
                    ┌─────────────────┐
                    │ Chrome Browser  │
                    │   (Controlled)  │  
                    └─────────────────┘
```

## Connection Endpoints

- **CDP Interface:** `ws://localhost:9222` (for CDP clients)
- **BROP Interface:** `ws://localhost:9223` (for BROP-specific clients)
- **Extension Interface:** `ws://localhost:9224` (extension connects here)
- **HTTP Discovery:** `http://localhost:9225` (CDP discovery API)

## Debugging

### Check Bridge Server Status
```bash
# Bridge server logs
tail -f ../bridge-server/bridge.log
```

### Check Extension Status
1. Open BROP extension popup
2. Verify "Bridge Connected" status
3. Check "Browser Control Status" shows debugger active

### Common Issues

1. **"Extension not connected"**
   - Reload BROP extension in Chrome
   - Check extension popup shows "Bridge Connected"

2. **"WebSocket connection failed"**
   - Verify bridge server is running on port 9222
   - Check firewall/network restrictions

3. **"No targets found"**
   - Open some tabs in Chrome
   - Refresh target list

## Advanced Usage

### Event Listeners
```javascript
// Listen for console messages
cdp.Runtime.addEventListener('consoleAPICalled', (event) => {
    console.log('Page console:', event.params.args);
});

// Listen for navigation
cdp.Page.addEventListener('frameNavigated', (event) => {
    console.log('Navigated to:', event.params.frame.url);
});

// Enable domains to receive events
await cdp.Runtime.enable();
await cdp.Page.enable();
```

### Session Management
```javascript
// Attach to specific target
const session = await cdp.Target.attachToTarget({ 
    targetId: 'tab_123',
    flatten: true 
});

// Send commands to specific session
await cdp.Runtime.evaluate({
    expression: 'console.log("Hello")'
}, session.sessionId);
```

### Error Handling
```javascript
try {
    await cdp.Page.navigate({ url: 'https://example.com' });
} catch (error) {
    if (error.code === 'ConnectionRefused') {
        console.log('Bridge server not running');
    } else {
        console.log('Navigation failed:', error.message);
    }
}
```

## Performance Notes

- **Concurrent Operations:** CDP client supports concurrent commands
- **Event Buffering:** Events are buffered until listeners are attached  
- **Connection Pooling:** Single WebSocket connection handles all commands
- **Automatic Cleanup:** Connections are cleaned up on process exit

## Security Considerations

- Bridge server runs on localhost only
- No external network access required
- Chrome extension requires explicit user installation
- CDP commands respect browser security policies
- Screenshots and page content follow same-origin policy

---

**Next Steps:**
1. Try the Node.js example: `node node_cdp_example.js`
2. Open the browser example: `browser_cdp_example.html`
3. Integrate CDP client into your own projects
4. Explore advanced CDP features and events