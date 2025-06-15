# BROP Architecture

## Overview
Unified bridge server architecture with clean protocol separation and no external Chrome dependency.

## Core Components

### 1. `main_background.js` (Main Extension Background)
- **Role**: Clean delegation layer and protocol router
- **Responsibilities**:
  - Bridge connection management
  - Message routing between BROP and CDP protocols
  - Popup message handling
  - Extension status management
- **Does NOT**: Handle protocol-specific logic

### 2. `bridge/bridge_server.js` (Unified Bridge Server)
- **Role**: Single server handling both BROP and CDP protocols
- **Responsibilities**:
  - BROP client multiplexing (port 9225)
  - CDP client compatibility (port 9222) 
  - Extension connection management (port 9224)
  - HTTP discovery endpoints
  - Session management for CDP Target.* commands
  - Message routing and response multiplexing
- **Key Features**:
  - No external Chrome dependency
  - Clean protocol separation
  - Playwright/Puppeteer compatibility
  - Real-time logging and debugging

### 3. Protocol Handlers (within Extension)
- **BROP Handler**: Processes native BROP commands using Chrome Extension APIs
- **CDP Handler**: Processes CDP commands via chrome.debugger API
- **Message Router**: Routes commands based on protocol type

## Message Flow

```
BROP Client → Port 9225 → Unified Bridge → Extension → Chrome APIs
                             │
CDP Client  → Port 9222 ──────┘
(Playwright)
```

**Detailed Flow:**

```
External Client → Bridge Server → main_background.js
                                       ↓
                               ┌─────────────────┐
                               │ Protocol Router │
                               └─────────────────┘
                                 ↓           ↓
                         ┌──────────────┐  ┌──────────────┐
                         │ BROP Command │  │ CDP Command  │
                         │      ↓       │  │      ↓       │
                         │ Chrome APIs  │  │ chrome.debug │
                         │ (tabs, etc.) │  │ ger API      │
                         └──────────────┘  └──────────────┘
```

## Unified Architecture Benefits

- **🎯 Single Server**: One bridge server handles all protocols
- **📦 No External Dependencies**: Everything routes through extension APIs
- **🧹 Clean Separation**: BROP and CDP protocols handled separately
- **🔧 Maintainability**: Unified codebase with modular design
- **🧪 Testability**: Each protocol can be tested independently
- **⚡ Performance**: Direct extension API usage without external Chrome

## Port Allocation

- **9222**: CDP compatibility (Playwright/Puppeteer clients)
- **9224**: Extension connection (single WebSocket)
- **9225**: BROP native clients (multiplexed connections)

## Protocol Routing

### BROP Commands (Port 9225)
- Multiplexed client connections
- Native Chrome Extension API usage
- Direct tab/DOM manipulation
- Content extraction and automation

### CDP Commands (Port 9222) 
- Playwright/Puppeteer compatibility
- Target and session management
- Forwarded via chrome.debugger API
- HTTP discovery endpoints

## Testing

- `pnpm run test:bridge` - Test unified bridge server
- `pnpm run test:brop` - Test BROP protocol specifically  
- `pnpm run test:cdp` - Test CDP functionality
- `pnpm run test:quick` - Quick CDP validation

## Key Improvements

1. **Simplified Architecture**: Single server instead of multiple specialized servers
2. **No Real Chrome Dependency**: Everything uses extension APIs
3. **Better Resource Usage**: One server process instead of multiple
4. **Cleaner Code**: Unified logging, error handling, and configuration
5. **Easier Deployment**: Single bridge server startup
6. **Better Debugging**: Centralized logging and monitoring

## Components Map

```
bridge/
├── bridge_server.js     # Unified bridge server (BROP + CDP)
├── mcp-server.js        # MCP protocol server
└── (legacy files removed)

Extension Files:
├── main_background.js   # Protocol router and extension logic
├── content.js          # Page content interaction
├── popup.html/js       # Extension UI
└── manifest.json       # Extension configuration
```

This architecture provides a clean, maintainable, and efficient system for browser automation through Chrome extensions while maintaining compatibility with existing tools like Playwright and Puppeteer.