# BROP Extension - Quick Test Guide

Great! The extension is now loading without errors. Let's verify everything works properly.

## ✅ Step 1: Verify Extension Status

1. **Check extension popup:**
   - Click the BROP icon in Chrome toolbar
   - Should show "Service Active" with green indicator
   - Toggle switch should be in the "on" position

2. **Check background script console:**
   - Go to `chrome://extensions/`
   - Find BROP extension → Click "Inspect views: background page"
   - Console should show: `BROP Extension with embedded CDP server loaded`
   - Type: `embeddedBropServer.enabled` → should return `true`

## ✅ Step 2: Test Basic Functionality

### Test via Extension Popup
1. **Open popup** → Go to "Overview" tab
2. **Click "Test Connection"** button
3. **Should show "Success!"** briefly
4. **Go to "Call Logs" tab** → Should see the test call logged

### Test via Browser Console
1. **Open any webpage** (e.g., google.com)
2. **Open DevTools** (F12) → Console tab
3. **Run test command:**
```javascript
chrome.runtime.sendMessage('YOUR_EXTENSION_ID', {
  type: 'BROP_COMMAND',
  command: {
    type: 'execute_console',
    params: { code: 'document.title' }
  },
  id: '123'
}, response => console.log('BROP Response:', response));
```

*Replace YOUR_EXTENSION_ID with actual extension ID from chrome://extensions/*

## ✅ Step 3: Test Python Client

1. **Open terminal** in the mcp-brop directory
2. **Run basic test:**
```bash
python -c "
import asyncio
import json

async def test():
    print('Testing BROP Python client...')
    # For now, just test that imports work
    try:
        from client_example import BROPClient
        print('✅ BROPClient imported successfully')
        print('📝 Note: Full connection test requires WebSocket setup')
    except Exception as e:
        print(f'❌ Import error: {e}')

asyncio.run(test())
"
```

## ✅ Step 4: Check Extension UI Features

### Service Control
1. **Open popup** → Toggle the service switch
2. **Should see status change** from "Service Active" to "Service Disabled"
3. **Toggle back on**

### Logs Viewer
1. **Go to "Call Logs" tab**
2. **Make some test calls** (using Test Connection button)
3. **Verify logs appear** with timestamps and details
4. **Test filters** - try filtering by type or searching

### Settings Tab
1. **Go to "Settings" tab**
2. **Check service status** shows current state
3. **Verify connection methods** status

## 🔧 Expected Results

### ✅ Working Indicators:
- Extension loads without console errors
- Popup opens and shows correct status
- Service toggle works
- Test connection succeeds
- Logs are captured and displayed
- Background script console shows server loaded

### ❌ If Issues Found:

**Extension popup shows "Service Disabled":**
- Click the toggle switch to enable
- Check background script console for errors

**Test Connection fails:**
- Check if active tab exists (open any webpage)
- Verify extension has permission for current tab
- Check background script console for error details

**Python client import fails:**
- Install dependencies: `pip install websockets aiohttp`
- Check that files exist in directory

**No logs appearing:**
- Try refreshing the popup
- Check if service is enabled
- Make sure to use the Test Connection button first

## 🎯 Next Steps

Once basic functionality is verified:

1. **Test with real automation:**
```bash
python client_example.py
```

2. **Try Playwright integration:**
```bash
python playwright_embedded_example.py
```

3. **Explore advanced features:**
   - Element interaction
   - Screenshot capture
   - Page navigation
   - Console execution

## 🐛 Debugging Commands

If you encounter issues, use these debugging commands:

**In background script console:**
```javascript
// Check server status
embeddedBropServer.enabled

// View recent logs
embeddedBropServer.getRecentLogs(5)

// Check active sessions
embeddedBropServer.sessions.size

// Test internal method
embeddedBropServer.logCall('TEST', 'debug_test', {}, { result: 'ok' })
```

**In page console:**
```javascript
// Test content script
window.BROP?.getConsoleLogs()

// Test message to background
chrome.runtime.sendMessage({type: 'GET_STATUS'}, console.log)
```

The extension should now be fully functional! 🚀