# BROP Architecture

## Overview
Clean modular architecture with separated protocol handling.

## Core Components

### 1. `main_background.js` (Main Extension Background)
- **Role**: Clean delegation layer
- **Responsibilities**:
  - Bridge connection management
  - Message routing to appropriate servers
  - Event forwarding
- **Does NOT**: Handle protocol-specific logic

### 2. `brop_server.js` (BROP Protocol Server)
- **Role**: Complete BROP command implementation
- **Responsibilities**:
  - All BROP commands (get_screenshot, navigate, list_tabs, etc.)
  - Chrome Extension API interactions
  - Error handling and logging
  - Settings management

### 3. `cdp_server.js` (CDP Protocol Server) 
- **Role**: CDP command forwarding to real Chrome
- **Responsibilities**:
  - Real Chrome connection management (port 9223)
  - CDP command forwarding and response routing
  - Event forwarding from real Chrome
  - Connection recovery and timeouts

## Message Flow

```
Client → Bridge → main_background.js
                      ↓
              ┌─────────────────┐
              │ Message Router  │
              └─────────────────┘
                ↓           ↓
        ┌──────────────┐  ┌──────────────┐
        │ BROP Command │  │ CDP Command  │
        │      ↓       │  │      ↓       │
        │ brop_server  │  │ cdp_server   │
        │      ↓       │  │      ↓       │
        │ Chrome APIs  │  │ Real Chrome  │
        └──────────────┘  └──────────────┘
```

## Benefits

- **🎯 Separation of Concerns**: Each server handles one protocol
- **📦 Reusability**: Servers can be used independently
- **🧹 Clean Code**: Main background is just delegation
- **🔧 Maintainability**: Protocol logic is isolated
- **🧪 Testability**: Each component can be tested separately

## Ports

- **9222**: CDP proxy (external clients)
- **9223**: Real Chrome CDP
- **9224**: Extension connection  
- **9225**: BROP bridge (external clients)

## Testing

- `pnpm run test:brop` - Test BROP commands
- `pnpm run test:quick` - Test CDP commands  
- `pnpm run test:multiplexed` - Test both protocols