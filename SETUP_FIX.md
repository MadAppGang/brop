# BROP Extension - Setup Fix for Protocol Buffers Error

## The Error
```
protoc-gen-js: program not found or is not executable
--js_out: protoc-gen-js: Plugin failed with status code 1.
```

## Quick Fix: Simplified Setup (Recommended)

The BROP extension has been updated to work **without requiring Protocol Buffers compilation**. The current implementation uses JSON for message passing, which is simpler and doesn't require additional build tools.

### ✅ **No Build Required Setup:**

1. **Install minimal dependencies:**
```bash
cd /path/to/mcp-brop
npm install --production
```

2. **Load extension directly:**
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `mcp-brop` directory
   - ✅ **That's it!** No compilation needed.

3. **Test the extension:**
```bash
python client_example.py
```

## Alternative: Full Protocol Buffers Setup

If you want to use the full Protocol Buffers implementation:

### Option 1: Install protoc-gen-js

**On macOS:**
```bash
# Install Protocol Buffers compiler
brew install protobuf

# Install JavaScript plugin
npm install -g protobufjs-cli
# OR
brew install protoc-gen-js
```

**On Ubuntu/Debian:**
```bash
# Install protobuf compiler
sudo apt-get install protobuf-compiler

# Install Node.js plugin
npm install -g protobufjs-cli
```

**On Windows:**
```bash
# Install via Chocolatey
choco install protoc

# Install Node.js plugin  
npm install -g protobufjs-cli
```

### Option 2: Use protobufjs instead

**Update package.json to use protobufjs:**
```json
{
  "scripts": {
    "build:proto": "pbjs -t static-module -w es6 -o generated/browser_commands.js proto/browser_commands.proto"
  }
}
```

**Then run:**
```bash
npm install protobufjs-cli
npm run build:proto
```

## Current Working Implementation

The extension currently uses **JSON message passing** instead of Protocol Buffers:

```javascript
// Instead of protobuf serialization:
const message = {
  id: messageId,
  command: {
    type: commandType,
    params: params
  }
};
```

This approach:
- ✅ **Works immediately** without build tools
- ✅ **Easier to debug** (human-readable messages)
- ✅ **Smaller setup** (no protoc dependencies)
- ✅ **Cross-platform** compatibility
- ⚠️ **Slightly larger** message size (but negligible for this use case)

## File Structure (No Build Required)

```
mcp-brop/
├── manifest.json                    # ✅ Ready to use
├── background_embedded.js           # ✅ No compilation needed
├── content.js                       # ✅ Ready to use
├── popup.html                       # ✅ Ready to use  
├── popup_enhanced.js                # ✅ Ready to use
├── client_example.py                # ✅ Ready to use
├── playwright_embedded_example.py   # ✅ Ready to use
└── proto/                          # 📝 Documentation only
```

## Verification Steps

1. **Check extension loads:**
   - Go to `chrome://extensions/`
   - Verify BROP extension is loaded and enabled

2. **Test popup:**
   - Click BROP icon
   - Verify status shows "Service Active"
   - Try the "Test Connection" button

3. **Test Python client:**
```bash
python client_example.py
```

4. **Check logs:**
   - Open popup → "Call Logs" tab
   - Should see test calls if successful

## Troubleshooting

### If you still get protoc errors:

1. **Ignore them:** The extension works without Protocol Buffers
2. **Skip the build:** Just load the extension directly in Chrome
3. **Use npm run setup:** This will confirm everything is ready

### If extension doesn't load:

1. **Check file paths:** Ensure all files are in the correct location
2. **Check permissions:** Verify manifest.json permissions
3. **Check console:** Open `chrome://extensions/` → BROP → "Inspect views: background page"

### If Python client fails:

1. **Install dependencies:**
```bash
pip install websockets aiohttp
```

2. **Check extension is active:**
   - Popup should show "Service Active"
   - Try toggling the service switch

## Summary

🎯 **Recommended approach:** Skip Protocol Buffers compilation entirely. The extension works perfectly with JSON messages and requires no build process.

📦 **Quick start:**
```bash
cd mcp-brop
npm install --production     # Install minimal deps
# Load extension in Chrome
python client_example.py     # Test it works
```

The Protocol Buffers schema (`proto/browser_commands.proto`) remains as documentation for the message structure, but actual implementation uses simpler JSON serialization.