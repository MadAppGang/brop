# BROP Extension - Development & Debugging Guide

This guide covers how to run, test, and debug the BROP Chrome extension during development.

## 🚀 Quick Start

### Prerequisites
- Chrome browser (latest version recommended)
- Python 3.7+ (for client examples)
- Node.js and npm (optional, for WebSocket dependencies only)

### Installation Steps

1. **Setup the project:**
```bash
cd /path/to/mcp-brop

# Install minimal Node.js dependencies (optional)
npm install --production

# Install Python dependencies
pip install -r requirements.txt
```

**Note:** No build process required! The extension uses JSON instead of Protocol Buffers for simplicity.

2. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `mcp-brop` directory
   - Note the Extension ID (you'll need this for debugging)

3. **Verify installation:**
   - Look for the BROP icon in Chrome toolbar
   - Click the icon to open the popup
   - Verify the service shows as "Active"

## 🔧 Running the Extension

### Method 1: Basic Chrome Extension
```bash
# 1. Load extension in Chrome (as above)
# 2. Open any webpage
# 3. Test with popup controls or Python client
python client_example.py
```

### Method 2: With Native Messaging (Optional)
```bash
# 1. Install native messaging host (optional for advanced users)
python native_host.py --install

# 2. Update extension ID in generated manifest
# Edit: ~/.../NativeMessagingHosts/com.brop.native_host.json
# Replace YOUR_EXTENSION_ID_HERE with actual extension ID

# 3. Start native messaging host (if using external apps)
python native_host.py

# 4. Run Playwright example
python playwright_embedded_example.py
```

## 🐛 Debugging Guide

### 1. Extension Debugging

#### Background Script Debugging
```bash
# Open Chrome DevTools for background script
chrome://extensions/ → BROP extension → "Inspect views: background page"
```

**Common background script issues:**
- Check console for initialization errors
- Verify `embeddedBropServer` is defined
- Check storage permissions and data

**Debug commands:**
```javascript
// In background script console
embeddedBropServer.enabled                    // Check service status
embeddedBropServer.callLogs.length           // Check log count
embeddedBropServer.sessions.size             // Check active sessions
embeddedBropServer.getRecentLogs(10)         // Get recent logs
```

#### Content Script Debugging
```bash
# Open DevTools on any webpage with BROP loaded
F12 → Console tab
```

**Debug commands:**
```javascript
// In page console
window.BROP                                  // Check content script
window.BROP.getConsoleLogs()                // Get console logs
window.BROP_API                             // Check injected script
```

#### Popup Debugging
```bash
# Right-click BROP icon → "Inspect popup"
```

### 2. Network & Communication Debugging

#### Runtime Messaging
```javascript
// Test runtime messaging from any page console
chrome.runtime.sendMessage('EXTENSION_ID', {
  type: 'GET_STATUS'
}, response => console.log(response));
```

#### Native Messaging Debug
```bash
# Check native messaging manifest
cat ~/.../NativeMessagingHosts/com.brop.native_host.json

# Run native host with debug output
python native_host.py

# Test WebSocket connection
python -c "
import asyncio
import websockets
async def test():
    async with websockets.connect('ws://localhost:9222') as ws:
        await ws.send('{\"method\":\"Runtime.evaluate\",\"params\":{\"expression\":\"1+1\"},\"id\":1}')
        print(await ws.recv())
asyncio.run(test())
"
```

#### CDP Connection Debug
```bash
# The embedded CDP server runs within the extension
# No external ports to check - everything is internal

# Test with Chrome's built-in CDP (for comparison)
chrome --remote-debugging-port=9222
# Then visit: chrome://inspect/#devices
```

### 3. Python Client Debugging

#### Basic BROP Client
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Test connection
from client_example import BROPClient
client = BROPClient()
await client.connect()  # Check for connection errors
```

#### Playwright Integration
```python
# Debug Playwright connection
import asyncio
from playwright.async_api import async_playwright

async def debug_playwright():
    async with async_playwright() as p:
        try:
            # Enable verbose logging
            browser = await p.chromium.connect_over_cdp(
                "ws://localhost:9222",
                slow_mo=1000  # Slow down for debugging
            )
            print("Connected successfully!")
            print(f"Browser version: {await browser.version()}")
            
        except Exception as e:
            print(f"Connection failed: {e}")
            print("Make sure BROP extension is loaded and active")
            print("Check extension popup for service status")

asyncio.run(debug_playwright())
```

### 4. Common Issues & Solutions

#### "Service Worker Inactive"
```bash
# Solution: Reload extension
chrome://extensions/ → BROP → Reload button

# Or restart background script programmatically
chrome.runtime.reload()
```

#### "No active tab found"
```bash
# Ensure you have an active tab open
# Check tab permissions in manifest.json
# Verify "activeTab" permission is granted
```

#### "Native messaging host not found"
```bash
# Check installation
python native_host.py --install

# Verify manifest location (macOS)
ls ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# Verify manifest content
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.brop.native_host.json
```

#### Playwright Connection Issues
```bash
# Check extension status
# 1. Open extension popup
# 2. Verify "Service Active" status
# 3. Try "Test Connection" button
# 4. Check "Call Logs" tab for activity

# Check browser console
# 1. Go to chrome://extensions/
# 2. Find BROP → "Inspect views: background page"
# 3. Look for CDP server messages
```

### 5. Performance Debugging

#### Memory Usage
```javascript
// In background script console
console.log('Logs count:', embeddedBropServer.callLogs.length);
console.log('Sessions:', embeddedBropServer.sessions.size);

// Check Chrome memory
chrome://memory/
```

#### Call Performance
```javascript
// Enable detailed timing in logs
embeddedBropServer.logCall('TEST', 'performance_test', {}, {}, null, Date.now());

// Check recent call durations
embeddedBropServer.getRecentLogs(10).forEach(log => 
  console.log(`${log.method}: ${log.duration}ms`)
);
```

### 6. Development Workflow

#### Hot Reload Setup
```bash
# 1. Make changes to code
# 2. Reload extension
chrome://extensions/ → BROP → Reload

# 3. Or use automatic reload (development only)
# Add to background script:
if (chrome.runtime.getManifest().version.includes('dev')) {
  chrome.runtime.onSuspend.addListener(() => {
    chrome.runtime.reload();
  });
}
```

#### Testing Checklist
- [ ] Extension loads without errors
- [ ] Popup opens and shows correct status
- [ ] Service toggle works
- [ ] Logs are captured and displayed
- [ ] Basic commands work (navigate, screenshot, etc.)
- [ ] Python client can connect
- [ ] Playwright integration works
- [ ] Native messaging functions (if used)

#### Debug Environment Variables
```bash
# Enable verbose logging
export BROP_DEBUG=1
export PLAYWRIGHT_DEBUG=1

# Run with debug flags
python client_example.py
```

## 📊 Monitoring & Logging

### Built-in Monitoring
- Use the extension popup "Call Logs" tab
- Monitor real-time API calls
- Filter by type, status, or search terms
- Export logs for analysis

### External Monitoring
```bash
# Monitor background script logs
chrome://extensions/ → BROP → Inspect views: background page → Console

# Monitor all extension activity
chrome://extensions/ → BROP → Errors (if any)

# System-level monitoring
tail -f /var/log/system.log | grep -i chrome  # macOS
journalctl -f | grep -i chrome                # Linux
```

## 🔍 Advanced Debugging

### Protocol Analysis
```javascript
// Intercept and log all CDP messages
const originalSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(data) {
  console.log('CDP Send:', JSON.parse(data));
  return originalSend.call(this, data);
};
```

### Extension Storage Inspection
```javascript
// Check stored data
chrome.storage.local.get(null, (data) => console.log('Storage:', data));

// Clear storage (for testing)
chrome.storage.local.clear();
```

### Network Traffic Analysis
```bash
# Use Chrome DevTools Network tab
# Monitor WebSocket frames in DevTools
# Check for failed requests or timeouts
```

## 🎯 Production Deployment

### Building for Production
```bash
# Remove debug code
# Minify JavaScript (optional)
# Update manifest version
# Test in clean Chrome profile
```

### Distribution
```bash
# Package extension
zip -r brop-extension.zip . -x "*.git*" "node_modules/*" "*.md" "*.py"

# Upload to Chrome Web Store (optional)
# Or distribute as unpacked extension
```

This guide should help you successfully run and debug the BROP extension. For additional help, check the logs in the extension popup or contact the development team.