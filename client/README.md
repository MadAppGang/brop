# BROP Client Library

A JavaScript client library for interacting with the BROP (Browser Remote Operations Protocol) bridge service.

## Features

✅ **Automatic Tab Management**: Pages automatically create and manage browser tabs  
✅ **Event Subscription**: Automatic subscription to tab lifecycle events  
✅ **Error Handling**: Robust error handling with automatic cleanup  
✅ **Type Safety**: Clean async/await API with proper error propagation  
✅ **Event Isolation**: Each page only receives events for its specific tab  

## Quick Start

```javascript
const { createPage } = require('./client');

async function example() {
  // Create a page with automatic tab management
  const page = await createPage('https://example.com', 'my-test');
  
  // Get page content
  const content = await page.getContent();
  console.log('Title:', content.title);
  
  // Execute JavaScript
  const result = await page.executeConsole('document.title');
  console.log('Result:', result);
  
  // Automatic cleanup
  await page.close();
}
```

## API Reference

### Page Class

#### `createPage(url, connectionName)`

Creates a new page with automatic tab management and event subscription.

- `url` (string): The URL to navigate to (default: 'https://httpbin.org/html')
- `connectionName` (string): Unique name for this connection (default: 'page-test')

Returns: `Promise<Page>`

#### Page Methods

##### Content Extraction

```javascript
// Get page content with metadata
const content = await page.getContent({
  include_metadata: true  // Include title, URL, links, etc.
});

// Get console logs
const logs = await page.getConsoleLogs({
  limit: 10  // Number of logs to retrieve
});

// Get page screenshot
const screenshot = await page.getScreenshot({
  format: 'png'  // 'png' or 'jpeg'
});

// Get simplified DOM
const dom = await page.getSimplifiedDOM({
  max_depth: 3,
  include_hidden: false,
  include_text_nodes: true,
  include_coordinates: true
});
```

##### Navigation and Interaction

```javascript
// Navigate to a new URL
await page.navigate('https://google.com');

// Execute JavaScript code
const result = await page.executeConsole('document.querySelector("h1").textContent');

// Wait for page load
await page.waitForLoad(3000);  // 3 second timeout
```

##### Page Lifecycle

```javascript
// Check page status
console.log(page.isConnected());  // true/false
console.log(page.isDestroyed());   // true/false
console.log(page.getStatus());     // 'creating', 'connected', 'destroyed'

// Get tab information
console.log(page.getTabId());      // Browser tab ID
console.log(page.getUrl());        // Current URL

// Close page and cleanup
await page.close();
```

### Low-Level Connection API

#### `createNamedBROPConnection(name)`

Creates a WebSocket connection to the BROP bridge server with a specific name.

```javascript
const { createNamedBROPConnection } = require('./client');

const ws = createNamedBROPConnection('my-connection');
ws.on('open', () => {
  // Send raw BROP commands
  ws.send(JSON.stringify({
    id: 'test-1',
    method: 'list_tabs',
    params: {}
  }));
});
```

## Event System

The client automatically subscribes to tab lifecycle events:

- `tab_closed` - Tab was closed externally
- `tab_removed` - Tab was removed from browser
- `tab_updated` - Tab URL, title, or status changed
- `tab_activated` - Tab became the active tab

Pages automatically update their status when receiving relevant events.

## Error Handling

The library provides robust error handling:

```javascript
try {
  const page = await createPage('https://example.com');
  const content = await page.getContent();
} catch (error) {
  if (error.message.includes('Chrome extension not connected')) {
    console.log('Bridge server is running but Chrome extension is not loaded');
  } else if (error.message.includes('Tab was closed externally')) {
    console.log('Tab was closed by user or another process');
  }
}
```

## Connection Requirements

1. **BROP Bridge Server**: Must be running on `ws://localhost:9223`
2. **Chrome Extension**: BROP Chrome extension must be loaded and connected
3. **WebSocket Support**: Node.js environment with WebSocket support

## Examples

### Basic Page Automation

```javascript
const { createPage } = require('./client');

async function automateExample() {
  const page = await createPage('https://httpbin.org/html');
  
  // Get page information
  const content = await page.getContent();
  console.log(`Page title: ${content.title}`);
  console.log(`Page URL: ${content.url}`);
  
  // Execute some JavaScript
  const titleFromJS = await page.executeConsole('document.title');
  console.log(`Title from JS: ${titleFromJS.result}`);
  
  // Take a screenshot
  const screenshot = await page.getScreenshot();
  console.log(`Screenshot size: ${screenshot.imageData.length} bytes`);
  
  await page.close();
}
```

### Multiple Page Management

```javascript
const { createPage } = require('./client');

async function multiplePages() {
  const pages = await Promise.all([
    createPage('https://example.com', 'page-1'),
    createPage('https://httpbin.org/html', 'page-2'),
    createPage('https://google.com', 'page-3')
  ]);
  
  // Work with all pages
  for (const page of pages) {
    const content = await page.getContent();
    console.log(`${page.connectionName}: ${content.title}`);
  }
  
  // Clean up all pages
  await Promise.all(pages.map(page => page.close()));
}
```

### Event Monitoring

```javascript
const { createPage } = require('./client');

async function monitorEvents() {
  const page = await createPage('https://example.com', 'monitor-test');
  
  // Override event handler to log events
  const originalHandleEvent = page._handleEvent;
  page._handleEvent = function(event) {
    console.log(`Received event: ${event.event_type}`, event);
    return originalHandleEvent.call(this, event);
  };
  
  console.log('Page created, try closing the tab manually...');
  
  // Keep running until page is destroyed
  while (page.isConnected()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('Page was destroyed!');
}
```

## Architecture

```
┌─────────────────┐    WebSocket     ┌──────────────────┐    WebSocket    ┌─────────────────┐
│   BROP Client   │ ──────────────► │  Bridge Server   │ ◄─────────────── │ Chrome Extension│
│   (This Library)│                 │   (Node.js)      │                 │                 │
└─────────────────┘                 └──────────────────┘                 └─────────────────┘
                                           │
                                           ▼
                                    ┌──────────────────┐
                                    │   Tab Events     │
                                    │   Subscription   │
                                    │   Management     │
                                    └──────────────────┘
```

The client library provides a high-level abstraction over the BROP protocol, handling connection management, tab lifecycle, and event subscriptions automatically.