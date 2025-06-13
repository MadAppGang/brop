# BROP Client Library Setup

## 📁 Structure

```
client/
├── index.js          # Main entry point, exports all classes
├── page.js           # Page class with automatic tab management
├── connection.js     # WebSocket connection utilities
├── package.json      # NPM package configuration
├── README.md         # Complete API documentation
└── example.js        # Usage examples and demos
```

## 🚀 Quick Start

### Import the Library

```javascript
// Import everything
const { createPage, createNamedBROPConnection } = require('./client');

// Or import specific components
const { Page } = require('./client/page');
const { createNamedBROPConnection } = require('./client/connection');
```

### Basic Usage

```javascript
const { createPage } = require('./client');

async function example() {
  // Create page with automatic tab management and event subscription
  const page = await createPage('https://example.com', 'my-app');
  
  // Get page content
  const content = await page.getContent();
  console.log('Title:', content.title);
  
  // Execute JavaScript
  const result = await page.executeConsole('document.title');
  
  // Automatic cleanup
  await page.close();
}
```

## ✨ Features

### Automatic Tab Management
- ✅ Creates browser tabs automatically
- ✅ Manages tab lifecycle (creation → usage → cleanup)
- ✅ Handles tab closure detection

### Event Subscription System
- ✅ Automatically subscribes to tab events on page creation
- ✅ Receives tab-specific events only (tab_closed, tab_updated, etc.)
- ✅ Updates page status based on external tab changes
- ✅ Automatically unsubscribes on page closure

### Error Handling
- ✅ Robust error handling with descriptive messages
- ✅ Automatic cleanup on errors
- ✅ Connection status tracking

### High-Level API
- ✅ Simple async/await interface
- ✅ Clean abstraction over WebSocket protocol
- ✅ Type-safe method signatures

## 🔧 Setup Requirements

1. **BROP Bridge Server**: Running on `ws://localhost:9223`
   ```bash
   pnpm run bridge
   ```

2. **Chrome Extension**: BROP extension loaded and connected

3. **Node.js Dependencies**: 
   ```bash
   npm install ws
   ```

## 📝 Migration Guide

If you have existing code using the old structure:

### Before
```javascript
const { createPage } = require('./page-utils');
const { createNamedBROPConnection } = require('./test-utils');
```

### After
```javascript
const { createPage, createNamedBROPConnection } = require('./client');
```

## 🧪 Testing

Run the example to verify everything works:

```bash
cd client
node example.js
```

This will test:
- ✅ Page creation and management
- ✅ Content extraction
- ✅ JavaScript execution
- ✅ Multiple page handling
- ✅ Low-level API access
- ✅ Automatic cleanup

## 📦 Publishing

The client library is structured as a proper NPM package and can be published:

```bash
cd client
npm publish
```

Or used locally:

```bash
npm pack
npm install ./brop-client-1.0.0.tgz
```

## 🎯 Architecture

```
Your Application
       │
       ▼
┌─────────────────┐
│  BROP Client    │ ← You are here
│  Library        │
└─────────────────┘
       │ WebSocket
       ▼
┌─────────────────┐
│  Bridge Server  │
│  (Node.js)      │
└─────────────────┘
       │ WebSocket
       ▼
┌─────────────────┐
│ Chrome Extension│
└─────────────────┘
       │
       ▼
┌─────────────────┐
│   Browser Tabs  │
└─────────────────┘
```

The client library provides the easiest way to interact with the BROP system, handling all the complexity of connection management, tab lifecycle, and event subscriptions automatically.