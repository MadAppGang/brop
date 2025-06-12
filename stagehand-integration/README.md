# BROP + Stagehand Integration

This package provides seamless integration between [BROP (Browser Remote Operations Protocol)](../README.md) and [Stagehand](https://docs.stagehand.dev), enabling AI-powered browser automation using the BROP Chrome extension as the backend.

## 🌟 Features

- **AI-Powered Actions**: Use natural language to interact with web pages
- **Smart Element Detection**: Leverage BROP's simplified DOM for better element targeting
- **Enhanced Observation**: Get structured insights about page content and interactive elements
- **Flexible Data Extraction**: Extract structured data using AI and simplified DOM
- **Playwright Compatibility**: Full compatibility with Playwright APIs
- **Chrome Extension Backend**: Use existing Chrome sessions through BROP extension

## 🚀 Quick Start

### Prerequisites

1. **BROP Extension**: Load the BROP extension in Chrome
2. **BROP Bridge Server**: Start the bridge server
   ```bash
   cd bridge-server
   node bridge_server.js
   ```
3. **Dependencies**: Install required packages
   ```bash
   npm install playwright @browserbasehq/stagehand
   ```

### Basic Usage

```javascript
const { createStagehand } = require('@brop/stagehand-integration');

async function example() {
    // Create Stagehand instance with BROP backend
    const stagehand = await createStagehand({
        verbose: true,
        enableAIActions: true,
        enableSmartSelectors: true
    });
    
    // Navigate to a page
    await stagehand.page.goto('https://github.com');
    
    // Use AI-powered actions
    await stagehand.page.act('click the search box');
    await stagehand.page.act('type "playwright" in the search box');
    await stagehand.page.act('press Enter');
    
    // Extract data
    const results = await stagehand.page.extract({
        repositories: 'repository names',
        descriptions: 'repository descriptions'
    });
    
    console.log('Search results:', results);
    
    // Cleanup
    await stagehand.adapter.close();
}
```

## 📖 API Reference

### Main Functions

#### `createStagehand(options)`

Creates a Stagehand instance with BROP integration.

**Parameters:**
- `options.cdpUrl` (string): BROP CDP server URL (default: `ws://localhost:9222`)
- `options.bropUrl` (string): BROP native server URL (default: `ws://localhost:9223`)
- `options.enableAIActions` (boolean): Enable AI-powered actions (default: `true`)
- `options.enableSmartSelectors` (boolean): Enable smart element selection (default: `true`)
- `options.fallbackToPlaywright` (boolean): Fallback to standard Playwright (default: `true`)
- `options.verbose` (boolean): Enable verbose logging (default: `false`)

**Returns:** Promise that resolves to a Stagehand instance with enhanced BROP capabilities.

#### `checkBROPAvailability(options)`

Checks if BROP services are available and running.

**Returns:** Promise that resolves to availability status object.

### Enhanced Page Methods

The page object returned by `createStagehand()` includes all standard Playwright page methods plus:

#### `page.act(instruction, options)`

Perform AI-powered actions using natural language.

```javascript
await page.act('click the login button');
await page.act('type "hello@example.com" in the email field');
await page.act('select "United States" from the country dropdown');
```

#### `page.observe(instruction, options)`

Observe and analyze page elements before taking actions.

```javascript
const observation = await page.observe('find all navigation links');
console.log(observation.relevant_elements);
console.log(observation.suggestions);
```

#### `page.extract(schema, options)`

Extract structured data from the page.

```javascript
const data = await page.extract({
    title: 'page title',
    links: 'all navigation links',
    price: 'product price'
});
```

#### `page.getSimplifiedDOM(options)`

Get BROP's simplified DOM representation optimized for AI interaction.

```javascript
const dom = await page.getSimplifiedDOM({
    max_depth: 3,
    include_hidden: false,
    include_coordinates: true
});

console.log(`Found ${dom.total_interactive_elements} interactive elements`);
console.log(`Page structure: ${dom.page_structure_summary}`);
```

#### `page.findElementSmart(description, options)`

Find elements using AI-powered smart selection.

```javascript
const element = await page.findElementSmart('search button');
if (element && element.confidence > 0.7) {
    await element.element.click();
}
```

#### `page.checkBROPStatus()`

Check the status of BROP extension and content script.

```javascript
const status = await page.checkBROPStatus();
console.log('BROP available:', status.hasContentScript);
```

## 🛠️ Advanced Usage

### Custom Provider

```javascript
const { BROPStagehandProvider } = require('@brop/stagehand-integration');

const provider = new BROPStagehandProvider({
    cdpUrl: 'ws://localhost:9222',
    timeout: 30000,
    viewport: { width: 1920, height: 1080 }
});

await provider.connect();
const page = provider.getPage();

// Use enhanced BROP methods
const dom = await provider.getSimplifiedDOM();
const element = await provider.findElementSmart('submit button');
```

### Stagehand Adapter

```javascript
const { StagehandBROPAdapter } = require('@brop/stagehand-integration');

const adapter = new StagehandBROPAdapter({
    verbose: true,
    enableAIActions: true,
    fallbackToPlaywright: true
});

const connection = await adapter.init();
const enhancedPage = adapter.enhancePage(connection.page);

// Use enhanced page with BROP capabilities
await enhancedPage.act('navigate to the homepage');
```

## 📝 Examples

### Example 1: Wikipedia Search

```javascript
const { createStagehand } = require('@brop/stagehand-integration');

async function wikipediaSearch() {
    const stagehand = await createStagehand({ verbose: true });
    
    await stagehand.page.goto('https://en.wikipedia.org');
    
    // Observe search functionality
    const observation = await stagehand.page.observe('find the search box');
    console.log('Found search elements:', observation.relevant_elements.length);
    
    // Perform search
    await stagehand.page.act('click the search box');
    await stagehand.page.act('type "Artificial Intelligence"');
    await stagehand.page.act('press Enter');
    
    // Extract article info
    const article = await stagehand.page.extract({
        title: 'article title',
        summary: 'first paragraph',
        categories: 'article categories'
    });
    
    console.log('Article:', article);
    await stagehand.adapter.close();
}
```

### Example 2: E-commerce Interaction

```javascript
async function ecommerceDemo() {
    const stagehand = await createStagehand({ verbose: true });
    
    await stagehand.page.goto('https://example-shop.com');
    
    // Smart product search
    const searchBox = await stagehand.page.findElementSmart('product search');
    if (searchBox) {
        await stagehand.page.act('search for "wireless headphones"');
    }
    
    // Extract product information
    const products = await stagehand.page.extract({
        names: 'product names',
        prices: 'product prices',
        ratings: 'product ratings'
    });
    
    // Add to cart using AI
    await stagehand.page.act('add the first product to cart');
    
    await stagehand.adapter.close();
}
```

### Example 3: Form Automation

```javascript
async function formAutomation() {
    const stagehand = await createStagehand({ verbose: true });
    
    await stagehand.page.goto('https://forms.example.com/contact');
    
    // Fill form using natural language
    await stagehand.page.act('fill "John Doe" in the name field');
    await stagehand.page.act('enter "john@example.com" as email');
    await stagehand.page.act('select "General Inquiry" from dropdown');
    await stagehand.page.act('type "Hello, this is a test message" in message area');
    
    // Submit form
    await stagehand.page.act('click the submit button');
    
    // Verify submission
    const confirmation = await stagehand.page.extract({
        message: 'confirmation message',
        status: 'submission status'
    });
    
    console.log('Form submitted:', confirmation);
    await stagehand.adapter.close();
}
```

## 🔧 Configuration

### BROP Connection Options

```javascript
const stagehand = await createStagehand({
    // Connection settings
    cdpUrl: 'ws://localhost:9222',      // BROP CDP server
    bropUrl: 'ws://localhost:9223',     // BROP native server
    timeout: 30000,                     // Connection timeout
    
    // Feature toggles
    enableAIActions: true,              // Use AI for actions
    enableSmartSelectors: true,         // Use smart element finding
    fallbackToPlaywright: true,         // Fallback to standard Playwright
    
    // Browser settings
    viewport: { width: 1280, height: 720 },
    userAgent: 'Stagehand/BROP 1.0',
    
    // Logging
    verbose: true                       // Enable detailed logging
});
```

### Simplified DOM Options

```javascript
const dom = await page.getSimplifiedDOM({
    max_depth: 5,                       // Maximum DOM traversal depth
    include_hidden: false,              // Include hidden elements
    include_text_nodes: true,           // Include text content
    include_coordinates: true,          // Include element positions
    focus_selectors: ['main', '.content'] // Focus on specific areas
});
```

## 🚦 Error Handling

```javascript
const { createStagehand, checkBROPAvailability } = require('@brop/stagehand-integration');

async function robustExample() {
    try {
        // Check BROP availability first
        const availability = await checkBROPAvailability();
        if (!availability.available) {
            throw new Error(`BROP not available: ${availability.error}`);
        }
        
        const stagehand = await createStagehand({ verbose: true });
        
        // Check extension status
        const status = await stagehand.page.checkBROPStatus();
        if (!status.hasContentScript) {
            console.warn('BROP content script not available - limited functionality');
        }
        
        // Your automation code here
        await stagehand.page.goto('https://example.com');
        
    } catch (error) {
        console.error('Automation failed:', error.message);
        
        // Handle specific error types
        if (error.message.includes('CDP connection')) {
            console.error('💡 Start BROP bridge server: node bridge_server.js');
        } else if (error.message.includes('content script')) {
            console.error('💡 Reload BROP extension in Chrome');
        }
    } finally {
        if (stagehand) {
            await stagehand.adapter.close();
        }
    }
}
```

## 🧪 Testing

Run the included examples to test your setup:

```bash
# Basic functionality test
npm test

# Run interactive demo
npm run demo

# Development example
npm run dev
```

## 🔍 Troubleshooting

### Common Issues

1. **"BROP not available"**
   - Ensure BROP bridge server is running: `node bridge_server.js`
   - Check that Chrome has BROP extension loaded
   - Verify ports 9222-9225 are not blocked

2. **"Content script not detected"**
   - Reload the BROP extension in Chrome
   - Navigate to a webpage to activate content script
   - Check browser console for extension errors

3. **"Connection timeout"**
   - Increase timeout in configuration
   - Check network connectivity to localhost
   - Ensure no firewall is blocking connections

4. **"Action failed"**
   - Enable verbose logging to see detailed errors
   - Try using fallback Playwright actions
   - Check if element selectors are valid

### Debug Mode

Enable verbose logging for detailed troubleshooting:

```javascript
const stagehand = await createStagehand({ 
    verbose: true,
    fallbackToPlaywright: true 
});

// Check detailed status
const status = await stagehand.page.checkBROPStatus();
console.log('Debug status:', status);

// Get simplified DOM for inspection
const dom = await stagehand.page.getSimplifiedDOM();
console.log('Page structure:', dom);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Related Projects

- [BROP Extension](../README.md) - Main BROP browser extension
- [Stagehand](https://docs.stagehand.dev) - AI browser automation framework
- [Playwright](https://playwright.dev) - Browser automation library

## 💬 Support

- **Issues**: Report bugs and feature requests in the main BROP repository
- **Documentation**: Full API documentation at [docs.brop.dev](https://docs.brop.dev)
- **Community**: Join discussions in GitHub Issues