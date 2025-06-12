# BROP Extension - Embedded Setup Guide

This guide shows how to use the BROP Chrome extension with **everything embedded** - no external servers required!

## What's Different

The embedded version includes:
- ✅ **CDP Server built into the extension** - no separate bridge server
- ✅ **Native messaging support** - for external application connections  
- ✅ **Direct Playwright compatibility** - same API, no changes needed
- ✅ **WebSocket alternative** - uses Chrome's runtime messaging

## Setup Options

### Option 1: Direct Extension Use (Recommended)

**Best for**: Most users - simple setup with full functionality

1. **Load the extension:**
   - Use `background_embedded.js` (already configured in manifest)
   - Load extension in Chrome developer mode
   - No additional setup required!

2. **Use with Playwright:**
```python
async with async_playwright() as p:
    browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
    page = browser.contexts[0].pages[0]
    await page.goto("https://example.com")
```

3. **Use with Python Client:**
```python
from client_example import BROPClient
client = BROPClient()
await client.connect()
await client.navigate("https://example.com")
```

### Option 2: Direct Runtime Messaging

**Best for**: Web applications or simple automation scripts

1. **Load the extension** with `background_embedded.js`

2. **Connect via chrome.runtime:**
```javascript
// From a web page or another extension
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'CDP_COMMAND',
  method: 'Page.navigate',
  params: { url: 'https://example.com' }
}, response => {
  console.log('Navigation result:', response);
});
```

3. **Use the Python client:**
```python
from client_example import BROPClient
client = BROPClient()
await client.connect()
await client.navigate("https://example.com")
```

### Option 3: Native Messaging (Advanced)

**Best for**: Advanced users who need external application integration

1. **Install native messaging host:**
```bash
python native_host.py --install
```

2. **Update extension ID in generated manifest**

3. **Start native host:**
```bash
python native_host.py
```

4. **Connect normally:**
```python
async with async_playwright() as p:
    browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
```

## File Structure for Embedded Version

```
mcp-brop/
├── manifest.json                 # Uses background_embedded.js
├── background_embedded.js        # All-in-one background script
├── content.js                   # Page interaction script  
├── injected.js                  # Console access script
├── native_host.py               # Native messaging bridge
├── playwright_embedded_example.py  # Usage example
├── popup.html/js                # Extension UI
└── proto/                       # Protocol definitions
```

## Connection Methods Compared

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| **Direct Extension** | ✅ No setup required<br>✅ Built-in CDP server<br>✅ Secure | ⚠️ Chrome only | Most users, Playwright |
| **Runtime Messaging** | ✅ Simple setup<br>✅ No installation | ⚠️ Chrome context only | Web apps, browser scripts |
| **Native Messaging** | ✅ External app support<br>✅ Advanced integration | ⚠️ Requires installation | Advanced users, external tools |

## Testing the Setup

1. **Install and load the extension**

2. **Run the test:**
```bash
python playwright_embedded_example.py
```

3. **Expected output:**
```
✅ Connected to embedded BROP extension!
🌐 Navigating to example.com...
📄 Getting page information...
📸 Taking screenshot...
✅ Embedded BROP example completed successfully!
```

## Troubleshooting

### "Connection refused" errors
- Make sure the extension is loaded and active
- Check that native messaging host is installed
- Verify extension ID in native messaging manifest

### "No active tab" errors  
- Open a Chrome tab before running automation
- Make sure the extension has permission for the current tab

### Playwright connection issues
- Install required packages: `pip install playwright websockets`
- Run `playwright install chromium`
- Check that port 9222 isn't blocked

## API Examples

### Basic Page Automation
```python
async with async_playwright() as p:
    browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
    page = browser.contexts[0].pages[0]
    
    await page.goto("https://example.com")
    title = await page.title()
    await page.screenshot(path="screenshot.png")
    
    await browser.close()
```

### Console Interaction
```python
# Execute JavaScript
result = await page.evaluate("document.title")

# Get console logs (BROP-specific)
logs = await page.evaluate("window.BROP.getConsoleLogs()")
```

### Element Interaction
```python
# Click elements
await page.click("button")

# Type text
await page.fill("input[name='search']", "test query")

# Wait for elements
await page.wait_for_selector(".result")
```

## Benefits of Embedded Approach

✅ **No External Dependencies** - Everything runs in the Chrome extension
✅ **Same Playwright API** - Existing scripts work with minimal changes  
✅ **Existing Browser Context** - Use current tabs, cookies, extensions
✅ **Enhanced Security** - Runs within Chrome's security model
✅ **Easy Deployment** - Just install the Chrome extension
✅ **Real User Environment** - Automation in actual browsing session

## Next Steps

1. Load the extension with embedded background script
2. Choose your preferred connection method
3. Run the example to verify everything works
4. Start automating your workflows!

The embedded version gives you all the power of Playwright while working within your existing Chrome browser session.