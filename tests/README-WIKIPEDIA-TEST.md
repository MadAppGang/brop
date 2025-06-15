# Wikipedia Text Extraction Tests

This directory contains Playwright-based tests that demonstrate text extraction from Wikipedia using the BROP (Browser Remote Operations Protocol) system.

## Available Tests

### 1. Simple Wikipedia Test (`simple-wikipedia-test.js`)

A straightforward test that demonstrates basic text extraction capabilities:

**Features:**
- ✅ Launches a Playwright browser
- ✅ Navigates to Wikipedia main page
- ✅ Extracts page title and main heading
- ✅ Extracts first paragraph content
- ✅ Finds featured article section
- ✅ Extracts navigation links
- ✅ Performs DOM queries and statistics
- ✅ Takes a screenshot

**Usage:**
```bash
# Run the simple test
pnpm test:wikipedia:simple

# Or directly
cd tests && node simple-wikipedia-test.js
```

### 2. Comprehensive Wikipedia Test (`playwright-wikipedia-test.js`)

A full-featured test suite with BROP bridge integration:

**Features:**
- ✅ Playwright browser automation
- ✅ BROP bridge CDP connection (optional)
- ✅ Multiple extraction strategies
- ✅ Structured test result reporting
- ✅ Error handling and recovery
- ✅ Performance timing
- ✅ Bridge vs Direct comparison

**Test Cases:**
1. **Navigate to Wikipedia** - Loads the main page
2. **Extract Page Title** - Gets page metadata
3. **Extract Main Content** - Finds article paragraphs
4. **Extract Featured Article** - Locates today's featured content
5. **Extract Navigation Links** - Collects site navigation

**Usage:**
```bash
# Run the comprehensive test
pnpm test:wikipedia

# Or directly
cd tests && node playwright-wikipedia-test.js
```

### 3. Integration with Test Runner

The Wikipedia tests are integrated into the main test runner:

```bash
# Run just Wikipedia tests via test runner
cd tests && ./run-tests.sh wikipedia

# Run all tests including Wikipedia
cd tests && ./run-tests.sh all
```

## What Gets Extracted

### Page Metadata
- Page title
- Main heading (H1)
- URL information

### Content Sections
- **Main Content**: First few paragraphs of articles
- **Featured Article**: Today's featured content section
- **Navigation**: Site navigation links

### DOM Statistics
- Count of paragraphs, links, images, headings
- Content length measurements
- Element accessibility checks

### Visual Output
- Screenshot capture (`wikipedia-test-screenshot.png`)
- Console logging with emojis for easy reading

## Example Output

```
🌍 Simple Wikipedia Text Extraction Test
==================================================
🚀 Launching browser...
📍 Navigating to Wikipedia...
📖 Extracting page information...
   Title: Wikipedia, the free encyclopedia
   Main Heading: Main Page
   First Paragraph: The Combat: Woman Pleading for the Vanquished is an oil painting...
🔍 Looking for featured content...
   Featured Article: The painting...
🔗 Extracting navigation links...
   Found 5 navigation links:
      - Main page
      - Contents
      - Current events
      - Random article
      - About Wikipedia
🧪 Testing DOM queries...
   Page Statistics:
      Paragraphs: 6
      Links: 363
      Images: 23
      Headings: 10
📸 Taking screenshot...
✅ Test completed successfully!
```

## Technical Details

### Dependencies
- **Playwright**: Browser automation
- **WebSocket**: BROP bridge communication
- **Node.js ES Modules**: Modern JavaScript

### Selectors Used
The tests use robust CSS selectors that work with Wikipedia's structure:

```javascript
// Main content
"#mw-content-text .mw-parser-output p"

// Featured article
"#mp-tfa"

// Navigation
"#p-navigation a"
```

### Error Handling
- Graceful fallback for missing elements
- Multiple selector strategies
- Optional bridge connection
- Comprehensive error reporting

### Performance
- Non-blocking operations
- Efficient DOM queries
- Minimal wait times
- Resource cleanup

## Configuration

### Browser Settings
```javascript
browser = await chromium.launch({
    headless: false, // Set to true for headless mode
    args: [
        "--remote-debugging-port=9222", // CDP integration
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor"
    ]
});
```

### Timeouts
- Page load: 30 seconds
- Bridge connection: 2 seconds  
- Command execution: 5 seconds

## Extending the Tests

### Adding New Extraction Types

1. **Add a new test case:**
```javascript
{
    name: "Extract Custom Content",
    action: "extract_custom"
}
```

2. **Implement the extraction method:**
```javascript
async extractCustom() {
    const content = await this.page.textContent("your-selector");
    return {
        content: content,
        preview: content.substring(0, 100)
    };
}
```

### Testing Different Pages

Modify the URL in the test configuration:
```javascript
{
    name: "Navigate to Custom Page",
    url: "https://en.wikipedia.org/wiki/Your_Article",
    action: "navigate"
}
```

## Troubleshooting

### Common Issues

1. **Browser won't launch:**
   - Ensure Playwright browsers are installed: `npx playwright install`
   - Check system dependencies

2. **Bridge connection fails:**
   - Start the bridge server: `pnpm run bridge`
   - Tests will continue without bridge (graceful degradation)

3. **Selectors not found:**
   - Wikipedia occasionally changes their layout
   - Tests use multiple fallback selectors

4. **Permissions errors:**
   - Ensure write permissions for screenshot output
   - Check file system access

### Debug Mode

Enable verbose logging by modifying the test files:
```javascript
// Add debug logging
console.log("Debug:", await page.content());
```

## Integration Examples

### Use with BROP MCP Server
```bash
# Start the MCP server
pnpm run mcp

# Run tests with bridge integration
pnpm test:wikipedia
```

### Use with Custom Bridge
```javascript
// Connect to custom bridge endpoint
this.bridgeWS = new WebSocket("ws://localhost:9222/devtools/browser/custom-endpoint");
```

## Best Practices

1. **Always include cleanup:** Ensure browser instances are closed
2. **Use error handling:** Wrap operations in try-catch blocks
3. **Test selectors:** Verify CSS selectors work across Wikipedia updates
4. **Performance monitoring:** Track extraction times
5. **Screenshot evidence:** Capture visual proof of test execution

This test suite demonstrates practical web scraping and text extraction techniques that can be adapted for other websites and use cases.