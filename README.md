# BROP - Browser Remote Operations Protocol

A Chrome extension that provides a WebSocket interface with Protocol Buffers for browser automation, similar to Playwright but running as a browser extension.

## Features

- **WebSocket API**: Real-time communication with external applications
- **Protocol Buffers**: Efficient binary serialization for commands and responses
- **Console Access**: Capture console logs and execute JavaScript in browser console
- **Screenshot Capture**: Take full-page or viewport screenshots
- **Page Content Extraction**: Get HTML, text content, and metadata
- **Element Interaction**: Click, type, wait for elements
- **Navigation Control**: Navigate pages with load waiting
- **JavaScript Evaluation**: Execute code in page context

## Installation

1. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

2. **Install Python dependencies (for client tools):**
```bash
cd python-client
pip install -r requirements.txt
```

**Note:** No build process required! The extension works immediately without compilation.

## Usage

### Chrome Extension

Once installed, the extension will:
- Show a popup with connection status and recent console logs
- Inject content scripts into all pages to enable automation
- Run a background service worker to handle WebSocket connections

### Python Client

Use the provided Playwright integration for full browser automation:

```python
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        # Connect to BROP's embedded CDP server
        browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
        page = browser.contexts[0].pages[0]
        
        # Navigate and interact
        await page.goto("https://example.com")
        title = await page.title()
        await page.screenshot(path="screenshot.png")
        
        print(f"Page title: {title}")
        await browser.close()

# Run the example
import asyncio
asyncio.run(main())
```

**See [python-client/](python-client/) directory for more examples and tools.**

## API Reference

### Commands

All commands follow the Protocol Buffer schema defined in `proto/browser_commands.proto`:

#### Console Commands
- `get_console_logs`: Retrieve browser console logs
- `execute_console`: Execute JavaScript code in console

#### Page Commands  
- `get_screenshot`: Capture page screenshot
- `get_page_content`: Extract page HTML, text, and metadata
- `navigate`: Navigate to a URL

#### Element Commands
- `click`: Click on an element
- `type`: Type text into an element  
- `wait_for_element`: Wait for element to appear/disappear
- `get_element`: Get element information

#### JavaScript Commands
- `evaluate_js`: Evaluate JavaScript in page context

### Response Format

All responses include:
- `success`: Boolean indicating if command succeeded
- `error`: Error message if command failed
- `result`: Command-specific result data

## Architecture

```
┌─────────────────┐    WebSocket     ┌──────────────────┐
│   Client App    │ ◄─────────────► │  Chrome Extension │
│  (Python/Node)  │   + ProtoBuf    │  Background Script│
└─────────────────┘                 └──────────────────┘
                                             │
                                             │ Chrome APIs
                                             ▼
                                    ┌──────────────────┐
                                    │   Web Pages      │
                                    │  Content Scripts │
                                    └──────────────────┘
```

### Components

1. **Background Script** (`background.js`): Service worker that handles WebSocket connections and Chrome API calls
2. **Content Script** (`content.js`): Injected into web pages for DOM interaction and console monitoring  
3. **Injected Script** (`injected.js`): Runs in page context for enhanced console access
4. **Protocol Buffers** (`proto/browser_commands.proto`): Defines command/response schema
5. **Popup** (`popup.html/js`): Extension UI showing status and recent logs

## Development

### Building Protocol Buffers

```bash
npm run build:proto
```

### Development Mode

```bash
npm run dev
```

### Testing

Load the extension in Chrome and run:

```bash
python client_example.py
```

## Playwright Integration

**✅ Yes! Playwright can connect to BROP directly through the embedded CDP server.**

The extension includes a built-in Chrome DevTools Protocol (CDP) server that Playwright can connect to directly.

### Setup

1. **Load the BROP extension** in Chrome
2. **Use Playwright normally:**
```python
from playwright.async_api import async_playwright

async with async_playwright() as p:
    # Connect to BROP's embedded CDP server
    browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
    page = browser.contexts[0].pages[0]  # Use existing tab
    await page.goto("https://example.com")
    title = await page.title()
    await browser.close()
```

3. **Run the example:**
```bash
cd python-client
python playwright_embedded_example.py
```

### How It Works

```
┌─────────────────┐   CDP Protocol   ┌──────────────────┐
│   Playwright    │ ◄──────────────► │  Chrome Extension│
│   Python/Node   │   WebSocket      │  (Embedded CDP)  │
└─────────────────┘                  └──────────────────┘
```

The embedded CDP server:
- Built directly into the Chrome extension
- Implements Chrome DevTools Protocol that Playwright expects
- No external bridge server required
- Manages sessions and provides browser discovery endpoints

## Comparison with Playwright

| Feature | Standard Playwright | BROP + Playwright |
|---------|---------------------|-------------------|
| **Installation** | External binary + Python package | Chrome extension only |
| **Browser Support** | Chrome, Firefox, Safari, Edge | Chrome only (via extension) |
| **Deployment** | Requires browser installation | Uses existing Chrome instance |
| **Permissions** | Full system access | Browser sandbox only |
| **Performance** | Direct browser control | Extension API overhead |
| **Use Cases** | Automated testing, scraping | Browser enhancement, existing tab automation |
| **API** | Full Playwright API | Most Playwright features supported |

## Limitations

- Chrome extension permissions and security model
- Limited to Chrome/Chromium browsers
- Some actions may be slower than direct browser automation
- Cannot access chrome:// internal pages (security restriction)

## Security Notes

- The extension requests broad permissions for full functionality
- All communication uses Chrome's secure runtime messaging
- No external server dependencies or network exposure
- Runs within Chrome's security sandbox

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with the Python client
5. Submit a pull request

## Development & Debugging

For detailed instructions on running and debugging the extension, see:
- **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** - Complete setup, debugging, and troubleshooting guide
- **[EMBEDDED_SETUP.md](EMBEDDED_SETUP.md)** - Embedded version setup instructions

### Quick Debug Commands

**Extension Console (chrome://extensions/ → BROP → Inspect views):**
```javascript
// Check service status
embeddedBropServer.enabled

// View recent logs  
embeddedBropServer.getRecentLogs(10)

// Check active sessions
embeddedBropServer.sessions.size
```

**Page Console (F12 on any webpage):**
```javascript
// Test content script
window.BROP.getConsoleLogs()

// Test injected script
window.BROP_API.executeInPageContext("document.title")
```

**Python Client Debug:**
```python
import logging
logging.basicConfig(level=logging.DEBUG)

# From python-client directory
from client_example import BROPClient
client = BROPClient()
await client.connect()
```

## Plugin UI Features

The extension popup now includes:

### 🎛️ **Service Control**
- **Toggle Switch** - Enable/disable BROP service
- **Real-time Status** - Active/inactive indicator
- **Performance Stats** - Call count and active sessions

### 📊 **Call Logs Viewer**
- **Real-time Monitoring** - See all API calls as they happen
- **Advanced Filtering** - Filter by type (CDP/BROP/SYSTEM), status, or search
- **Export Logs** - Download call history as JSON
- **Performance Metrics** - Execution duration for each call

### ⚙️ **Settings & Status**
- **Connection Methods** - Status of Runtime/Native/CDP interfaces
- **Storage Management** - Clear logs and reset settings
- **Debug Information** - Extension health and capabilities

## Quick Start

1. **Load the extension** in Chrome developer mode
2. **Open the popup** and verify service is active
3. **Test connection** using the "Test Connection" button
4. **Monitor activity** in the "Call Logs" tab
5. **Run automation** with Python tools in `python-client/` directory

## Roadmap

- [ ] Authentication and security improvements
- [ ] Firefox extension support  
- [ ] Additional automation commands
- [ ] Performance optimizations
- [ ] TypeScript conversion
- [ ] npm package for client library