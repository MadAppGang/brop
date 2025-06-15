#!/usr/bin/env node
/**
 * BROP Bridge Server (Node.js)
 * 
 * A middleware server that bridges between:
 * 1. BROP clients on port 9223  
 * 2. Chrome extension WebSocket client on port 9224
 * 3. CDP clients on port 9222 (Playwright/Puppeteer compatibility)
 * 
 * The Chrome extension connects as a WebSocket client to this bridge,
 * allowing external tools to control the browser through the extension.
 * 
 * =============================================================================
 * CDP SESSION MANAGEMENT ARCHITECTURE
 * =============================================================================
 * 
 * This bridge implements proper CDP session management as expected by Playwright.
 * 
 * PROBLEM CONTEXT:
 * ---------------
 * Playwright expects separate CDP connections for different "sessions":
 * - Main browser session: Browser.*, Target.* management commands
 * - Target sessions: Page.*, Runtime.*, DOM.* commands for specific targets
 * 
 * When Target.createTarget is called, Playwright expects:
 * 1. Target.createTarget response with targetId
 * 2. Target.attachedToTarget event with NEW sessionId 
 * 3. NEW session connection for target-specific commands
 * 4. Commands with sessionId route to the target's session
 * 
 * SOLUTION ARCHITECTURE:
 * ---------------------
 * 
 * 1. MAIN BROWSER CLIENT:
 *    - First CDP connection (isMainBrowser: true)
 *    - Handles Browser.* and Target.* commands
 *    - Receives Target.attachedToTarget events
 * 
 * 2. SESSION CHANNELS:
 *    - Created when Target.attachedToTarget events arrive
 *    - Each sessionId gets a virtual "session client"
 *    - Commands with sessionId route to session client
 *    - Target-specific events route to session client
 * 
 * 3. COMMAND ROUTING:
 *    - No sessionId = Main browser client
 *    - Has sessionId = Session client for that sessionId
 *    - Events route based on method and targetId
 * 
 * 4. SESSION LIFECYCLE:
 *    - Target.createTarget -> track pending creation
 *    - Target.attachedToTarget -> create session channel
 *    - Commands with sessionId -> route to session
 *    - Target cleanup -> remove session mappings
 * 
 * KEY DATA STRUCTURES:
 * -------------------
 * - cdpClients: Main browser clients and virtual session clients
 * - sessionChannels: sessionId -> { clientId, targetId, created }
 * - targetToSession: targetId -> sessionId mapping
 * - sessionToTarget: sessionId -> targetId mapping
 * - targetToClient: targetId -> owning clientId
 * 
 * This architecture ensures Playwright's _page object gets properly initialized
 * with the target's session connection, fixing the "_page undefined" error.
 */

import http from 'node:http';
import url from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';

class TableLogger {
  constructor(options = {}) {
    // Fixed column widths
    this.tsWidth = 19;      // Timestamp: [2025-06-13 04:09:41]
    this.statusWidth = 3;   // Status: ✅ or ❌ or 🔗 or 🔌
    this.typeWidth = 6;     // Type: BROP, EXT, SYS
    this.commandWidth = 20; // Command/Event name
    this.connWidth = 50;    // Connection info (increased from 35 to 45)
    this.errorWidth = 20;   // Error message (if any)

    // Configurable output stream
    this.outputStream = options.outputStream || 'stdout';
    this.mcpMode = options.mcpMode || false;
  }

  getTimestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  formatField(text, width, align = 'left') {
    const str = String(text || '').slice(0, width);

    // Special handling for emoji status characters
    if (str === '✅' || str === '❌' || str === '🔗' || str === '🔌') {
      // Create a fixed-width field for emoji
      return str.padEnd(1) + ' '.repeat(width - 1);
    }

    return align === 'right' ? str.padStart(width) : str.padEnd(width);
  }

  formatRow(status, type, command, connection, error = '') {
    const timestamp = this.getTimestamp();

    const parts = [
      this.formatField(timestamp, this.tsWidth),
      this.formatField(status, this.statusWidth),
      this.formatField(type, this.typeWidth),
      this.formatField(command, this.commandWidth),
      this.formatField(connection, this.connWidth),
      this.formatField(error, this.errorWidth) // Always include error column, even if empty
    ];

    return parts.join(' │ ');
  }

  log(message) {
    if (this.outputStream === 'stderr' || this.mcpMode) {
      console.error(message);
    } else {
      console.log(message);
    }
  }

  printHeader() {
    const header = this.formatRow('STS', 'TYPE', 'COMMAND/EVENT', 'CONNECTION', 'ERROR/DETAILS');
    this.log('─'.repeat(header.length));
    this.log(header);
    this.log('─'.repeat(header.length));
  }

  // Convenience methods for different log types
  logConnect(type, connection) {
    this.log(this.formatRow('🔗', type, 'connect', connection));
  }

  logDisconnect(type, connection) {
    this.log(this.formatRow('🔌', type, 'disconnect', connection));
  }

  logSuccess(type, command, connection, details = '') {
    this.log(this.formatRow('✅', type, command, connection, details));
  }

  logError(type, command, connection, error) {
    this.log(this.formatRow('❌', type, command, connection, error));
  }

  logSystem(message) {
    this.log(`[${this.getTimestamp()}] ${message}`);
  }
}

class BROPBridgeServer {
  constructor(options = {}) {
    this.startTime = Date.now();
    this.extensionClient = null;
    this.bropClients = new Set();
    
    // =======================================================================
    // CDP SESSION MANAGEMENT DATA STRUCTURES
    // =======================================================================
    
    // Main CDP client registry
    // Maps clientId -> client info object with session details
    this.cdpClients = new Map(); // clientId -> { 
                                 //   ws: WebSocket connection,
                                 //   sessionId: unique session identifier,
                                 //   targets: Set of owned targetIds,
                                 //   isMainBrowser: true for browser-level client,
                                 //   isSessionChannel: true for target session clients,
                                 //   connected: connection state flag
                                 // }
    this.cdpClientCounter = 0;
    
    // Session channel registry for Target.attachedToTarget events
    // When Playwright creates a target, it expects a new session for that target
    this.sessionChannels = new Map(); // sessionId -> {
                                       //   clientId: virtual client ID for this session,
                                       //   targetId: target this session controls,
                                       //   created: timestamp when session was created
                                       // }
    
    // Bidirectional mapping between targets and sessions
    // Allows routing target-specific commands to the correct session
    this.targetToSession = new Map(); // targetId -> sessionId
    this.sessionToTarget = new Map(); // sessionId -> targetId
    
    // Target ownership mapping for event routing
    // Determines which client owns which targets
    this.targetToClient = new Map(); // targetId -> clientId

    // Connection tracking
    this.connectionCounter = 0;
    this.clientConnections = new Map(); // Map client -> connection info

    // Message routing
    this.pendingBropRequests = new Map();
    this.pendingCdpRequests = new Map(); // messageId -> { clientId, originalClient }
    this.messageCounter = 0;

    // Event queuing to ensure responses are sent before related events
    this.queuedEvents = new Map(); // commandId -> [events] - events waiting for their command response
    this.createTargetCommands = new Map(); // commandId -> {targetId, timestamp} - Track Target.createTarget commands until events are flushed

    // Tab event subscriptions: tabId -> Set of clients
    this.tabEventSubscriptions = new Map();

    // Server instances
    this.bropServer = null;
    this.extensionServer = null;
    this.cdpServer = null;
    this.httpServer = null;

    this.running = false;

    // Browser info for CDP discovery - MASQUERADE AS REAL CHROME
    // This is critical for Playwright compatibility - it detects non-Chrome CDP servers
    // and switches to compatibility mode, causing premature disconnection
    this.browserInfo = {
      'Browser': 'Chrome/138.0.7204.15',  // Use real Chrome version to avoid detection
      'Protocol-Version': '1.3',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'V8-Version': '13.8.258.9',
      'WebKit-Version': '537.36 (@9f1120d029eadbc8ecc5c3d9b298c16d08aabf9f)',
      'webSocketDebuggerUrl': 'ws://localhost:9222/devtools/browser/brop-bridge-uuid-12345678'  // Chrome-compatible URL format
    };

    // Log storage for debugging endpoint
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 log entries

    // Table logger with configurable output
    this.logger = new TableLogger({
      outputStream: options.logToStderr ? 'stderr' : 'stdout',
      mcpMode: options.mcpMode || false
    });
  }

  log(message, ...args) {
    // Store all logs for debugging endpoint
    const logEntry = {
      timestamp: this.logger.getTimestamp(),
      message: message,
      args: args,
      fullMessage: args.length > 0 ? `${message} ${args.join(' ')}` : message,
      level: 'info'
    };

    this.logs.push(logEntry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }

    // Use system logging for non-structured messages
    this.logger.logSystem(message);
  }

  getNextMessageId() {
    this.messageCounter++;
    return `bridge_${this.messageCounter}`;
  }

  // Helper to format connection display with name
  getConnectionDisplay(client) {
    const clientInfo = this.clientConnections.get(client);
    if (!clientInfo) return 'unknown';

    return clientInfo.name ? `${clientInfo.id}:${clientInfo.name}` : clientInfo.id;
  }

  async startServers() {
    this.running = true;

    try {
      // Print table header for structured logging
      this.logger.printHeader();

      // Start BROP server (for BROP clients)
      this.bropServer = new WebSocketServer({
        port: 9223,
        perMessageDeflate: false
      });
      this.bropServer.on('connection', (ws, req) => {
        this.handleBropClient(ws, req);
      });
      this.log('🔧 BROP Server started on ws://localhost:9223');

      // Start Extension WebSocket server (extension connects as client)
      this.extensionServer = new WebSocketServer({
        port: 9224,
        perMessageDeflate: false
      });
      this.extensionServer.on('connection', (ws, req) => {
        this.handleExtensionClient(ws, req);
      });
      this.log('🔌 Extension Server started on ws://localhost:9224');

      // Start HTTP server for CDP discovery endpoints
      this.httpServer = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      // Start CDP WebSocket server attached to HTTP server
      this.cdpServer = new WebSocketServer({
        server: this.httpServer,
        perMessageDeflate: false
      });
      this.cdpServer.on('connection', (ws, req) => {
        this.handleCdpClient(ws, req);
      });

      this.httpServer.listen(9222, () => {
        this.log('🎭 CDP Server started on ws://localhost:9222');
        this.log('🌐 HTTP Server started on http://localhost:9222 (CDP discovery)');
      });
      
      this.log('📡 Waiting for Chrome extension to connect...');

    } catch (error) {
      console.error('Failed to start servers:', error);
      throw error;
    }
  }

  handleHttpRequest(req, res) {
    const pathname = url.parse(req.url).pathname;

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
      const tabs = this.getBrowserTabs();
      res.writeHead(200);
      res.end(JSON.stringify(tabs));
    } else if (pathname === '/logs') {
      // Return bridge server logs for debugging
      const urlParams = new URLSearchParams(url.parse(req.url).query);
      const limit = Number.parseInt(urlParams.get('limit')) || this.logs.length;
      const level = urlParams.get('level'); // filter by log level if provided

      let filteredLogs = this.logs;

      // Filter by level if specified
      if (level) {
        filteredLogs = this.logs.filter(log => log.level === level);
      }

      // Limit results
      const logsToReturn = filteredLogs.slice(-limit);

      const response = {
        total: this.logs.length,
        filtered: filteredLogs.length,
        returned: logsToReturn.length,
        maxLogs: this.maxLogs,
        logs: logsToReturn
      };

      res.writeHead(200);
      res.end(JSON.stringify(response, null, 2));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  getBrowserTabs() {
    // Return Chrome-compatible target list for CDP discovery
    // CRITICAL FIX: Only advertise browser target initially, pages are added when actually created
    const tabs = [];
    
    // Add the main browser target (Chrome-compatible format)
    tabs.push({
      description: '',  // Empty like real Chrome
      devtoolsFrontendUrl: '/devtools/inspector.html?ws=localhost:9222/devtools/browser/brop-bridge-uuid-12345678',
      id: 'brop-bridge-uuid-12345678',  // UUID-like format
      title: 'Chrome',  // Title like real Chrome
      type: 'browser',
      url: '',  // Empty like real Chrome
      webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/brop-bridge-uuid-12345678'
    });
    
    // CRITICAL FIX: Do NOT pre-advertise page targets from sessionChannels
    // This was causing "Duplicate target" errors because Playwright saw targets
    // in discovery that it didn't create, then received Target.attachedToTarget
    // events for the same targets, causing duplicates.
    //
    // Native Chrome only shows actual existing pages, not potential sessions.
    // We should match this behavior exactly.
    
    console.log(`🎭 DISCOVERY FIX: Advertising only browser target (no pre-created pages)`);
    console.log(`🎭 REASON: Prevents duplicate target errors in Playwright`);
    
    return tabs;
  }

  handleExtensionClient(ws, req) {
    this.logger.logConnect('EXT', 'extension');
    this.extensionClient = ws;

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'BROP Bridge Server - Extension connected successfully',
      timestamp: Date.now()
    }));

    // Process any queued CDP commands when extension reconnects
    this.processQueuedCommands();

    ws.on('message', (message) => {
      this.processExtensionMessage(message.toString());
    });

    ws.on('close', () => {
      this.logger.logDisconnect('EXT', 'extension');
      this.extensionClient = null;
    });

    ws.on('error', (error) => {
      console.error('Extension client error:', error);
    });
  }

  handleCdpClient(ws, req) {
    const pathname = url.parse(req.url).pathname;
    const clientId = `cdp_${++this.cdpClientCounter}`;
    
    this.logger.logConnect('CDP', `${clientId}:${pathname}`);

    // CHROME-COMPATIBLE PATH PARSING
    // Support Chrome's standard URL patterns:
    // /devtools/browser/UUID - Browser-level connection
    // /devtools/page/UUID - Page-specific connection  
    // /session/ABC123 - Session-specific connection (our custom format)
    let targetSessionId = null;
    let isMainBrowser = true;
    let clientType = 'browser';
    
    if (pathname.startsWith('/devtools/browser/')) {
      // Chrome-style browser connection
      isMainBrowser = true;
      clientType = 'browser';
      console.log(`🎭 CHROME BROWSER CONNECTION: ${pathname}`);
    } else if (pathname.startsWith('/devtools/page/')) {
      // Chrome-style page connection
      const pageId = pathname.substring('/devtools/page/'.length);
      targetSessionId = pageId;
      isMainBrowser = false;
      clientType = 'page';
      console.log(`🎭 CHROME PAGE CONNECTION: ${pageId}`);
    } else if (pathname.startsWith('/session/')) {
      // Our custom session connection format
      targetSessionId = pathname.substring('/session/'.length);
      isMainBrowser = false;
      clientType = 'session';
      console.log(`🎭 CUSTOM SESSION CONNECTION: ${targetSessionId}`);
    } else {
      // Default root connection - treat as browser
      isMainBrowser = this.cdpClients.size === 0 || pathname === '/' || pathname === '';
      console.log(`🎭 ROOT CONNECTION: Treating as browser-level`);
    }
    
    const clientInfo = {
      ws: ws,
      sessionId: targetSessionId || `session_${clientId}`,
      pathname: pathname,
      connected: true,
      targets: new Set(),
      isMainBrowser: isMainBrowser,
      isSessionConnection: !isMainBrowser,
      targetSessionId: targetSessionId, // The specific session this client represents
      clientType: clientType,
      created: Date.now()
    };
    
    console.log(`🎭 SESSION: Created CDP client ${clientId}, type: ${clientType}, isMainBrowser: ${isMainBrowser}, targetSession: ${targetSessionId || 'none'}`);

    this.cdpClients.set(clientId, clientInfo);

    ws.on('message', (message) => {
      this.processCdpMessage(clientId, message.toString());
    });

    ws.on('close', () => {
      this.logger.logDisconnect('CDP', `${clientId}:${pathname}`);
      this.cleanupCdpClient(clientId);
    });

    ws.on('error', (error) => {
      console.error(`CDP client ${clientId} error:`, error);
      this.cleanupCdpClient(clientId);
    });
  }


  cleanupCdpClient(clientId) {
    const clientInfo = this.cdpClients.get(clientId);
    if (clientInfo) {
      console.log(`🎭 SESSION CLEANUP: Cleaning up CDP client ${clientId}, type: ${clientInfo.clientType}`);
      
      // Mark the client as disconnected immediately to prevent further event routing
      clientInfo.connected = false;
      clientInfo.ws = null;
      
      // Clean up pending requests for this client
      for (const [messageId, requestInfo] of this.pendingCdpRequests.entries()) {
        if (requestInfo.clientId === clientId) {
          this.pendingCdpRequests.delete(messageId);
        }
      }
      
      // Clean up target mappings for this client
      for (const targetId of clientInfo.targets) {
        this.targetToClient.delete(targetId);
        
        // Clean up session mappings if this client owns any sessions
        const sessionId = this.targetToSession.get(targetId);
        if (sessionId) {
          console.log(`🎭 SESSION CLEANUP: Removing session ${sessionId} for target ${targetId}`);
          this.sessionChannels.delete(sessionId);
          this.targetToSession.delete(targetId);
          this.sessionToTarget.delete(sessionId);
        }
      }
      
      // If this was a session-specific client, clean up the session mapping
      if (clientInfo.isSessionConnection && clientInfo.targetSessionId) {
        const sessionId = clientInfo.targetSessionId;
        console.log(`🎭 SESSION CLEANUP: Removing session-specific client for session ${sessionId}`);
        this.sessionChannels.delete(sessionId);
        // Note: Don't delete targetToSession mappings here as they might be used by other clients
      }
      
      // Remove the client from the map
      this.cdpClients.delete(clientId);
      
      console.log(`🎭 SESSION: Cleaned up CDP client ${clientId}, remaining clients: ${this.cdpClients.size}`);
    }
  }

  handleBropClient(ws, req) {
    // Generate unique connection ID
    const connectionId = `conn-${++this.connectionCounter}`;

    // Extract client name from query parameters if provided
    // url already imported at top
    const queryParams = url.parse(req.url, true).query;
    const clientName = queryParams.name || null;

    const clientInfo = {
      id: connectionId,
      name: clientName,
      connectedAt: Date.now(),
      remoteAddress: req.socket.remoteAddress || 'unknown'
    };

    this.clientConnections.set(ws, clientInfo);

    // Format connection display with name if provided
    const connectionDisplay = clientName ? `${connectionId}:${clientName}` : connectionId;
    this.logger.logConnect('BROP', connectionDisplay);
    this.bropClients.add(ws);

    ws.on('message', (message) => {
      this.processBropMessage(ws, message.toString());
    });

    ws.on('close', () => {
      const connectionDisplay = this.getConnectionDisplay(ws);
      this.logger.logDisconnect('BROP', connectionDisplay);
      this.bropClients.delete(ws);
      this.clientConnections.delete(ws);

      // Clean up event subscriptions for this client
      for (const [tabId, subscribers] of this.tabEventSubscriptions.entries()) {
        subscribers.delete(ws);
        // Remove empty subscription sets
        if (subscribers.size === 0) {
          this.tabEventSubscriptions.delete(tabId);
        }
      }
    });

    ws.on('error', (error) => {
      console.error('BROP client error:', error);
    });
  }

  processExtensionMessage(message) {
    try {
      const data = JSON.parse(message);
      const messageType = data.type;

      // Handle direct server status requests from extension
      if (data.method === 'get_server_status') {
        const messageId = data.id || this.getNextMessageId();
        const statusResponse = {
          type: 'response',
          id: messageId,
          success: true,
          result: {
            server_status: 'running',
            connected_clients: {
              brop_clients: this.bropClients.size,
              cdp_clients: this.cdpClients.size,
              extension_connected: this.extensionClient && this.extensionClient.readyState === WebSocket.OPEN,
              total_active_sessions: this.bropClients.size + this.cdpClients.size
            },
            uptime: Date.now() - this.startTime,
            timestamp: Date.now()
          }
        };

        if (this.extensionClient && this.extensionClient.readyState === WebSocket.OPEN) {
          this.extensionClient.send(JSON.stringify(statusResponse));
        }
        return;
      }

      if (messageType === 'response') {
        // Extension responding to a request
        const requestId = data.id;

        // Check if this is a BROP response
        if (this.pendingBropRequests.has(requestId)) {
          const client = this.pendingBropRequests.get(requestId);
          this.pendingBropRequests.delete(requestId);
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
            // Log BROP command result with connection display using stored command info
            const cmdInfo = this.pendingCommandInfo?.get(requestId);
            if (cmdInfo) {
              this.pendingCommandInfo.delete(requestId);
              if (data.success) {
                this.logger.logSuccess('BROP', cmdInfo.command, cmdInfo.connection);
              } else {
                this.logger.logError('BROP', cmdInfo.command, cmdInfo.connection, data.error || 'Unknown error');
              }
            }
          }
        }

        // Check if this is a CDP response
        if (this.pendingCdpRequests.has(requestId)) {
          const requestInfo = this.pendingCdpRequests.get(requestId);
          this.pendingCdpRequests.delete(requestId);
          
          // CRITICAL SESSION FIX: Handle Target.createTarget response
          // Playwright expects Target.attachedToTarget to arrive immediately after Target.createTarget response
          // We must send it synchronously to prevent Playwright from disconnecting
          if (this.pendingTargetCreations && this.pendingTargetCreations.has(requestId)) {
            const clientId = this.pendingTargetCreations.get(requestId);
            this.pendingTargetCreations.delete(requestId);
            
            if (data.result && data.result.targetId) {
              const targetId = data.result.targetId;
              this.targetToClient.set(targetId, clientId);
              
              // Add target to client's target set
              const clientInfo = this.cdpClients.get(clientId);
              if (clientInfo) {
                clientInfo.targets.add(targetId);
              }
              
              console.log(`🎭 SESSION CRITICAL: Target.createTarget response received for ${targetId}`);
              
              // CRITICAL FIX: Send the required Target events sequence that native Chrome sends
              // Direct CDP comparison shows native Chrome sends: targetCreated, targetInfoChanged, attachedToTarget
              
              console.log(`🎭 NATIVE COMPATIBILITY: Sending required Target events sequence for new target`);
              console.log(`🎭 REASON: Native Chrome sends targetCreated + targetInfoChanged + attachedToTarget events`);
              console.log(`🎭 RESULT: Playwright will properly initialize _page object with sessionId`);
              
              // Send the complete event sequence
              this.sendTargetCreatedSequence(clientId, targetId);
            }
          }
          
          // SESSION-AWARE RESPONSE ROUTING
          // All responses go back to the original client that sent the command
          // Session management is handled at the command level, not response level
          const sessionId = requestInfo.sessionId;
          const targetClient = this.cdpClients.get(requestInfo.clientId);
          
          if (sessionId) {
            console.log(`🎭 SESSION: Routing response for sessionId ${sessionId} back to original client ${requestInfo.clientId}`);
          } else {
            console.log(`🎭 SESSION: Routing browser-level response back to client ${requestInfo.clientId}`);
          }
          
          // Check client state before sending response
          const wsOpen = requestInfo.originalClient.readyState === 1;
          const clientConnected = targetClient && targetClient.connected;
          
          console.log(`🎭 SESSION: Response routing check - WS open: ${wsOpen}, Client connected: ${clientConnected}, SessionId: ${sessionId || 'none'}`);
          
          if (wsOpen && clientConnected) {
            // Forward raw CDP response back to client
            const cdpResponse = {
              id: requestId,
              result: data.result,
              error: data.error
            };
            
            console.log(`🎭 SESSION: Sending CDP response - ID: ${requestId}, SessionId: ${sessionId || 'none'}`);
            
            requestInfo.originalClient.send(JSON.stringify(cdpResponse));
            
            // CRITICAL DISCOVERY: Native Chrome compatibility - NO synthetic events
            // Native Chrome only sends Target.createTarget response, no Target.attachedToTarget event
            // Playwright handles session creation internally without external events
            console.log(`🎭 NATIVE COMPATIBILITY: Response sent, no synthetic events needed`);
            
            if (data.error) {
              this.logger.logError('CDP', 'response', `${requestInfo.clientId}:${requestId}`, data.error.message || 'Unknown error');
            } else {
              this.logger.logSuccess('CDP', 'response', `${requestInfo.clientId}:${requestId}`);
            }
          } else {
            console.log(`🎭 SESSION: Blocked response to disconnected client ${requestInfo.clientId} (WS: ${wsOpen}, Connected: ${clientConnected})`);
          }
        }

      } else if (messageType === 'event') {
        // Extension sending an event, broadcast to relevant clients
        this.broadcastExtensionEvent(data);
      } else if (messageType === 'cdp_event') {
        // Extension sending a CDP event, route to appropriate CDP client
        console.log('🎭 Bridge received CDP event:', data.method);
        this.routeCdpEvent(data);
      } else if (messageType === 'log') {
        // Extension sending a log message
        this.log(`Extension: ${data.message || 'Unknown log'}`);
      }
    } catch (error) {
      console.error('Error processing extension message:', error);
    }
  }

  processCdpMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      const method = data.method;
      const messageId = data.id;
      const sessionId = data.sessionId;

      this.logger.logSuccess('CDP', method, `${clientId}:${messageId}`);

      const clientInfo = this.cdpClients.get(clientId);
      
      if (!clientInfo) {
        const errorResponse = {
          id: messageId,
          error: {
            code: -32000,
            message: 'CDP client not found'
          }
        };
        this.logger.logError('CDP', method, `${clientId}:${messageId}`, 'Client not found');
        return;
      }
      
      // Enhanced connection debugging
      console.log(`🔍 CONNECTION CHECK: extensionClient=${!!this.extensionClient}, readyState=${this.extensionClient?.readyState}`);
      
      if (!this.extensionClient || this.extensionClient.readyState !== 1) {
        console.log(`⏳ EXTENSION TEMPORARILY DISCONNECTED: Queuing command ${method} for retry...`);
        
        // Queue the command for retry when extension reconnects
        if (!this.queuedCdpCommands) {
          this.queuedCdpCommands = [];
        }
        
        this.queuedCdpCommands.push({
          clientId,
          clientInfo,
          message,
          messageId,
          method,
          timestamp: Date.now()
        });
        
        console.log(`📦 QUEUED: Command ${method} (ID: ${messageId}) queued, total queued: ${this.queuedCdpCommands.length}`);
        
        // Set timeout to process queue or send error after reasonable wait
        setTimeout(() => {
          this.processQueuedCommand(messageId, clientId, method);
        }, 2000); // 2 second timeout for extension to reconnect
        
        return;
      }
      
      console.log(`✅ CONNECTION OK: Extension connected and ready (readyState=${this.extensionClient.readyState})`);

      // SESSION MANAGEMENT: Track sessionId for proper response routing
      // Commands with sessionId are target-specific and need special handling
      if (sessionId) {
        console.log(`🎭 SESSION: Command ${method} targets sessionId: ${sessionId}`);
        
        // Verify this session exists, if not, it might be created later by Target.attachedToTarget
        const sessionClient = this.getSessionClientBySessionId(sessionId);
        if (!sessionClient) {
          console.log(`🎭 SESSION: SessionId ${sessionId} not yet registered (will be created by Target.attachedToTarget)`);
        } else {
          console.log(`🎭 SESSION: Using existing session ${sessionId} for command ${method}`);
        }
      } else {
        console.log(`🎭 SESSION: Command ${method} is browser-level (no sessionId)`);
      }

      // Store request info for response routing
      this.pendingCdpRequests.set(messageId, {
        clientId: clientId,
        originalClient: clientInfo.ws,
        method: method,
        sessionId: sessionId,  // Store sessionId for proper response routing
        originalParams: data.params,  // Store original parameters for Target events
        originalCommand: data   // Store original command for context extraction
      });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingCdpRequests.has(messageId)) {
          const requestInfo = this.pendingCdpRequests.get(messageId);
          this.pendingCdpRequests.delete(messageId);
          if (requestInfo.originalClient.readyState === WebSocket.OPEN) {
            const timeoutResponse = {
              id: messageId,
              error: {
                code: -32000,
                message: `Command timeout: ${method}`
              }
            };
            requestInfo.originalClient.send(JSON.stringify(timeoutResponse));
            this.logger.logError('CDP', method, `${clientId}:${messageId}`, 'Timeout');
          }
        }
      }, 30000); // 30 second timeout

      // Track target ownership for Target.createTarget commands
      if (method === 'Target.createTarget') {
        console.log(`🎭 SESSION: Tracking Target.createTarget command for client ${clientId}`);
        this.pendingTargetCreations = this.pendingTargetCreations || new Map();
        this.pendingTargetCreations.set(messageId, clientId);
      }

      // Forward raw CDP command to dedicated extension connection
      const extensionMessage = {
        type: 'cdp_command',
        id: messageId,
        method: method,
        params: data.params || {},
        sessionId: sessionId,
        clientId: clientId
      };

      console.log(`🎭 SESSION: Forwarding CDP command to extension: ${method} (ID: ${messageId}, SessionId: ${sessionId || 'none'})`);
      this.extensionClient.send(JSON.stringify(extensionMessage));

    } catch (error) {
      this.logger.logError('CDP', 'parse', clientId, error.message);
    }
  }


  processBropMessage(client, message) {
    try {
      const data = JSON.parse(message);
      const commandType = data.method || data.command?.type;
      const messageId = data.id || this.getNextMessageId();

      // Get connection display for this client
      const connectionDisplay = this.getConnectionDisplay(client);

      // Store command for later response logging (don't log request immediately)
      this.pendingCommandInfo = this.pendingCommandInfo || new Map();
      this.pendingCommandInfo.set(messageId, { command: commandType, connection: connectionDisplay });

      // Handle bridge server status requests directly
      if (commandType === 'get_server_status') {
        const statusResponse = {
          id: messageId,
          success: true,
          result: {
            server_status: 'running',
            connected_clients: {
              brop_clients: this.bropClients.size,
              extension_connected: this.extensionClient && this.extensionClient.readyState === WebSocket.OPEN,
              total_active_sessions: this.bropClients.size
            },
            uptime: Date.now() - this.startTime,
            timestamp: Date.now()
          }
        };
        client.send(JSON.stringify(statusResponse));
        this.logger.logSuccess('BROP', commandType, connectionDisplay);
        return;
      }

      // Handle tab event subscription
      if (commandType === 'subscribe_tab_events') {
        const tabId = data.params?.tabId;
        if (!tabId) {
          const errorResponse = {
            id: messageId,
            success: false,
            error: 'tabId is required for tab event subscription'
          };
          client.send(JSON.stringify(errorResponse));
          this.logger.logError('BROP', commandType, connectionDisplay, 'Missing tabId');
          return;
        }

        // Add client to subscription list for this tab
        if (!this.tabEventSubscriptions.has(tabId)) {
          this.tabEventSubscriptions.set(tabId, new Set());
        }
        this.tabEventSubscriptions.get(tabId).add(client);

        const successResponse = {
          id: messageId,
          success: true,
          result: {
            subscribed: true,
            tabId: tabId,
            events: data.params.events || ['tab_closed', 'tab_removed', 'tab_updated']
          }
        };
        client.send(JSON.stringify(successResponse));
        this.logger.logSuccess('BROP', commandType, connectionDisplay, `tab:${tabId}`);
        return;
      }

      // Handle tab event unsubscription
      if (commandType === 'unsubscribe_tab_events') {
        const tabId = data.params?.tabId;
        if (!tabId) {
          const errorResponse = {
            id: messageId,
            success: false,
            error: 'tabId is required for tab event unsubscription'
          };
          client.send(JSON.stringify(errorResponse));
          this.logger.logError('BROP', commandType, connectionDisplay, 'Missing tabId');
          return;
        }

        // Remove client from subscription list for this tab
        if (this.tabEventSubscriptions.has(tabId)) {
          this.tabEventSubscriptions.get(tabId).delete(client);
          // Clean up empty subscription sets
          if (this.tabEventSubscriptions.get(tabId).size === 0) {
            this.tabEventSubscriptions.delete(tabId);
          }
        }

        const successResponse = {
          id: messageId,
          success: true,
          result: {
            unsubscribed: true,
            tabId: tabId
          }
        };
        client.send(JSON.stringify(successResponse));
        this.logger.logSuccess('BROP', commandType, connectionDisplay, `tab:${tabId}`);
        return;
      }

      if (!this.extensionClient || this.extensionClient.readyState !== WebSocket.OPEN) {
        // No extension connected
        const errorResponse = {
          id: messageId,
          success: false,
          error: 'Chrome extension not connected'
        };
        client.send(JSON.stringify(errorResponse));
        this.logger.logError('BROP', commandType, connectionDisplay, 'Extension not connected');
        return;
      }

      // Add ID if not present
      data.id = messageId;
      data.type = 'brop_command';

      // Store client for response routing
      this.pendingBropRequests.set(messageId, client);

      // Forward to extension
      this.extensionClient.send(JSON.stringify(data));

    } catch (error) {
      console.error('Error processing BROP message:', error);
    }
  }



  broadcastExtensionEvent(eventData) {
    const eventType = eventData.event_type;
    const tabId = eventData.tabId;

    // If this is a tab-specific event, only broadcast to subscribed clients
    if (tabId && this.tabEventSubscriptions.has(tabId)) {
      const subscribers = this.tabEventSubscriptions.get(tabId);
      const eventMessage = JSON.stringify(eventData);

      let sentCount = 0;
      for (const client of subscribers) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(eventMessage);
          sentCount++;
        }
      }

      this.logger.logSuccess('BROP', `event:${eventType}`, `tab:${tabId}`, `→${sentCount} subscribers`);

      // Clean up subscriptions for closed tab events
      if (eventType === 'tab_closed' || eventType === 'tab_removed') {
        this.tabEventSubscriptions.delete(tabId);
        this.log(`🧹 Cleaned up subscriptions for closed tab: ${tabId}`);
      }
    } else {
      // Fallback: broadcast to all BROP clients (for non-tab-specific events)
      this.broadcastToBropClients(eventData);
    }
  }

  routeCdpEvent(eventData) {
    const method = eventData.method;
    const params = eventData.params;
    const tabId = eventData.tabId;

    // Create CDP event message format
    const cdpEventMessage = {
      method: method,
      params: params
    };

    console.log(`🎭 SESSION: Routing CDP event - Method: ${method}, TabId: ${tabId}`);
    
    // Check if eventData has an 'id' field (which would be wrong for events)
    if (eventData.id !== undefined) {
      console.log(`🎭 ERROR: CDP event has 'id' field! This will cause Playwright assertion error: ${eventData.id}`);
    }

    const messageStr = JSON.stringify(cdpEventMessage);
    let sentCount = 0;

    // ASYNC TARGET.ATTACHEDETOTARGET EVENT HANDLING
    // These events arrive from the Chrome extension after Target.createTarget
    // We need to coordinate with our synchronous version to prevent duplicates
    if (method === 'Target.attachedToTarget') {
      const sessionId = params?.sessionId;
      const targetId = params?.targetInfo?.targetId;
      
      if (sessionId && targetId) {
        console.log(`🎭 ASYNC SESSION: Target.attachedToTarget from extension - SessionId: ${sessionId}, TargetId: ${targetId}`);
        
        // Check if we already created a session for this target
        const existingSessionId = this.targetToSession.get(targetId);
        if (existingSessionId) {
          console.log(`🎭 ASYNC SESSION: Session already exists for target ${targetId} (sync session: ${existingSessionId})`);
          console.log(`🎭 ASYNC SESSION: Extension sessionId: ${sessionId}, Bridge sessionId: ${existingSessionId}`);
          
          // CRITICAL DEBUG: Why are we getting different sessionIds?
          if (sessionId !== existingSessionId) {
            console.log(`🎭 DUPLICATE ROOT CAUSE: Extension and bridge generated different sessionIds!`);
            console.log(`🎭 DUPLICATE ROOT CAUSE: Extension: ${sessionId}, Bridge: ${existingSessionId}`);
            console.log(`🎭 DUPLICATE ROOT CAUSE: This creates duplicate events with same targetId but different sessionIds`);
          }
          
          console.log(`🎭 ASYNC SESSION: Skipping async event to avoid duplication`);
          this.logger.logSuccess('CDP', `event:${method}`, 'async_skipped', 'Sync version already sent');
          return;
        }
        
        // If no sync session was created (edge case), create one now
        console.log(`🎭 ASYNC SESSION: No sync session found, creating from async event`);
        const mainClient = this.getMainBrowserClient();
        if (mainClient) {
          const sessionInfo = this.createSessionChannel(sessionId, targetId);
          if (sessionInfo) {
            console.log(`🎭 ASYNC SESSION: Session channel created from async event`);
            
            // Send the event to any connected clients
            mainClient.ws.send(messageStr);
            sentCount = 1;
            this.logger.logSuccess('CDP', `event:${method}`, 'async_fallback', `→${sentCount} client`);
          }
        } else {
          console.log(`🎭 ASYNC SESSION: No clients available for async event`);
          this.logger.logError('CDP', `event:${method}`, 'no_clients', 'No active clients for async event');
        }
        return;
      } else {
        console.log(`🎭 ASYNC SESSION ERROR: Target.attachedToTarget missing sessionId or targetId`);
      }
    }
    
    // Handle other Target events (browser-level)
    if (method === 'Target.detachedFromTarget' || method === 'Target.targetCreated') {
      const mainClient = this.getMainBrowserClient();
      if (mainClient) {
        mainClient.ws.send(messageStr);
        sentCount = 1;
        console.log(`🎭 SESSION: Sent browser-level ${method} to main session`);
        this.logger.logSuccess('CDP', `event:${method}`, 'main_browser', `→${sentCount} client`);
      } else {
        this.logger.logError('CDP', `event:${method}`, 'no_main_client', 'No main browser client available');
      }
      return;
    }
    
    // For non-Target events, route to the appropriate session channel
    if (tabId) {
      const targetId = `tab_${tabId}`;
      const sessionClient = this.getSessionClientForTarget(targetId);
      
      if (sessionClient) {
        sessionClient.ws.send(messageStr);
        sentCount = 1;
        console.log(`🎭 SESSION: Sent ${method} to target session for ${targetId}`);
        this.logger.logSuccess('CDP', `event:${method}`, 'target_session', `→${sentCount} client`);
      } else {
        // Fallback to main client if no target session exists
        const mainClient = this.getMainBrowserClient();
        if (mainClient) {
          mainClient.ws.send(messageStr);
          sentCount = 1;
          console.log(`🎭 SESSION: Fallback - sent ${method} to main session (no target session found)`);
          this.logger.logSuccess('CDP', `event:${method}`, 'main_fallback', `→${sentCount} client`);
        } else {
          this.logger.logError('CDP', `event:${method}`, 'no_clients', 'No CDP clients available');
        }
      }
    } else {
      // No tabId - send to main browser client
      const mainClient = this.getMainBrowserClient();
      if (mainClient) {
        mainClient.ws.send(messageStr);
        sentCount = 1;
        this.logger.logSuccess('CDP', `event:${method}`, 'main_browser', `→${sentCount} client`);
      } else {
        this.logger.logError('CDP', `event:${method}`, 'no_main_client', 'No main browser client available');
      }
    }
  }





  broadcastToBropClients(message) {
    const messageStr = JSON.stringify(message);
    for (const client of this.bropClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  // SESSION MANAGEMENT HELPER METHODS
  // These methods implement proper CDP session handling as expected by Playwright
  
  /**
   * Get the main browser client (the first CDP connection, used for browser-level commands)
   * This client handles Target.* commands and browser-level operations
   */
  getMainBrowserClient() {
    for (const [clientId, clientInfo] of this.cdpClients) {
      if (clientInfo.isMainBrowser && clientInfo.connected && clientInfo.ws.readyState === WebSocket.OPEN) {
        return clientInfo;
      }
    }
    // Fallback: return the first available client
    for (const [clientId, clientInfo] of this.cdpClients) {
      if (clientInfo.connected && clientInfo.ws.readyState === WebSocket.OPEN) {
        console.log(`🎭 SESSION FALLBACK: Using client ${clientId} as main browser client`);
        return clientInfo;
      }
    }
    return null;
  }
  
  /**
   * Get the session client for a specific target
   * Target-specific commands (Runtime.*, Page.*, DOM.*) should use the target's session
   * Returns the main browser client that owns the session for this target
   */
  getSessionClientForTarget(targetId) {
    const sessionId = this.targetToSession.get(targetId);
    if (sessionId) {
      console.log(`🎭 SESSION: Target ${targetId} maps to session ${sessionId}`);
      return this.getSessionClientBySessionId(sessionId);
    }
    console.log(`🎭 SESSION: No session found for target ${targetId}`);
    return null;
  }
  
  /**
   * Get session client by sessionId directly
   * First check for a dedicated session client, then fallback to main browser client
   */
  getSessionClientBySessionId(sessionId) {
    // First, look for a dedicated session-specific client
    for (const [clientId, clientInfo] of this.cdpClients) {
      if (clientInfo.isSessionConnection && 
          clientInfo.targetSessionId === sessionId && 
          clientInfo.connected && 
          clientInfo.ws.readyState === WebSocket.OPEN) {
        console.log(`🎭 SESSION: Found dedicated session client ${clientId} for session ${sessionId}`);
        return clientInfo;
      }
    }
    
    // Fallback: look for session in the session channels registry
    const sessionInfo = this.sessionChannels.get(sessionId);
    if (sessionInfo) {
      const clientInfo = this.cdpClients.get(sessionInfo.clientId);
      if (clientInfo && clientInfo.connected && clientInfo.ws.readyState === WebSocket.OPEN) {
        console.log(`🎭 SESSION: Found session ${sessionId} on fallback client ${sessionInfo.clientId}`);
        return clientInfo;
      }
    }
    
    console.log(`🎭 SESSION: Session ${sessionId} not found or client disconnected`);
    return null;
  }
  
  /**
   * Create a new session channel for a Target.attachedToTarget event
   * This is the core of proper CDP session management - each target gets its own session
   * 
   * CRITICAL: The session channel must be associated with an active CDP client connection
   * to receive commands. We create a "virtual" session that routes through the main browser client.
   */
  createSessionChannel(sessionId, targetId) {
    console.log(`🎭 SESSION CREATION: Creating session channel for SessionId: ${sessionId}, TargetId: ${targetId}`);
    
    // Find an active main browser client to associate with this session
    const mainClient = this.getMainBrowserClient();
    if (!mainClient) {
      console.log(`🎭 SESSION ERROR: No active main browser client found for session ${sessionId}`);
      return null;
    }
    
    console.log(`🎭 SESSION: Associating session ${sessionId} with main client (${mainClient.sessionId})`);
    
    // Register the session mappings FIRST
    this.targetToSession.set(targetId, sessionId);
    this.sessionToTarget.set(sessionId, targetId);
    
    // Register the session channel with reference to the main client
    this.sessionChannels.set(sessionId, {
      clientId: mainClient.sessionId, // Associate with main browser client
      targetId: targetId,
      created: Date.now(),
      mainClientId: mainClient.sessionId // Track which main client owns this session
    });
    
    // Add the target to the main client's target set
    mainClient.targets.add(targetId);
    
    console.log(`🎭 SESSION CREATED: Session ${sessionId} created for target ${targetId}`);
    console.log(`🎭 SESSION MAPPING: Target ${targetId} -> Session ${sessionId} -> MainClient ${mainClient.sessionId}`);
    console.log(`🎭 SESSION COUNT: Total sessions: ${this.sessionChannels.size}, Active clients: ${this.cdpClients.size}`);
    
    return {
      sessionId: sessionId,
      targetId: targetId,
      mainClientId: mainClient.sessionId
    };
  }
  
  /**
   * Create session channel when we encounter a sessionId without prior Target.attachedToTarget
   * This handles cases where commands arrive with sessionIds we haven't seen before
   */
  createSessionChannelForSessionId(sessionId) {
    console.log(`🎭 SESSION ON-DEMAND: Creating session channel for SessionId: ${sessionId}`);
    
    // We don't have the targetId in this case, so we'll use a placeholder
    const placeholderTargetId = `unknown_target_for_session_${sessionId}`;
    
    return this.createSessionChannel(sessionId, placeholderTargetId);
  }
  
  /**
   * CRITICAL PLAYWRIGHT FIX: Send Target.attachedToTarget synchronously
   * 
   * Playwright expects Target.attachedToTarget to arrive immediately after Target.createTarget response.
   * If we wait for the async event from the Chrome extension, Playwright disconnects before it arrives.
   * 
   * This method generates a synthetic Target.attachedToTarget event and sends it immediately
   * to keep Playwright connected and create the session properly.
   */
  sendSynchronousTargetAttachedEvent(targetId, clientId, clientInfo, browserContextId = 'default') {
    console.log(`🎭 SYNC SESSION: Generating immediate Target.attachedToTarget for ${targetId}`);
    
    // Generate a session ID for this target
    const sessionId = this.generateSessionId();
    
    // Create the session channel immediately
    const sessionInfo = this.createSessionChannel(sessionId, targetId);
    if (!sessionInfo) {
      console.log(`🎭 SYNC SESSION ERROR: Failed to create session channel for ${sessionId}`);
      return;
    }
    
    // CRITICAL FIX: Use exact same targetId as returned in Target.createTarget response
    // Playwright tracks targets by targetId - changing it breaks session association
    console.log(`🎭 CRITICAL: Using exact targetId from response: ${targetId}`);
    console.log(`🎭 REASON: Playwright must see same targetId in both response and event`);
    
    // Only convert browserContextId to UUID format, keep targetId unchanged
    const chromeCompatibleBrowserContextId = browserContextId === 'default' ? 
      this.generateChromeUUID() : browserContextId;
    
    // CRITICAL: Use exact format that matches real Chrome events
    // Fixed potential format issues based on Playwright validation requirements
    const attachedEvent = {
      method: 'Target.attachedToTarget',
      params: {
        sessionId: sessionId,
        targetInfo: {
          targetId: targetId,  // Use exact targetId from Target.createTarget response
          type: 'page',
          title: '',  // Empty string like real Chrome
          url: 'about:blank',
          attached: true,
          canAccessOpener: false,
          browserContextId: chromeCompatibleBrowserContextId
        },
        waitingForDebugger: false
      }
    };
    
    // DEFERRED DELIVERY: Send event after a minimal delay to ensure response is fully processed
    // This ensures Playwright has fully processed the Target.createTarget response
    if (clientInfo && clientInfo.connected && clientInfo.ws.readyState === WebSocket.OPEN) {
      // CRITICAL: Ensure this is an EVENT, not a response (no 'id' field)
      if (attachedEvent.id !== undefined) {
        console.log(`🎭 CRITICAL ERROR: Event has 'id' field! Removing to prevent Playwright assertion error!`);
        delete attachedEvent.id;
      }
      
      const messageStr = JSON.stringify(attachedEvent);
      
      // Send immediately - Playwright expects the event to arrive promptly
      clientInfo.ws.send(messageStr);
      
      console.log(`🎭 SYNC SESSION SUCCESS: Sent Target.attachedToTarget immediately`);
      console.log(`🎭 SYNC SESSION: SessionId: ${sessionId}, TargetId: ${targetId}, BrowserContext: ${chromeCompatibleBrowserContextId}`);
      console.log(`🎭 SYNC SESSION FORMAT:`, JSON.stringify(attachedEvent, null, 2));
      
      this.logger.logSuccess('CDP', 'event:Target.attachedToTarget', 'sync_immediate', '→1 client (immediate)');
    } else {
      console.log(`🎭 SYNC SESSION ERROR: Client ${clientId} not available for immediate event`);
    }
  }
  
  /**
   * Generate a session ID in the format expected by Chrome/Playwright
   */
  generateSessionId() {
    // Generate a 32-character hex string like Chrome does
    return Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
  }
  
  /**
   * Generate Chrome-compatible UUID for browserContextId
   * Chrome uses UUID format like: "A1B2C3D4-E5F6-7890-ABCD-EF1234567890"
   */
  generateChromeUUID() {
    const hex = () => Math.floor(Math.random() * 16).toString(16).toUpperCase();
    return `${Array.from({length: 8}, hex).join('')}-${Array.from({length: 4}, hex).join('')}-${Array.from({length: 4}, hex).join('')}-${Array.from({length: 4}, hex).join('')}-${Array.from({length: 12}, hex).join('')}`;
  }
  
  /**
   * Generate Chrome-compatible target ID from our tab_XXXXX format
   * Chrome uses UUID-like format for target IDs
   */
  generateChromeTargetId(originalTargetId) {
    // Extract the numeric part from tab_XXXXX
    const tabNumber = originalTargetId.replace('tab_', '');
    
    // Generate a UUID-like string but make it deterministic based on tab number
    // This ensures the same tab always gets the same target ID
    const seed = parseInt(tabNumber) || Math.random();
    const deterministicHex = (index) => {
      const value = Math.floor((seed * (index + 1) * 31) % 16);
      return value.toString(16).toUpperCase();
    };
    
    // Generate Chrome-style target ID: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    const segments = [
      Array.from({length: 8}, (_, i) => deterministicHex(i)).join(''),
      Array.from({length: 4}, (_, i) => deterministicHex(i + 8)).join(''),
      Array.from({length: 4}, (_, i) => deterministicHex(i + 12)).join(''),
      Array.from({length: 4}, (_, i) => deterministicHex(i + 16)).join(''),
      Array.from({length: 12}, (_, i) => deterministicHex(i + 20)).join('')
    ];
    
    return segments.join('-');
  }






  async shutdown() {
    this.log('🛑 Shutting down BROP Bridge Server...');
    this.running = false;

    if (this.bropServer) {
      this.bropServer.close();
    }

    if (this.extensionServer) {
      this.extensionServer.close();
    }

    if (this.cdpServer) {
      this.cdpServer.close();
    }

    if (this.httpServer) {
      this.httpServer.close();
    }
  }

  // Event queuing helper methods
  queueEvent(commandId, eventData) {
    if (!this.queuedEvents.has(commandId)) {
      this.queuedEvents.set(commandId, []);
    }
    this.queuedEvents.get(commandId).push(eventData);
    console.log(`🎭 QUEUE: Added event ${eventData.method} to queue for command ${commandId}`);
  }

  flushQueuedEvents(commandId) {
    const queuedEvents = this.queuedEvents.get(commandId);
    if (queuedEvents && queuedEvents.length > 0) {
      console.log(`🎭 FLUSH: Sending ${queuedEvents.length} queued events for command ${commandId}`);
      
      // Send each queued event now that the response is sent
      queuedEvents.forEach(eventData => {
        console.log(`🎭 FLUSH: Sending queued event ${eventData.method}`);
        this.routeCdpEventDirect(eventData); // Direct routing without queue check
      });
      
      // Clear the queue for this command
      this.queuedEvents.delete(commandId);
    }
    
    // CRITICAL: Remove the command from tracking since response has been sent
    if (this.createTargetCommands.has(commandId)) {
      console.log(`🎭 FLUSH: Removing Target.createTarget command ${commandId} from tracking`);
      this.createTargetCommands.delete(commandId);
    }
  }

  findPendingCreateTargetCommand(targetId) {
    // Search through tracked Target.createTarget commands
    // Since we can't predict the exact targetId, any pending createTarget command could match
    for (const [commandId, commandInfo] of this.createTargetCommands) {
      console.log(`🎭 PENDING: Found tracked Target.createTarget command ${commandId} for targetId ${targetId}`);
      return commandId;
    }
    console.log(`🎭 PENDING: No tracked Target.createTarget commands found for targetId ${targetId}`);
    return null;
  }

  routeCdpEventDirect(eventData) {
    // Direct event routing without queue checks (used for flushing queued events)
    const method = eventData.method;
    const params = eventData.params;
    const tabId = eventData.tabId;

    const cdpEventMessage = {
      method: method,
      params: params
    };

    const messageStr = JSON.stringify(cdpEventMessage);
    let sentCount = 0;

    // Use the same routing logic as routeCdpEvent but skip queue checks
    let targetClient = null;
    let routingMethod = 'fallback';
    
    if (method === 'Target.attachedToTarget' || method === 'Target.detachedFromTarget' || method === 'Target.targetCreated') {
      for (const [clientId, clientInfo] of this.cdpClients) {
        if (clientInfo.ws.readyState === WebSocket.OPEN) {
          targetClient = clientInfo;
          routingMethod = 'browser_session';
          console.log(`🎭 FLUSH: Routing browser-level ${method} event to browser session ${clientId}`);
          break;
        }
      }
    } else if (tabId) {
      const targetId = `tab_${tabId}`;
      const ownerClientId = this.targetToClient.get(targetId);
      if (ownerClientId) {
        const clientInfo = this.cdpClients.get(ownerClientId);
        if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
          targetClient = clientInfo;
          routingMethod = 'target_based';
        }
      }
    }
    
    if (!targetClient) {
      for (const [clientId, clientInfo] of this.cdpClients) {
        if (clientInfo.ws.readyState === WebSocket.OPEN) {
          targetClient = clientInfo;
          routingMethod = 'fallback_any';
          break;
        }
      }
    }

    if (targetClient) {
      targetClient.ws.send(messageStr);
      sentCount = 1;
      this.logger.logSuccess('CDP', `event:${method}`, `${routingMethod}`, `→${sentCount} client (queued)`);
    } else {
      this.logger.logError('CDP', `event:${method}`, `no_clients`, 'No active CDP clients to receive queued event');
    }
  }

  processQueuedCommands() {
    if (!this.queuedCdpCommands || this.queuedCdpCommands.length === 0) {
      return;
    }

    console.log(`🔄 PROCESSING QUEUE: ${this.queuedCdpCommands.length} queued CDP commands to process`);

    const commandsToProcess = [...this.queuedCdpCommands];
    this.queuedCdpCommands = [];

    for (const queuedCommand of commandsToProcess) {
      const { clientId, clientInfo, message, messageId, method } = queuedCommand;
      
      // Check if client is still connected
      if (this.cdpClients.has(clientId) && this.extensionClient && this.extensionClient.readyState === 1) {
        console.log(`🔄 RETRY: Processing queued command ${method} (ID: ${messageId})`);
        this.processCdpMessage(clientId, message);
      } else {
        console.log(`❌ EXPIRED: Queued command ${method} (ID: ${messageId}) - client disconnected`);
        
        // Send error response if client is still connected
        if (this.cdpClients.has(clientId)) {
          const errorResponse = {
            id: messageId,
            error: {
              code: -32000,
              message: 'Chrome extension not connected'
            }
          };
          clientInfo.ws.send(JSON.stringify(errorResponse));
        }
      }
    }
  }

  processQueuedCommand(messageId, clientId, method) {
    // Check if command is still in queue and extension is now available
    if (this.queuedCdpCommands) {
      const commandIndex = this.queuedCdpCommands.findIndex(cmd => cmd.messageId === messageId && cmd.clientId === clientId);
      
      if (commandIndex !== -1) {
        const queuedCommand = this.queuedCdpCommands[commandIndex];
        
        if (this.extensionClient && this.extensionClient.readyState === 1) {
          // Extension reconnected, process the command
          console.log(`🔄 DEQUEUE: Processing queued command ${method} (ID: ${messageId})`);
          this.queuedCdpCommands.splice(commandIndex, 1);
          this.processCdpMessage(queuedCommand.clientId, queuedCommand.message);
        } else {
          // Timeout reached, send error
          console.log(`⏰ TIMEOUT: Queued command ${method} (ID: ${messageId}) timed out`);
          this.queuedCdpCommands.splice(commandIndex, 1);
          
          if (this.cdpClients.has(clientId)) {
            const errorResponse = {
              id: messageId,
              error: {
                code: -32000,
                message: 'Chrome extension not connected'
              }
            };
            queuedCommand.clientInfo.ws.send(JSON.stringify(errorResponse));
          }
        }
      }
    }
  }

  sendTargetCreatedSequence(clientId, targetId) {
    console.log(`🎯 SENDING TARGET SEQUENCE: Starting event sequence for ${targetId}`);
    
    const clientInfo = this.cdpClients.get(clientId);
    if (!clientInfo || clientInfo.ws.readyState !== 1) {
      console.log(`❌ TARGET SEQUENCE: Client ${clientId} not available`);
      return;
    }

    // Extract target info from the original Target.createTarget command (stored in pending requests)
    const pendingRequest = Array.from(this.pendingCdpRequests.values())
      .find(req => req.method === 'Target.createTarget' && req.clientId === clientId);
    
    const url = pendingRequest?.originalParams?.url || 'about:blank';
    const browserContextId = pendingRequest?.originalParams?.browserContextId || 'default';
    
    console.log(`🎯 TARGET SEQUENCE: URL=${url}, browserContextId=${browserContextId}`);

    // 1. Target.targetCreated event (attached: false)
    const targetCreatedEvent = {
      method: 'Target.targetCreated',
      params: {
        targetInfo: {
          targetId: targetId,
          type: 'page',
          title: '',
          url: url,
          attached: false,
          canAccessOpener: false,
          browserContextId: browserContextId
        }
      }
    };
    
    console.log(`🎯 SENDING: Target.targetCreated (attached: false)`);
    clientInfo.ws.send(JSON.stringify(targetCreatedEvent));

    // 2. Target.targetInfoChanged event (attached: false → true)
    const targetInfoChangedEvent = {
      method: 'Target.targetInfoChanged',
      params: {
        targetInfo: {
          targetId: targetId,
          type: 'page',
          title: '',
          url: url,
          attached: true,
          canAccessOpener: false,
          browserContextId: browserContextId
        }
      }
    };
    
    console.log(`🎯 SENDING: Target.targetInfoChanged (attached: true)`);
    clientInfo.ws.send(JSON.stringify(targetInfoChangedEvent));

    // 3. Target.attachedToTarget event (provides sessionId for Playwright)
    const sessionId = this.generateSessionId();
    const attachedToTargetEvent = {
      method: 'Target.attachedToTarget',
      params: {
        sessionId: sessionId,
        targetInfo: {
          targetId: targetId,
          type: 'page',
          title: '',
          url: url,
          attached: true,
          canAccessOpener: false,
          browserContextId: browserContextId
        },
        waitingForDebugger: false
      }
    };
    
    console.log(`🎯 SENDING: Target.attachedToTarget (sessionId: ${sessionId})`);
    clientInfo.ws.send(JSON.stringify(attachedToTargetEvent));
    
    // CRITICAL: Create session mapping for the sessionId we just sent
    // Playwright will try to send commands to this sessionId immediately
    const sessionInfo = this.createSessionChannel(sessionId, targetId);
    if (sessionInfo) {
      console.log(`🎯 SESSION CREATED: Session channel ready for ${sessionId}`);
    } else {
      console.log(`🎯 SESSION ERROR: Failed to create session channel for ${sessionId}`);
    }
    
    console.log(`🎯 TARGET SEQUENCE COMPLETE: Sent all 3 events for ${targetId}`);
    console.log(`🎯 PLAYWRIGHT READY: Should now properly initialize _page object`);
  }
}

// Main function
async function main() {
  console.log('🌉 BROP Bridge Server (Node.js)');
  console.log(`=${'='.repeat(50)}`);
  console.log('Starting BROP bridge server...');
  console.log('');
  console.log('🔧 BROP Server: ws://localhost:9223 (for BROP clients)');
  console.log('🔌 Extension Server: ws://localhost:9224 (extension connects here)');
  console.log('');

  const bridge = new BROPBridgeServer();

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

// Check if we have required dependencies
try {
  // WebSocket already imported at top, just check if it exists
  if (!WebSocket) throw new Error('WebSocket not available');
} catch (error) {
  console.error('❌ Missing dependencies. Please run: npm install ws');
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { BROPBridgeServer };
