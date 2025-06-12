# Native BROP Stagehand Implementation

A pure BROP implementation of the Stagehand interface that provides AI-powered browser automation without Playwright dependencies.

## Overview

This implementation provides all the core Stagehand functionality using native BROP calls:

- ✅ **Navigation** (`stagehand_navigate`) - Navigate to any URL
- ✅ **Actions** (`stagehand_act`) - Perform actions with AI guidance  
- ✅ **Extraction** (`stagehand_extract`) - Extract structured data from pages
- ✅ **Observation** (`stagehand_observe`) - Find actionable elements with AI
- ✅ **Screenshots** - Capture page screenshots
- ✅ **Console Logs** - Access browser console output

## Key Advantages

- 🚫 **No Playwright dependency** - Pure BROP implementation
- 🤖 **AI-powered** - Uses Anthropic Claude for intelligent automation
- 🔧 **BROP-native** - Leverages BROP's simplified DOM analysis
- ⚡ **Lightweight** - Minimal dependencies and faster startup
- 🎯 **Stagehand-compatible** - Drop-in replacement for Stagehand API

## Installation

```bash
cd brop-stagehand-native
npm install
```

## Configuration

Create a `.env` file in the parent directory:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## Quick Start

```javascript
const { BROPStagehand } = require('./brop-stagehand-native');

async function example() {
    const stagehand = new BROPStagehand({
        verbose: true,
        apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    await stagehand.init();
    
    // Navigate to a page
    await stagehand.navigate('https://example.com');
    
    // Observe actionable elements
    const elements = await stagehand.observe('Find all clickable links');
    
    // Extract structured data
    const data = await stagehand.extract('Get page title and description', {
        type: "object",
        properties: {
            title: { type: "string" },
            description: { type: "string" }
        }
    });
    
    // Perform actions
    await stagehand.act('Click the first link on the page');
    
    // Take screenshot
    await stagehand.screenshot('page_capture');
    
    await stagehand.close();
}
```

## API Reference

### BROPStagehand Class

#### Constructor Options

```javascript
new BROPStagehand({
    bropUrl: 'ws://localhost:9223',      // BROP WebSocket URL
    cdpUrl: 'ws://localhost:9222',       // CDP endpoint URL  
    apiKey: 'your_anthropic_key',        // Anthropic API key
    model: 'claude-3-sonnet-20240229',   // AI model to use
    verbose: false                       // Enable debug logging
})
```

#### Methods

##### `await stagehand.init()`
Initialize connection to BROP bridge.

##### `await stagehand.navigate(url)`
Navigate to a URL.
- `url` (string): Target URL

##### `await stagehand.observe(instruction)`
Find actionable elements using AI.
- `instruction` (string): Description of elements to find
- Returns: Array of element descriptions

##### `await stagehand.act(actionDescription, variables)`
Perform an action using AI guidance.
- `actionDescription` (string): Natural language action description
- `variables` (object): Optional variables for templating
- Returns: Action result object

##### `await stagehand.extract(instruction, schema)`
Extract structured data from the page.
- `instruction` (string): What data to extract
- `schema` (object): JSON schema for extracted data
- Returns: Extracted data object

##### `await stagehand.screenshot(name)`
Capture a screenshot.
- `name` (string): Screenshot name
- Returns: Screenshot data object

##### `await stagehand.getConsoleLogs()`
Get browser console logs.
- Returns: Array of console log entries

##### `await stagehand.close()`
Close the connection and cleanup.

## Examples

### Run Examples

```bash
# Basic functionality test
npm test

# Wikipedia navigation example
npm run example:wikipedia

# Form interaction example  
npm run example:forms
```

### Example Files

- `examples/example-wikipedia-navigation.js` - Multi-page navigation and data extraction
- `examples/example-form-interaction.js` - Form filling and validation
- `tests/test-brop-stagehand-native.js` - Comprehensive functionality test

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│  BROP Stagehand │ -> │ BROP Bridge  │ -> │ Chrome + BROP   │
│     (AI)        │    │   Server     │    │   Extension     │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │                   │
         │                       │                   │
    AI Analysis              WebSocket            Content
    & Decision              Communication          Script
    Making                                         & DOM
```

## Comparison with Standard Stagehand

| Feature | Standard Stagehand | BROP Stagehand Native |
|---------|-------------------|----------------------|
| Browser Backend | Playwright | Native BROP |
| Dependencies | Heavy (Playwright + drivers) | Light (WebSocket + AI) |
| Setup Complexity | High | Low |
| AI Integration | Built-in | Anthropic Claude |
| DOM Analysis | Standard | BROP Simplified DOM |
| Performance | Good | Faster startup |
| Compatibility | Full Playwright | BROP-specific |

## Troubleshooting

### Connection Issues
1. Ensure BROP bridge server is running: `cd ../bridge-server && node bridge_server.js`
2. Verify Chrome has BROP extension loaded and active
3. Check WebSocket connections are available on ports 9222-9223

### AI Issues
1. Verify `ANTHROPIC_API_KEY` is set in `.env` file
2. Check API key has correct permissions
3. Ensure internet connectivity for AI API calls

### Performance Issues
1. Reduce verbosity: `verbose: false`
2. Limit DOM analysis depth in complex pages
3. Use specific selectors when possible

## Contributing

1. Follow existing code patterns
2. Add tests for new functionality
3. Update documentation
4. Test with multiple websites

## License

MIT - See LICENSE file for details.