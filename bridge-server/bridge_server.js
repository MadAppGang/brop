#!/usr/bin/env node
/**
 * BROP Bridge Server (Node.js)
 * 
 * A middleware server that bridges between:
 * 1. CDP clients (Playwright) on port 9222
 * 2. BROP clients on port 9223  
 * 3. Chrome extension WebSocket client on port 9224
 * 
 * The Chrome extension connects as a WebSocket client to this bridge,
 * allowing external tools to control the browser through the extension.
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

class BROPBridgeServer {
  constructor() {
    this.extensionClient = null;
    this.cdpClients = new Set();
    this.bropClients = new Set();
    
    // Message routing
    this.pendingCdpRequests = new Map();
    this.pendingBropRequests = new Map();
    this.messageCounter = 0;
    
    // Session tracking for events
    this.clientSessions = new Map(); // client -> session info
    this.targetToClient = new Map(); // targetId -> client (for event routing)
    this.sessionToClient = new Map(); // sessionId -> client (for session routing)
    this.sessionToTarget = new Map(); // sessionId -> targetId
    
    // Page-specific WebSocket servers (like real Chrome CDP)
    this.pageServers = new Map(); // targetId -> WebSocket.Server
    this.pageClients = new Map(); // targetId -> Set of clients
    
    // Server instances
    this.cdpServer = null;
    this.bropServer = null;
    this.extensionServer = null;
    this.httpServer = null;
    
    // Browser state for CDP
    this.browserInfo = {
      "Browser": "Chrome/BROP-Extension",
      "Protocol-Version": "1.3",
      "User-Agent": "Mozilla/5.0 Chrome BROP Extension",
      "V8-Version": "12.0.0",
      "WebKit-Version": "537.36",
      "webSocketDebuggerUrl": "ws://localhost:9222/"
    };
    
    this.running = false;
    
    // Log storage for debugging endpoint
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 log entries
  }

  getTimestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  log(message, ...args) {
    const timestamp = this.getTimestamp();
    const logMessage = `[${timestamp}] ${message}`;
    const fullArgs = args.length > 0 ? [logMessage, ...args] : [logMessage];
    
    // Print to console
    console.log(...fullArgs);
    
    // Store in memory for debugging endpoint
    const logEntry = {
      timestamp: timestamp,
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
  }

  getNextMessageId() {
    this.messageCounter++;
    return `bridge_${this.messageCounter}`;
  }

  async startServers() {
    this.running = true;
    
    try {
      // Create HTTP server for CDP discovery endpoints
      this.httpServer = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });
      
      // Start CDP server (for Playwright)
      this.cdpServer = new WebSocket.Server({ 
        port: 9222,
        perMessageDeflate: false 
      });
      this.cdpServer.on('connection', (ws, req) => {
        this.handleCdpClient(ws, req);
      });
      this.log('🎭 CDP Server started on ws://localhost:9222');
      
      // Start BROP server (for BROP clients)
      this.bropServer = new WebSocket.Server({ 
        port: 9223,
        perMessageDeflate: false 
      });
      this.bropServer.on('connection', (ws, req) => {
        this.handleBropClient(ws, req);
      });
      this.log('🔧 BROP Server started on ws://localhost:9223');
      
      // Start Extension WebSocket server (extension connects as client)
      this.extensionServer = new WebSocket.Server({ 
        port: 9224,
        perMessageDeflate: false 
      });
      this.extensionServer.on('connection', (ws, req) => {
        this.handleExtensionClient(ws, req);
      });
      this.log('🔌 Extension Server started on ws://localhost:9224');
      this.log('📡 Waiting for Chrome extension to connect...');
      
      // Start HTTP server for CDP discovery
      this.httpServer.listen(9225, () => {
        this.log('🌐 HTTP Server started on http://localhost:9225 (CDP discovery)');
      });
      
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
    
    if (pathname === '/json/version') {
      res.writeHead(200);
      res.end(JSON.stringify(this.browserInfo));
    } else if (pathname === '/json' || pathname === '/json/list') {
      const tabs = this.getBrowserTabs();
      res.writeHead(200);
      res.end(JSON.stringify(tabs));
    } else if (pathname === '/logs') {
      // Return bridge server logs for debugging
      const urlParams = new URLSearchParams(url.parse(req.url).query);
      const limit = parseInt(urlParams.get('limit')) || this.logs.length;
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

  handleExtensionClient(ws, req) {
    this.log('🔌 Chrome extension connected');
    this.extensionClient = ws;
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'BROP Bridge Server - Extension connected successfully',
      timestamp: Date.now()
    }));
    
    ws.on('message', (message) => {
      this.processExtensionMessage(message.toString());
    });
    
    ws.on('close', () => {
      this.log('🔌 Chrome extension disconnected');
      this.extensionClient = null;
    });
    
    ws.on('error', (error) => {
      console.error('Extension client error:', error);
    });
  }

  handleCdpClient(ws, req) {
    const pathname = url.parse(req.url).pathname;
    this.log(`🎭 CDP client connected: ${pathname}`);
    
    // Create session info for this client
    const sessionInfo = {
      client: ws,
      pathname: pathname,
      sessionId: pathname.includes('/page/') ? pathname.split('/page/')[1] : 'default',
      targetId: null, // Will be set when target is created/attached
      connectionTime: Date.now()
    };
    
    this.cdpClients.add(ws);
    this.clientSessions.set(ws, sessionInfo);
    
    this.log(`🎭 Created session: ${sessionInfo.sessionId} for path: ${pathname}`);
    
    ws.on('message', (message) => {
      this.processCdpMessage(ws, message.toString());
    });
    
    ws.on('close', () => {
      // Clean up all mappings for this client
      const sessionInfoForCleanup = this.clientSessions.get(ws);
      this.log(`🎭 CDP client disconnected: ${sessionInfoForCleanup?.sessionId || 'unknown'}`);
      this.cdpClients.delete(ws);
      this.clientSessions.delete(ws);
      
      // Clean up target mappings
      for (const [targetId, client] of this.targetToClient.entries()) {
        if (client === ws) {
          this.targetToClient.delete(targetId);
          this.log(`🎯 Cleaned up target mapping: ${targetId}`);
        }
      }
      
      // Clean up session mappings
      for (const [sessionId, client] of this.sessionToClient.entries()) {
        if (client === ws) {
          this.sessionToClient.delete(sessionId);
          this.sessionToTarget.delete(sessionId);
          this.log(`🔗 Cleaned up session mapping: ${sessionId}`);
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error('CDP client error:', error);
    });
  }

  handleBropClient(ws, req) {
    this.log('🔧 BROP client connected');
    this.bropClients.add(ws);
    
    ws.on('message', (message) => {
      this.processBropMessage(ws, message.toString());
    });
    
    ws.on('close', () => {
      this.log('🔧 BROP client disconnected');
      this.bropClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('BROP client error:', error);
    });
  }

  processExtensionMessage(message) {
    try {
      const data = JSON.parse(message);
      const messageType = data.type;
      
      if (messageType === 'response') {
        // Extension responding to a request
        const requestId = data.id;
        
        // Check if this is a CDP response
        if (this.pendingCdpRequests.has(requestId)) {
          const client = this.pendingCdpRequests.get(requestId);
          this.pendingCdpRequests.delete(requestId);
          const cdpResponse = this.convertToCdpResponse(data);
          this.log(`📤 CDP response for ${requestId}:`, data.success ? 'SUCCESS' : `ERROR: ${data.error}`);
          
          // Track target creation for event routing
          if (data.success && data.result && data.result.targetId) {
            const sessionInfo = this.clientSessions.get(client);
            this.targetToClient.set(data.result.targetId, client);
            
            // Update session info with target ID
            if (sessionInfo) {
              sessionInfo.targetId = data.result.targetId;
            }
            
            console.log(`🎯 Mapped target ${data.result.targetId} to session ${sessionInfo?.sessionId}`);
            
            // Create page-specific WebSocket server (like real Chrome CDP)
            this.createPageServer(data.result.targetId);
          }
          
          // Validate CDP response before sending
          if (!this.isValidCdpResponse(cdpResponse)) {
            this.log(`⚠️ Invalid CDP response structure: ${JSON.stringify(cdpResponse)}`);
            return;
          }
          if (client.readyState === WebSocket.OPEN) {
            console.log('🔧 DEBUG: Sending CDP response:', JSON.stringify(cdpResponse));
            client.send(JSON.stringify(cdpResponse));
          }
        }
        // Check if this is a BROP response
        else if (this.pendingBropRequests.has(requestId)) {
          const client = this.pendingBropRequests.get(requestId);
          this.pendingBropRequests.delete(requestId);
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        }
      } else if (messageType === 'event') {
        // Extension sending an event, broadcast to relevant clients
        this.broadcastExtensionEvent(data);
      } else if (messageType === 'log') {
        // Extension sending a log message
        this.log(`Extension: ${data.message || 'Unknown log'}`);
      }
    } catch (error) {
      console.error('Error processing extension message:', error);
    }
  }

  processCdpMessage(client, message) {
    try {
      const data = JSON.parse(message);
      const method = data.method;
      const params = data.params || {};
      const messageId = data.id;
      const sessionId = data.sessionId; // Session-specific commands
      
      this.log(`🎭 CDP: ${method} (id: ${messageId}) ${sessionId ? `session: ${sessionId}` : ''} params:`, JSON.stringify(params).substring(0, 100));
      
      // Validate message structure before processing
      if (typeof messageId !== 'number' && typeof messageId !== 'string') {
        this.log(`⚠️ Invalid message ID type: ${typeof messageId}, value: ${messageId}`);
        const errorResponse = {
          id: messageId || 0,
          error: {
            code: -32600,
            message: 'Invalid message ID'
          }
        };
        client.send(JSON.stringify(errorResponse));
        return;
      }
      
      if (!this.extensionClient || this.extensionClient.readyState !== WebSocket.OPEN) {
        // No extension connected
        this.log(`CDP command ${method} failed: Extension not connected`);
        const errorResponse = {
          id: messageId,
          error: {
            code: -32000,
            message: 'Chrome extension not connected. Please reload the BROP extension.'
          }
        };
        client.send(JSON.stringify(errorResponse));
        return;
      }
      
      // Convert CDP command to extension format
      const extensionMessage = {
        type: 'cdp_command',
        id: messageId,
        method: method,
        params: params
      };
      
      // Store the client for response routing
      console.log(`🔧 DEBUG: Storing client for message ID ${messageId}, method: ${method}`);
      this.pendingCdpRequests.set(messageId, client);
      
      // Track target creation requests for event routing
      if (method === 'Target.createTarget') {
        const sessionInfo = this.clientSessions.get(client);
        console.log(`🎯 Target creation request from session: ${sessionInfo?.sessionId}`);
      }
      
      // Handle Target.getBrowserContexts - required by Puppeteer
      if (method === 'Target.getBrowserContexts') {
        console.log('🎯 Target.getBrowserContexts request');
        
        const contextsResponse = {
          id: messageId,
          result: {
            browserContextIds: ['default'] // Return default context
          }
        };
        
        console.log('🎯 Sending Target.getBrowserContexts response');
        client.send(JSON.stringify(contextsResponse));
        return;
      }

      // Handle Browser.getVersion - often requested by Puppeteer
      if (method === 'Browser.getVersion') {
        console.log('🌐 Browser.getVersion request');
        
        const versionResponse = {
          id: messageId,
          result: {
            protocolVersion: '1.3',
            product: 'Chrome/BROP-Extension',
            revision: '@1234567',
            userAgent: 'Mozilla/5.0 Chrome BROP Extension',
            jsVersion: '12.0.0'
          }
        };
        
        console.log('🌐 Sending Browser.getVersion response');
        client.send(JSON.stringify(versionResponse));
        return;
      }

      // Handle Runtime.enable - commonly needed for page operations
      if (method === 'Runtime.enable') {
        console.log('⚡ Runtime.enable request');
        
        const enableResponse = {
          id: messageId,
          result: {}
        };
        
        console.log('⚡ Sending Runtime.enable response');
        client.send(JSON.stringify(enableResponse));
        return;
      }

      // Handle Page.enable - needed for page-level operations
      if (method === 'Page.enable') {
        console.log('📄 Page.enable request');
        
        const enableResponse = {
          id: messageId,
          result: {}
        };
        
        console.log('📄 Sending Page.enable response');
        client.send(JSON.stringify(enableResponse));
        return;
      }

      // Handle Target.setDiscoverTargets - Puppeteer discovery mechanism
      if (method === 'Target.setDiscoverTargets') {
        console.log('🔍 Target.setDiscoverTargets request');
        
        const discoverResponse = {
          id: messageId,
          result: {}
        };
        
        console.log('🔍 Sending Target.setDiscoverTargets response');
        client.send(JSON.stringify(discoverResponse));
        return;
      }

      // Handle Target.attachToTarget - critical for Playwright page creation
      if (method === 'Target.attachToTarget') {
        const targetId = params.targetId;
        const flatten = params.flatten !== false; // default true
        console.log(`🔗 Target.attachToTarget request for ${targetId}, flatten: ${flatten}`);
        
        // Generate a session ID for this attachment
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store this session mapping
        const sessionInfo = this.clientSessions.get(client);
        if (sessionInfo) {
          sessionInfo.attachedTargetId = targetId;
          sessionInfo.attachedSessionId = sessionId;
        }
        
        // Add to routing maps
        this.sessionToClient.set(sessionId, client);
        this.sessionToTarget.set(sessionId, targetId);
        
        // Immediately send success response for attachment
        const attachResponse = {
          id: messageId,
          result: {
            sessionId: sessionId
          }
        };
        
        console.log(`🔗 Sending Target.attachToTarget response: sessionId=${sessionId}`);
        client.send(JSON.stringify(attachResponse));
        
        // Send Target.attachedToTarget event
        setTimeout(() => {
          const attachedEvent = {
            method: 'Target.attachedToTarget',
            params: {
              sessionId: sessionId,
              targetInfo: {
                targetId: targetId,
                type: 'page',
                title: 'New Tab',
                url: 'about:blank',
                attached: true,
                canAccessOpener: false
              },
              waitingForDebugger: false
            }
          };
          
          console.log(`🔗 Sending Target.attachedToTarget event for session: ${sessionId}`);
          client.send(JSON.stringify(attachedEvent));
        }, 10);
        
        // Don't forward this to extension, we handle it locally
        return;
      }
      
      // Set timeout for this request
      setTimeout(() => {
        if (this.pendingCdpRequests.has(messageId)) {
          this.pendingCdpRequests.delete(messageId);
          if (client.readyState === WebSocket.OPEN) {
            const timeoutResponse = {
              id: messageId,
              error: {
                code: -32000,
                message: `Command timeout: ${method}`
              }
            };
            client.send(JSON.stringify(timeoutResponse));
          }
        }
      }, 10000); // 10 second timeout
      
      // Forward to extension
      this.extensionClient.send(JSON.stringify(extensionMessage));
      
    } catch (error) {
      console.error('Error processing CDP message:', error);
    }
  }

  processBropMessage(client, message) {
    try {
      const data = JSON.parse(message);
      const commandType = data.command?.type;
      const messageId = data.id || this.getNextMessageId();
      
      this.log(`🔧 BROP: ${commandType}`);
      
      if (!this.extensionClient || this.extensionClient.readyState !== WebSocket.OPEN) {
        // No extension connected
        const errorResponse = {
          id: messageId,
          success: false,
          error: 'Chrome extension not connected'
        };
        client.send(JSON.stringify(errorResponse));
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

  convertToCdpResponse(extensionResponse) {
    const messageId = extensionResponse.id;
    
    // Validate message ID
    if (messageId === undefined || messageId === null) {
      this.log(`⚠️ Invalid message ID in extension response:`, JSON.stringify(extensionResponse));
      return {
        id: 0,
        error: {
          code: -32000,
          message: 'Invalid message ID'
        }
      };
    }
    
    if (extensionResponse.success) {
      // Success response
      const result = extensionResponse.result || {};
      this.log(`✅ CDP success response for ${messageId}:`, JSON.stringify(result).substring(0, 200));
      
      // Ensure result is a valid object
      const cdpResponse = {
        id: Number(messageId),
        result: result
      };
      
      // Validate the response structure
      if (typeof cdpResponse.id !== 'number') {
        this.log(`⚠️ Invalid ID type in CDP response: ${typeof cdpResponse.id}`);
        cdpResponse.id = Number(cdpResponse.id) || 0;
      }
      
      return cdpResponse;
    } else {
      // Error response
      const errorMsg = extensionResponse.error || 'Unknown error';
      this.log(`❌ CDP command failed:`, errorMsg);
      return {
        id: Number(messageId),
        error: {
          code: -32000,
          message: String(errorMsg)
        }
      };
    }
  }

  isValidCdpResponse(response) {
    if (!response || typeof response !== 'object') {
      this.log(`⚠️ CDP response is not an object: ${typeof response}`);
      return false;
    }
    
    if (!('id' in response)) {
      this.log(`⚠️ CDP response missing 'id' field`);
      return false;
    }
    
    if (typeof response.id !== 'number') {
      this.log(`⚠️ CDP response 'id' is not a number: ${typeof response.id}`);
      return false;
    }
    
    if (!('result' in response) && !('error' in response)) {
      this.log(`⚠️ CDP response missing both 'result' and 'error' fields`);
      return false;
    }
    
    if ('error' in response) {
      if (!response.error || typeof response.error !== 'object') {
        this.log(`⚠️ CDP response 'error' field is invalid`);
        return false;
      }
      if (typeof response.error.code !== 'number' || typeof response.error.message !== 'string') {
        this.log(`⚠️ CDP response error structure invalid`);
        return false;
      }
    }
    
    return true;
  }

  broadcastExtensionEvent(eventData) {
    const eventType = eventData.event_type;
    
    this.log(`🔧 DEBUG: Processing event: ${eventType}`);
    
    if (['console', 'page_load', 'navigation'].includes(eventType)) {
      // Broadcast to CDP clients
      const cdpEvent = {
        method: `Runtime.${eventType}`,
        params: eventData.params || {}
      };
      this.log(`📡 Broadcasting Runtime event: ${cdpEvent.method}`);
      this.broadcastToCdpClients(cdpEvent);
    } else if (eventType === 'target_created') {
      // Send target events to specific client that created the target
      const targetId = eventData.params?.targetInfo?.targetId;
      const cdpEvent = {
        method: eventData.method || 'Target.targetCreated',
        params: eventData.params || {}
      };
      
      if (targetId && this.targetToClient.has(targetId)) {
        const targetClient = this.targetToClient.get(targetId);
        this.log(`🎯 Sending target created event to specific client: ${targetId}`);
        this.sendEventToClient(targetClient, cdpEvent);
      } else {
        this.log(`🎯 Broadcasting target created event (no specific client): ${targetId}`);
        this.broadcastToCdpClients(cdpEvent);
      }
    } else if (eventType === 'target_attached') {
      // With separate endpoints, Target.attachedToTarget should be sent to page endpoints
      const targetId = eventData.params?.targetInfo?.targetId;
      const sessionId = eventData.params?.sessionId;
      const cdpEvent = {
        method: eventData.method || 'Target.attachedToTarget',
        params: eventData.params || {}
      };
      
      this.log(`🔗 Sending target attached event to page endpoint: target=${targetId}, session=${sessionId}`);
      this.sendEventToPageClients(targetId, cdpEvent);
    } else if (eventType === 'execution_context_created') {
      // Send execution context events to page endpoints instead of broadcasting
      const cdpEvent = {
        method: 'Runtime.executionContextCreated',
        params: eventData.params || {}
      };
      this.log(`⚡ Broadcasting execution context created to all page endpoints`);
      this.broadcastToAllPageClients(cdpEvent);
    }
    
    // Always broadcast to BROP clients
    this.broadcastToBropClients(eventData);
  }

  sendEventToClient(client, message) {
    // Send event to specific client
    if (message.id !== undefined) {
      this.log(`⚠️ WARNING: Attempting to send event with id field - this will cause assertion error!`);
      this.log(`   Message: ${JSON.stringify(message)}`);
      return; // Don't send messages with id fields as events
    }
    
    if (client.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      this.log(`📡 Sending event to specific client: ${message.method}`);
      client.send(messageStr);
    } else {
      this.log(`⚠️ Cannot send event - client connection closed`);
    }
  }

  broadcastToCdpClients(message) {
    const messageStr = JSON.stringify(message);
    
    // CRITICAL FIX: Only send events that should NOT have id fields
    // Events should never have id fields - that's what caused the assertion error
    if (message.id !== undefined) {
      this.log(`⚠️ WARNING: Attempting to broadcast message with id field - this will cause assertion error!`);
      this.log(`   Message: ${JSON.stringify(message)}`);
      return; // Don't send messages with id fields as events
    }
    
    this.log(`📡 Broadcasting event to ${this.cdpClients.size} CDP clients: ${message.method}`);
    this.cdpClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  sendEventToPageClients(targetId, message) {
    // Send event to clients connected to specific page endpoint
    if (message.id !== undefined) {
      this.log(`⚠️ WARNING: Attempting to send event with id field to page clients`);
      return;
    }
    
    const pageClients = this.pageClients.get(targetId);
    if (pageClients) {
      const messageStr = JSON.stringify(message);
      this.log(`📡 Sending event to ${pageClients.size} page clients for ${targetId}: ${message.method}`);
      
      pageClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    } else {
      this.log(`⚠️ No page clients found for ${targetId}`);
    }
  }
  
  broadcastToAllPageClients(message) {
    // Send event to all page endpoint clients
    if (message.id !== undefined) {
      this.log(`⚠️ WARNING: Attempting to broadcast event with id field to page clients`);
      return;
    }
    
    const messageStr = JSON.stringify(message);
    let totalClients = 0;
    
    for (const [targetId, pageClients] of this.pageClients.entries()) {
      pageClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
          totalClients++;
        }
      });
    }
    
    this.log(`📡 Broadcasted event to ${totalClients} page clients: ${message.method}`);
  }

  broadcastToBropClients(message) {
    const messageStr = JSON.stringify(message);
    this.bropClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  createPageServer(targetId) {
    // Create a page-specific WebSocket server (mimicking real Chrome CDP)
    const port = this.getNextAvailablePort();
    const pageServer = new WebSocket.Server({ port: port });
    
    this.pageServers.set(targetId, pageServer);
    this.pageClients.set(targetId, new Set());
    
    this.log(`🔌 Created page server for ${targetId} on port ${port}`);
    this.log(`📡 Page endpoint: ws://localhost:${port}/`);
    
    pageServer.on('connection', (ws, req) => {
      this.handlePageClient(ws, req, targetId);
    });
    
    pageServer.on('error', (error) => {
      console.error(`Page server error for ${targetId}:`, error);
    });
    
    return port;
  }
  
  getNextAvailablePort() {
    // Start from port 9300 and find next available
    // In production, this should be more sophisticated
    return 9300 + this.pageServers.size;
  }
  
  handlePageClient(ws, req, targetId) {
    this.log(`🔌 Page client connected to ${targetId}`);
    
    const pageClients = this.pageClients.get(targetId);
    if (pageClients) {
      pageClients.add(ws);
    }
    
    ws.on('message', (message) => {
      this.processPageMessage(ws, message.toString(), targetId);
    });
    
    ws.on('close', () => {
      this.log(`🔌 Page client disconnected from ${targetId}`);
      if (pageClients) {
        pageClients.delete(ws);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`Page client error for ${targetId}:`, error);
    });
  }
  
  processPageMessage(client, message, targetId) {
    try {
      const data = JSON.parse(message);
      const method = data.method;
      const params = data.params || {};
      const messageId = data.id;
      
      this.log(`🔌 Page ${targetId}: ${method} (id: ${messageId})`);
      
      // Forward page-specific commands to extension with target context
      if (!this.extensionClient || this.extensionClient.readyState !== WebSocket.OPEN) {
        const errorResponse = {
          id: messageId,
          error: {
            code: -32000,
            message: 'Chrome extension not connected'
          }
        };
        client.send(JSON.stringify(errorResponse));
        return;
      }
      
      // Add target context to the message
      const extensionMessage = {
        type: 'cdp_command',
        id: messageId,
        method: method,
        params: params,
        targetId: targetId // Include target context
      };
      
      // Store the client for response routing (page-specific)
      this.pendingCdpRequests.set(messageId, client);
      
      // Forward to extension
      this.extensionClient.send(JSON.stringify(extensionMessage));
      
    } catch (error) {
      console.error(`Error processing page message for ${targetId}:`, error);
    }
  }

  getBrowserTabs() {
    // Return tabs with page-specific WebSocket endpoints
    const tabs = [];
    let tabIndex = 1;
    
    for (const [targetId, pageServer] of this.pageServers.entries()) {
      const port = pageServer.address()?.port || 9222;
      tabs.push({
        description: "",
        devtoolsFrontendUrl: `/devtools/inspector.html?ws=localhost:${port}/`,
        id: tabIndex.toString(),
        title: `BROP Page ${targetId}`,
        type: "page",
        url: "about:blank",
        webSocketDebuggerUrl: `ws://localhost:${port}/`
      });
      tabIndex++;
    }
    
    // If no page servers yet, return default
    if (tabs.length === 0) {
      tabs.push({
        description: "",
        devtoolsFrontendUrl: "/devtools/inspector.html?ws=localhost:9222/page/1",
        id: "1",
        title: "BROP Extension Tab",
        type: "page",
        url: "about:blank",
        webSocketDebuggerUrl: "ws://localhost:9222/page/1"
      });
    }
    
    return tabs;
  }

  async shutdown() {
    this.log('🛑 Shutting down BROP Bridge Server...');
    this.running = false;
    
    if (this.cdpServer) {
      this.cdpServer.close();
    }
    
    if (this.bropServer) {
      this.bropServer.close();
    }
    
    if (this.extensionServer) {
      this.extensionServer.close();
    }
    
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    // Close all page servers
    for (const [targetId, pageServer] of this.pageServers.entries()) {
      this.log(`🛑 Closing page server for ${targetId}`);
      pageServer.close();
    }
    this.pageServers.clear();
    this.pageClients.clear();
  }
}

// Main function
async function main() {
  console.log('🌉 BROP Bridge Server (Node.js)');
  console.log('=' + '='.repeat(50));
  console.log('Starting multi-protocol bridge server...');
  console.log('');
  console.log('🎭 CDP Server: ws://localhost:9222 (for Playwright)');
  console.log('🔧 BROP Server: ws://localhost:9223 (for BROP clients)');
  console.log('🔌 Extension Server: ws://localhost:9224 (extension connects here)');
  console.log('🌐 HTTP Server: http://localhost:9225 (CDP discovery)');
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
  require('ws');
} catch (error) {
  console.error('❌ Missing dependencies. Please run: npm install ws');
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { BROPBridgeServer };