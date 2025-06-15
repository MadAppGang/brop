#!/usr/bin/env node
/**
 * BROP Bridge Server - Complete Multiplexing Architecture
 * 
 * Implements the hybrid architecture:
 * 1. BROP commands (port 9225) → Extension APIs
 * 2. CDP commands (port 9222) → Wrapped as BROP_CDP → Real Chrome CDP
 * 
 * Key Features:
 * - Connection multiplexing: Multiple CDP clients → Single extension channel
 * - Message wrapping: CDP commands wrapped in BROP envelopes with routing metadata
 * - Response demultiplexing: Route responses back to correct client connections
 * - Session management: Track sessionIds and targetIds for proper routing
 */

import http from 'node:http';
import url from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';

class MultiplexedBridgeServer {
  constructor(options = {}) {
    this.startTime = Date.now();
    
    // Extension connection
    this.extensionClient = null;
    
    // BROP clients (port 9225)
    this.bropClients = new Set();
    
    // CDP client connections and multiplexing
    this.cdpConnections = new Map(); // connectionId -> { ws, clientInfo, created }
    this.connectionCounter = 0;
    
    // Message routing and response multiplexing
    this.pendingBropRequests = new Map(); // messageId -> bropClient
    this.pendingCdpRequests = new Map();  // messageId -> { connectionId, originalMessage, sessionId }
    this.messageCounter = 0;
    
    // Chrome CDP connection for forwarding (we'll connect to real Chrome)
    this.realChromeConnection = null;
    this.realChromeUrl = 'ws://localhost:9223'; // Real Chrome on different port
    
    // Server instances
    this.bropServer = null;
    this.extensionServer = null;
    this.cdpServer = null;
    this.httpServer = null;
    
    this.running = false;
    
    // Browser info for CDP discovery
    this.browserInfo = {
      'Browser': 'Chrome/138.0.7204.15',
      'Protocol-Version': '1.3',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'V8-Version': '13.8.258.9',
      'WebKit-Version': '537.36 (@9f1120d029eadbc8ecc5c3d9b298c16d08aabf9f)',
      'webSocketDebuggerUrl': 'ws://localhost:9222/devtools/browser/brop-bridge-uuid-12345678'
    };
    
    // Logs for debugging
    this.logs = [];
    this.maxLogs = 1000;
  }

  log(message) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message: message,
      level: 'info'
    };
    
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }
    
    console.log(`[${logEntry.timestamp}] ${message}`);
  }

  getNextMessageId() {
    this.messageCounter++;
    return `bridge_${this.messageCounter}`;
  }

  getNextConnectionId() {
    this.connectionCounter++;
    return `conn_${this.connectionCounter}`;
  }

  async startServers() {
    this.running = true;
    this.log('🌉 Starting BROP Multiplexed Bridge Server');
    
    try {
      // Start BROP server (port 9225 - for BROP clients)
      this.bropServer = new WebSocketServer({ port: 9225, host: '127.0.0.1', perMessageDeflate: false });
      this.bropServer.on('connection', (ws, req) => this.handleBropClient(ws, req));
      this.log('🔧 BROP Server started on ws://localhost:9225');

      // Start Extension server (port 9224 - extension connects here)
      this.extensionServer = new WebSocketServer({ port: 9224, host: '127.0.0.1', perMessageDeflate: false });
      this.extensionServer.on('connection', (ws, req) => this.handleExtensionClient(ws, req));
      this.log('🔌 Extension Server started on ws://localhost:9224');

      // Start HTTP server for CDP discovery
      this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));

      // Start CDP server (port 9222 - for CDP clients like Playwright)
      this.cdpServer = new WebSocketServer({ server: this.httpServer, perMessageDeflate: false });
      this.cdpServer.on('connection', (ws, req) => this.handleCdpClient(ws, req));

      // Start HTTP server with proper async handling
      await new Promise((resolve, reject) => {
        this.httpServer.on('error', (error) => {
          console.error('HTTP Server error:', error);
          reject(error);
        });
        
        this.httpServer.listen(9222, '127.0.0.1', () => {
          this.log('🎭 CDP Server started on ws://localhost:9222');
          this.log('🌐 HTTP Server started on http://localhost:9222 (CDP discovery)');
          
          // Verify the server is actually listening
          const address = this.httpServer.address();
          this.log(`📍 Server address: ${JSON.stringify(address)}`);
          resolve();
        });
      });
      
      // Connect to real Chrome for CDP forwarding
      await this.connectToRealChrome();
      
      this.log('📡 Waiting for Chrome extension to connect...');

    } catch (error) {
      console.error('Failed to start servers:', error);
      throw error;
    }
  }

  async connectToRealChrome() {
    try {
      // Get real Chrome WebSocket URL
      const response = await fetch('http://localhost:9223/json/version');
      const data = await response.json();
      this.realChromeUrl = data.webSocketDebuggerUrl;
      
      this.log(`🔗 Connecting to real Chrome: ${this.realChromeUrl}`);
      
      this.realChromeConnection = new WebSocket(this.realChromeUrl);
      
      this.realChromeConnection.on('open', () => {
        this.log('✅ Connected to real Chrome CDP');
      });
      
      this.realChromeConnection.on('message', (data) => {
        this.handleRealChromeMessage(data.toString());
      });
      
      this.realChromeConnection.on('close', () => {
        this.log('🔌 Real Chrome CDP connection closed');
        this.realChromeConnection = null;
      });
      
      this.realChromeConnection.on('error', (error) => {
        this.log(`❌ Real Chrome CDP error: ${error.message}`);
      });
      
    } catch (error) {
      this.log(`⚠️ Cannot connect to real Chrome: ${error.message}`);
      this.log('💡 Start Chrome with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9223 --headless');
    }
  }

  handleHttpRequest(req, res) {
    this.log(`🌐 HTTP ${req.method} ${req.url}`);
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (pathname === '/json/version' || pathname === '/json/version/') {
      res.writeHead(200);
      res.end(JSON.stringify(this.browserInfo));
    } else if (pathname === '/json' || pathname === '/json/' || pathname === '/json/list' || pathname === '/json/list/') {
      // Return Chrome-compatible target list
      const tabs = [{
        description: '',
        devtoolsFrontendUrl: '/devtools/inspector.html?ws=localhost:9222/devtools/browser/brop-bridge-uuid-12345678',
        id: 'brop-bridge-uuid-12345678',
        title: 'Chrome',
        type: 'browser',
        url: '',
        webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/brop-bridge-uuid-12345678'
      }];
      res.writeHead(200);
      res.end(JSON.stringify(tabs));
    } else if (pathname === '/logs') {
      const urlParams = new URLSearchParams(url.parse(req.url).query);
      const limit = Number.parseInt(urlParams.get('limit')) || this.logs.length;
      
      const logsToReturn = this.logs.slice(-limit);
      const response = {
        total: this.logs.length,
        returned: logsToReturn.length,
        logs: logsToReturn
      };
      
      res.writeHead(200);
      res.end(JSON.stringify(response, null, 2));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  handleBropClient(ws, req) {
    const connectionId = this.getNextConnectionId();
    this.log(`🔗 BROP client connected: ${connectionId}`);
    
    this.bropClients.add(ws);

    ws.on('message', (message) => {
      this.processBropMessage(ws, message.toString());
    });

    ws.on('close', () => {
      this.log(`🔌 BROP client disconnected: ${connectionId}`);
      this.bropClients.delete(ws);
    });

    ws.on('error', (error) => {
      this.log(`❌ BROP client error: ${error.message}`);
    });
  }

  handleCdpClient(ws, req) {
    const connectionId = this.getNextConnectionId();
    const pathname = url.parse(req.url).pathname;
    
    this.log(`🔗 CDP client connected: ${connectionId} (${pathname})`);
    
    const clientInfo = {
      ws: ws,
      pathname: pathname,
      connected: true,
      created: Date.now()
    };
    
    this.cdpConnections.set(connectionId, clientInfo);

    ws.on('message', (message) => {
      this.processCdpMessage(connectionId, message.toString());
    });

    ws.on('close', () => {
      this.log(`🔌 CDP client disconnected: ${connectionId}`);
      this.cleanupCdpConnection(connectionId);
    });

    ws.on('error', (error) => {
      this.log(`❌ CDP client error: ${error.message}`);
      this.cleanupCdpConnection(connectionId);
    });
  }

  cleanupCdpConnection(connectionId) {
    const clientInfo = this.cdpConnections.get(connectionId);
    if (clientInfo) {
      clientInfo.connected = false;
      this.cdpConnections.delete(connectionId);
      
      // Clean up pending requests for this connection
      for (const [messageId, requestInfo] of this.pendingCdpRequests.entries()) {
        if (requestInfo.connectionId === connectionId) {
          this.pendingCdpRequests.delete(messageId);
        }
      }
    }
  }

  handleExtensionClient(ws, req) {
    this.log('🔗 Extension connected');
    this.extensionClient = ws;

    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'BROP Multiplexed Bridge Server - Extension connected',
      timestamp: Date.now()
    }));

    ws.on('message', (message) => {
      this.processExtensionMessage(message.toString());
    });

    ws.on('close', () => {
      this.log('🔌 Extension disconnected');
      this.extensionClient = null;
    });

    ws.on('error', (error) => {
      this.log(`❌ Extension error: ${error.message}`);
    });
  }

  processBropMessage(client, message) {
    try {
      const data = JSON.parse(message);
      const messageId = data.id || this.getNextMessageId();
      
      this.log(`📤 BROP command: ${data.method || data.command?.type}`);

      if (!this.extensionClient || this.extensionClient.readyState !== WebSocket.OPEN) {
        this.log(`❌ Extension check failed: client=${!!this.extensionClient}, readyState=${this.extensionClient?.readyState}`);
        const errorResponse = {
          id: messageId,
          success: false,
          error: 'Chrome extension not connected'
        };
        client.send(JSON.stringify(errorResponse));
        return;
      }

      // Add ID and type for extension processing
      data.id = messageId;
      data.type = 'brop_command';

      // Store client for response routing
      this.pendingBropRequests.set(messageId, client);

      // Forward to extension
      this.extensionClient.send(JSON.stringify(data));

    } catch (error) {
      this.log(`❌ Error processing BROP message: ${error.message}`);
    }
  }

  processCdpMessage(connectionId, message) {
    try {
      const data = JSON.parse(message);
      const method = data.method;
      const messageId = data.id;
      const sessionId = data.sessionId;

      this.log(`📤 CDP command: ${method} (${connectionId}:${messageId})`);

      const clientInfo = this.cdpConnections.get(connectionId);
      if (!clientInfo || !clientInfo.connected) {
        this.log(`❌ CDP client ${connectionId} not found or disconnected`);
        return;
      }

      // Store request info for response routing
      this.pendingCdpRequests.set(messageId, {
        connectionId: connectionId,
        originalClient: clientInfo.ws,
        method: method,
        sessionId: sessionId,
        originalMessage: data
      });

      // CRITICAL: Check if we should forward to real Chrome or handle via extension
      if (this.shouldForwardToRealChrome(method)) {
        this.forwardToRealChrome(data, messageId, connectionId);
      } else {
        this.forwardToExtension(data, messageId, connectionId, sessionId);
      }

    } catch (error) {
      this.log(`❌ Error processing CDP message: ${error.message}`);
    }
  }

  shouldForwardToRealChrome(method) {
    // Define which commands should go to real Chrome vs extension
    // Most CDP commands should go to real Chrome for proper browser automation
    const realChromeCommands = [
      // Browser commands
      'Browser.getVersion',
      'Browser.setDownloadBehavior',
      'Browser.getWindowBounds',
      'Browser.setWindowBounds',
      
      // Target commands  
      'Target.setDiscoverTargets', 
      'Target.setAutoAttach',
      'Target.createBrowserContext',
      'Target.createTarget',
      'Target.getTargets',
      'Target.activateTarget',
      'Target.closeTarget',
      'Target.attachToTarget',
      'Target.detachFromTarget',
      
      // Page commands
      'Page.navigate',
      'Page.reload',
      'Page.enable',
      'Page.disable',
      'Page.getNavigationHistory',
      'Page.setLifecycleEventsEnabled',
      
      // Runtime commands
      'Runtime.evaluate',
      'Runtime.callFunctionOn',
      'Runtime.enable',
      'Runtime.disable',
      'Runtime.getProperties',
      
      // DOM commands
      'DOM.getDocument',
      'DOM.querySelector',
      'DOM.getOuterHTML',
      'DOM.enable',
      'DOM.disable',
      
      // Network commands
      'Network.enable',
      'Network.disable',
      'Network.setUserAgentOverride',
      
      // Security commands
      'Security.enable',
      'Security.disable'
    ];
    
    // Extension commands (Chrome APIs that need extension context)
    const extensionCommands = [
      'tabs.query',
      'tabs.create', 
      'tabs.update',
      'tabs.remove',
      'windows.create',
      'windows.update'
    ];
    
    // If it's an extension command, route to extension
    if (extensionCommands.includes(method)) {
      return false;
    }
    
    // Default: route to real Chrome for all CDP commands
    return realChromeCommands.includes(method) || method.includes('.');
  }

  forwardToRealChrome(data, messageId, connectionId) {
    if (!this.realChromeConnection || this.realChromeConnection.readyState !== WebSocket.OPEN) {
      this.log(`⚠️ Real Chrome not available, falling back to extension for ${data.method}`);
      this.forwardToExtension(data, messageId, connectionId, data.sessionId);
      return;
    }

    this.log(`🔄 Forwarding ${data.method} to real Chrome`);
    
    // Forward directly to real Chrome
    this.realChromeConnection.send(JSON.stringify(data));
  }

  forwardToExtension(data, messageId, connectionId, sessionId) {
    if (!this.extensionClient || this.extensionClient.readyState !== WebSocket.OPEN) {
      const errorResponse = {
        id: messageId,
        error: { code: -32000, message: 'Chrome extension not connected' }
      };
      
      const clientInfo = this.cdpConnections.get(connectionId);
      if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
        clientInfo.ws.send(JSON.stringify(errorResponse));
      }
      return;
    }

    // Wrap CDP command in BROP envelope for extension processing
    const wrappedMessage = {
      type: 'BROP_CDP',
      connectionId: connectionId,
      id: messageId,
      method: data.method,
      params: data.params || {},
      sessionId: sessionId,
      originalCommand: data
    };

    this.log(`📦 Wrapping CDP command ${data.method} for extension`);
    this.extensionClient.send(JSON.stringify(wrappedMessage));
  }

  handleRealChromeMessage(message) {
    try {
      const data = JSON.parse(message);
      
      if (data.id) {
        // This is a response to a command we forwarded
        const requestInfo = this.pendingCdpRequests.get(data.id);
        if (requestInfo) {
          this.pendingCdpRequests.delete(data.id);
          
          // Route response back to correct client
          if (requestInfo.originalClient.readyState === WebSocket.OPEN) {
            this.log(`📥 Routing Chrome response for ${data.id} back to ${requestInfo.connectionId}`);
            requestInfo.originalClient.send(message);
          }
        }
      } else if (data.method) {
        // This is an event from Chrome - broadcast to all CDP clients
        this.log(`📡 Broadcasting Chrome event: ${data.method}`);
        this.broadcastCdpEvent(message);
      }
      
    } catch (error) {
      this.log(`❌ Error handling real Chrome message: ${error.message}`);
    }
  }

  processExtensionMessage(message) {
    try {
      const data = JSON.parse(message);
      const messageType = data.type;

      if (messageType === 'response') {
        // Extension responding to a request
        const requestId = data.id;

        // Check if this is a BROP response
        if (this.pendingBropRequests.has(requestId)) {
          const client = this.pendingBropRequests.get(requestId);
          this.pendingBropRequests.delete(requestId);
          
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
            this.log("📥 BROP response sent to client");
          }
          return;
        }

        // Check if this is a CDP response
        if (this.pendingCdpRequests.has(requestId)) {
          const requestInfo = this.pendingCdpRequests.get(requestId);
          this.pendingCdpRequests.delete(requestId);
          
          // Route CDP response back to correct client
          if (requestInfo.originalClient.readyState === WebSocket.OPEN) {
            const cdpResponse = {
              id: requestId,
              result: data.result,
              error: data.error
            };
            
            this.log(`📥 CDP response routed to ${requestInfo.connectionId}`);
            requestInfo.originalClient.send(JSON.stringify(cdpResponse));
          }
          return;
        }

      } else if (messageType === 'cdp_event') {
        // Extension sending a CDP event
        this.log(`📡 Extension CDP event: ${data.method}`);
        this.broadcastCdpEvent(JSON.stringify({
          method: data.method,
          params: data.params
        }));
      }
      
    } catch (error) {
      this.log(`❌ Error processing extension message: ${error.message}`);
    }
  }

  broadcastCdpEvent(eventMessage) {
    // Broadcast CDP event to all connected CDP clients
    let sentCount = 0;
    
    for (const [connectionId, clientInfo] of this.cdpConnections) {
      if (clientInfo.connected && clientInfo.ws.readyState === WebSocket.OPEN) {
        clientInfo.ws.send(eventMessage);
        sentCount++;
      }
    }
    
    this.log(`📡 CDP event broadcast to ${sentCount} clients`);
  }

  async shutdown() {
    this.log('🛑 Shutting down multiplexed bridge server...');
    this.running = false;

    if (this.realChromeConnection) {
      this.realChromeConnection.close();
    }

    if (this.bropServer) this.bropServer.close();
    if (this.extensionServer) this.extensionServer.close();
    if (this.cdpServer) this.cdpServer.close();
    if (this.httpServer) this.httpServer.close();
  }
}

// Main function
async function main() {
  console.log('🌉 BROP Multiplexed Bridge Server');
  console.log('=' .repeat(50));
  console.log('🔧 BROP Port: 9225 (BROP clients)');
  console.log('🔌 Extension Port: 9224 (extension connects here)');
  console.log('🎭 CDP Port: 9222 (Playwright/CDP clients)');
  console.log('🔗 Real Chrome: 9223 (for CDP forwarding)');
  console.log('');

  const bridge = new MultiplexedBridgeServer();

  // Setup signal handlers
  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT');
    bridge.shutdown().then(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM');
    bridge.shutdown().then(() => process.exit(0));
  });

  try {
    await bridge.startServers();
  } catch (error) {
    console.error('💥 Server error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MultiplexedBridgeServer };