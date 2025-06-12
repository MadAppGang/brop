# BROP Python Client

This directory contains Python tools and examples for interacting with the BROP Chrome extension.

## 📁 Files Overview

### 🎭 **playwright_embedded_example.py** ⭐ (Recommended)
**Purpose**: Complete Playwright integration example with BROP extension

**What it does**:
- Demonstrates how to use Playwright with BROP's embedded CDP server
- Shows the same API as regular Playwright but connects to existing Chrome tabs
- Includes error handling and setup instructions
- Provides side-by-side comparison with standard Playwright

**Usage**:
```bash
# Install dependencies first
pip install playwright aiohttp

# Install Playwright browsers
playwright install chromium

# Run the example
python playwright_embedded_example.py
```

**Best for**: Most users who want browser automation with Playwright

---

### 🐍 **client_example.py**
**Purpose**: Demonstrates the BROP client API design and concepts

**What it does**:
- Shows the theoretical BROP Python client interface
- Provides API examples for navigation, screenshots, console execution
- Includes connection testing and helpful guidance
- Points users toward Playwright integration for actual usage

**Usage**:
```bash
pip install websockets aiohttp
python client_example.py
```

**Best for**: Understanding BROP API concepts and architecture

---


### 📦 **requirements.txt**
**Purpose**: Python dependencies for all client tools

**Contains**:
- `playwright>=1.40.0` - For browser automation
- `websockets>=11.0` - For WebSocket communication
- `aiohttp>=3.8.0` - For HTTP client functionality
- `pytest>=7.0.0` - For testing (optional)

**Usage**:
```bash
pip install -r requirements.txt
```

## 🚀 Quick Start Guide

### For Most Users (Playwright Integration)
```bash
# 1. Install dependencies
cd python-client
pip install -r requirements.txt
playwright install chromium

# 2. Load BROP extension in Chrome
# (Go to chrome://extensions/, enable developer mode, load unpacked)

# 3. Run Playwright example
python playwright_embedded_example.py
```

### For API Exploration
```bash
# 1. Install basic dependencies
pip install websockets aiohttp

# 2. Load BROP extension in Chrome

# 3. Run client example
python client_example.py
```


## 🎯 Which File Should I Use?

### **🎭 Use playwright_embedded_example.py if:**
- ✅ You want to automate an existing Chrome browser
- ✅ You prefer the standard Playwright API
- ✅ You want the most features and reliability
- ✅ You're doing testing, scraping, or automation

### **🐍 Use client_example.py if:**
- ✅ You want to understand the BROP API design
- ✅ You're building custom integrations
- ✅ You need to see the underlying protocol
- ✅ You're exploring the architecture


## 🔧 Prerequisites

### Required
- **Chrome browser** with BROP extension loaded
- **Python 3.7+**
- **Active Chrome tab** (for testing)

### For Playwright Integration
- `pip install playwright aiohttp`
- `playwright install chromium`

## 💡 Tips & Troubleshooting

### **Playwright Connection Issues**
```bash
# Check extension status
# 1. Open BROP popup in Chrome
# 2. Verify "Service Active" status
# 3. Try "Test Connection" button

# Common solutions
# - Make sure extension is loaded
# - Open a regular webpage (not chrome://)
# - Check for port conflicts
```

### **Client Example Limitations**
```bash
# The client_example.py shows API concepts but needs setup for full functionality
# For actual browser automation, use playwright_embedded_example.py instead
```


## 🔗 Integration Examples

### Using with pytest
```python
import pytest
from playwright.async_api import async_playwright

@pytest.mark.asyncio
async def test_page_title():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
        page = browser.contexts[0].pages[0]
        await page.goto("https://example.com")
        title = await page.title()
        assert "Example" in title
        await browser.close()
```

### Using with asyncio
```python
import asyncio
from playwright.async_api import async_playwright

async def automate_task():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
        page = browser.contexts[0].pages[0]
        
        # Your automation code here
        await page.goto("https://example.com")
        title = await page.title()
        print(f"Page title: {title}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(automate_task())
```

## 📚 Related Documentation

- **[Main README](../README.md)** - Extension overview and installation
- **[DEVELOPMENT_GUIDE](../DEVELOPMENT_GUIDE.md)** - Development and debugging
- **[EMBEDDED_SETUP](../EMBEDDED_SETUP.md)** - Embedded version setup
- **[Playwright Documentation](https://playwright.dev/)** - Official Playwright docs

## 🤝 Contributing

When contributing to the Python client:

1. **Test with the extension loaded** in Chrome
2. **Update requirements.txt** if adding dependencies
3. **Add examples** for new functionality
4. **Update this README** with new files or changes
5. **Follow Python best practices** and type hints

## 🆘 Support

If you encounter issues:

1. **Check extension status** - Make sure BROP is loaded and active
2. **Try Playwright first** - It has the most complete implementation
3. **Check logs** - Use the extension popup logs viewer
4. **Review examples** - Start with working examples and modify them
5. **Open an issue** - Include error messages and setup details