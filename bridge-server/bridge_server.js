#!/usr/bin/env node
/**
 * BROP Bridge Server (Node.js)
 * 
 * A middleware server that bridges between:
 * 1. BROP clients on port 9223  
 * 2. Chrome extension WebSocket client on port 9224
 * 
 * The Chrome extension connects as a WebSocket client to this bridge,
 * allowing external tools to control the browser through the extension.
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

class BROPBridgeServer {
  constructor() {
    this.startTime = Date.now();
    this.extensionClient = null;
    this.bropClients = new Set();
    
    // Connection tracking
    this.connectionCounter = 0;
    this.clientConnections = new Map(); // Map client -> connection info
    
    // Message routing
    this.pendingBropRequests = new Map();
    this.messageCounter = 0;
    
    // Server instances
    this.bropServer = null;
    this.extensionServer = null;
    
    this.running = false;
    
    // Log storage for debugging endpoint
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 log entries
  }

  getTimestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  formatTableRow(timestamp, status, type, command, connection, error = '') {
    // Fixed column widths
    const tsWidth = 19;      // Timestamp: [2025-06-13 04:09:41]
    const statusWidth = 3;   // Status: ✅ or ❌ or 🔗 or 🔌 (emojis need more space)
    const typeWidth = 10;    // Type: BROP, EXT, SYS
    const commandWidth = 20; // Command/Event name
    const connWidth = 25;    // Connection info
    const errorWidth = 40;   // Error message (if any)
    
    // Truncate and pad fields, accounting for emoji width
    const formatField = (text, width, align = 'left') => {
      const str = String(text || '').slice(0, width);
      // For status emojis, pad to ensure consistent spacing
      if (text === status && (text.includes('✅') || text.includes('❌') || text.includes('🔗') || text.includes('🔌'))) {
        return str.padEnd(width);
      }
      return align === 'right' ? str.padStart(width) : str.padEnd(width);
    };
    
    const parts = [
      formatField(timestamp, tsWidth),
      formatField(status, statusWidth),
      formatField(type, typeWidth),
      formatField(command, commandWidth),
      formatField(connection, connWidth),
      error ? formatField(error, errorWidth) : ''
    ];
    
    return parts.filter(p => p).join(' │ ').trim();
  }

  log(message, ...args) {
    const timestamp = this.getTimestamp();
    
    // Check if this is a structured log that should be formatted as table
    if (message.includes('BROP:') || message.includes('connected') || message.includes('disconnected')) {
      this.logAsTable(timestamp, message, ...args);
    } else {
      // Regular log format for system messages
      const logMessage = `[${timestamp}] ${message}`;
      const fullArgs = args.length > 0 ? [logMessage, ...args] : [logMessage];
      console.log(...fullArgs);
    }
  }

  logAsTable(timestamp, message, ...args) {
    let status = '🔧';
    let type = 'SYS';
    let command = '';
    let connection = '';
    let error = '';
    
    // Parse different message types
    if (message.includes('✅ BROP:')) {
      status = '✅';
      type = 'BROP';
      const parts = message.split('✅ BROP: ')[1];
      const bracketMatch = parts.match(/^(.*?)\s*\[(.*?)\](.*)$/);
      if (bracketMatch) {
        command = bracketMatch[1].trim();
        connection = bracketMatch[2].trim();
        error = bracketMatch[3].replace(/^\s*\(?(.*?)\)?$/, '$1').trim();
      }
    } else if (message.includes('❌ BROP:')) {
      status = '❌';
      type = 'BROP';
      const parts = message.split('❌ BROP: ')[1];
      const bracketMatch = parts.match(/^(.*?)\s*\[(.*?)\](.*)$/);
      if (bracketMatch) {
        command = bracketMatch[1].trim();
        connection = bracketMatch[2].trim();
        error = bracketMatch[3].replace(/^\s*\(?(.*?)\)?$/, '$1').trim();
      }
    } else if (message.includes('🔗') && message.includes('connected')) {
      status = '🔗';
      if (message.includes('BROP client')) {
        type = 'BROP';
        command = 'connect';
        const bracketMatch = message.match(/\[(.*?)\]/);
        if (bracketMatch) connection = bracketMatch[1];
      } else if (message.includes('Chrome extension')) {
        type = 'EXT';
        command = 'connect';
        connection = 'extension';
      }
    } else if (message.includes('🔌') && message.includes('disconnected')) {
      status = '🔌';
      if (message.includes('BROP client')) {
        type = 'BROP';
        command = 'disconnect';
        const bracketMatch = message.match(/\[(.*?)\]/);
        if (bracketMatch) connection = bracketMatch[1];
      } else if (message.includes('Chrome extension')) {
        type = 'EXT';
        command = 'disconnect';
        connection = 'extension';
      }
    } else {
      // System messages
      command = message.replace(/[🔧🔌📡🌉]/g, '').trim();
      connection = 'system';
    }
    
    const tableRow = this.formatTableRow(timestamp, status, type, command, connection, error);
    console.log(tableRow);
    
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

  printTableHeader() {
    const header = this.formatTableRow(
      'TIMESTAMP', 
      'STS', 
      'TYPE', 
      'COMMAND/EVENT', 
      'CONNECTION', 
      'ERROR/DETAILS'
    );
    console.log('─'.repeat(header.length));
    console.log(header);
    console.log('─'.repeat(header.length));
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
      this.printTableHeader();
      
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
    this.log('🔗 Chrome extension connected');
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
    // Generate unique connection ID
    const connectionId = `conn-${++this.connectionCounter}`;
    
    // Extract client name from query parameters if provided
    const url = require('url');
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
    this.log(`🔗 BROP client connected [${connectionDisplay}]`);
    this.bropClients.add(ws);
    
    ws.on('message', (message) => {
      this.processBropMessage(ws, message.toString());
    });
    
    ws.on('close', () => {
      const connectionDisplay = this.getConnectionDisplay(ws);
      this.log(`🔌 BROP client disconnected [${connectionDisplay}]`);
      this.bropClients.delete(ws);
      this.clientConnections.delete(ws);
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
              extension_connected: this.extensionClient && this.extensionClient.readyState === WebSocket.OPEN,
              total_active_sessions: this.bropClients.size
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
            const cmdInfo = this.pendingCommandInfo && this.pendingCommandInfo.get(requestId);
            if (cmdInfo) {
              this.pendingCommandInfo.delete(requestId);
              const statusEmoji = data.success ? '✅' : '❌';
              const errorInfo = data.success ? '' : ` (${data.error || 'Unknown error'})`;
              this.log(`${statusEmoji} BROP: ${cmdInfo.command}${errorInfo} [${cmdInfo.connection}]`);
            }
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
        this.log(`✅ BROP: ${commandType} [${connectionDisplay}]`);
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
        this.log(`❌ BROP: ${commandType} Extension not connected [${connectionDisplay}]`);
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
    
    this.log(`🔧 DEBUG: Processing event: ${eventType}`);
    
    // Only broadcast to BROP clients (CDP support removed)
    this.broadcastToBropClients(eventData);
  }



  

  broadcastToBropClients(message) {
    const messageStr = JSON.stringify(message);
    this.bropClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
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
  }
}

// Main function
async function main() {
  console.log('🌉 BROP Bridge Server (Node.js)');
  console.log('=' + '='.repeat(50));
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
  require('ws');
} catch (error) {
  console.error('❌ Missing dependencies. Please run: npm install ws');
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { BROPBridgeServer };