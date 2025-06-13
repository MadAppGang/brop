#!/usr/bin/env node
/**
 * MCP BROP Server
 * 
 * This server can operate in two modes:
 * 1. Server Mode: When port 9223 is free, starts BROP bridge servers on 9223/9224
 * 2. Relay Mode: When port 9223 is occupied, acts as BROP client and provides MCP interface
 */

const net = require('node:net');
const WebSocket = require('ws');
const { BROPBridgeServer } = require('./bridge_server.js');

class MCPBROPServer {
  constructor() {
    this.isServerMode = false;
    this.bridgeServer = null;
    this.bropClient = null;
    this.mcpServer = null;
    this.logger = this.createLogger();
  }

  createLogger() {
    return {
      log: (message, ...args) => {
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        console.log(`[${timestamp}] ${message}`, ...args);
      },
      error: (message, ...args) => {
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        console.error(`[${timestamp}] ERROR: ${message}`, ...args);
      },
      success: (message, ...args) => {
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        console.log(`[${timestamp}] ✅ ${message}`, ...args);
      }
    };
  }

  /**
   * Check if port 9223 is available
   * @returns {Promise<boolean>} true if port is available, false if occupied
   */
  async checkPortAvailability(port = 9223) {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.listen(port, () => {
        server.close(() => {
          resolve(true); // Port is available
        });
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false); // Port is occupied
        } else {
          resolve(false); // Other error, assume port is not available
        }
      });
    });
  }

  /**
   * Start in Server Mode - run BROP bridge servers on 9223/9224
   */
  async startServerMode() {
    this.logger.log('🔧 Starting MCP BROP Server in SERVER MODE');
    this.logger.log('📡 Will start BROP bridge servers on ports 9223 and 9224');

    try {
      this.bridgeServer = new BROPBridgeServer();
      await this.bridgeServer.startServers();

      this.logger.success('Server Mode: BROP bridge servers started successfully');
      this.isServerMode = true;

      // Start MCP server interface
      await this.startMCPInterface();

    } catch (error) {
      this.logger.error('Failed to start server mode:', error);
      throw error;
    }
  }

  /**
   * Start in Relay Mode - connect to existing BROP server and provide MCP interface
   */
  async startRelayMode() {
    this.logger.log('🔗 Starting MCP BROP Server in RELAY MODE');
    this.logger.log('📡 Will connect to existing BROP server on port 9223');

    try {
      // Connect to existing BROP server as a client
      await this.connectToBROPServer();

      this.logger.success('Relay Mode: Connected to BROP server successfully');
      this.isServerMode = false;

      // Start MCP server interface
      await this.startMCPInterface();

    } catch (error) {
      this.logger.error('Failed to start relay mode:', error);
      throw error;
    }
  }

  /**
   * Connect to existing BROP server as a client
   */
  async connectToBROPServer() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:9223?name=mcp-relay');

      ws.on('open', () => {
        this.logger.success('Connected to BROP server as relay client');
        this.bropClient = ws;
        resolve();
      });

      ws.on('error', (error) => {
        this.logger.error('Failed to connect to BROP server:', error);
        reject(error);
      });

      ws.on('close', () => {
        this.logger.log('Connection to BROP server closed');
        this.bropClient = null;
      });

      ws.on('message', (message) => {
        this.handleBROPMessage(message.toString());
      });
    });
  }

  /**
   * Handle messages from BROP server (in relay mode)
   */
  handleBROPMessage(message) {
    try {
      const data = JSON.parse(message);
      this.logger.log('📨 Received from BROP server:', data.type || data.method || 'unknown');

      // Forward to MCP clients if needed
      if (this.mcpClients) {
        this.broadcastToMCPClients(data);
      }
    } catch (error) {
      this.logger.error('Error handling BROP message:', error);
    }
  }

  /**
   * Start MCP server interface
   */
  async startMCPInterface() {
    const MCP_PORT = 3000; // Default MCP port

    this.mcpServer = new WebSocket.Server({
      port: MCP_PORT,
      perMessageDeflate: false
    });

    this.mcpClients = new Set();

    this.mcpServer.on('connection', (ws, req) => {
      this.handleMCPClient(ws, req);
    });

    this.logger.success(`MCP interface started on ws://localhost:${MCP_PORT}`);
    this.logger.log(`🌐 Mode: ${this.isServerMode ? 'SERVER' : 'RELAY'}`);
  }

  /**
   * Handle MCP client connections
   */
  handleMCPClient(ws, req) {
    this.logger.log('🔌 MCP client connected');
    this.mcpClients.add(ws);

    // Send welcome message with server info
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: true
          }
        },
        serverInfo: {
          name: 'mcp-brop-server',
          version: '1.0.0',
          mode: this.isServerMode ? 'server' : 'relay'
        }
      }
    }));

    ws.on('message', (message) => {
      this.handleMCPMessage(ws, message.toString());
    });

    ws.on('close', () => {
      this.logger.log('🔌 MCP client disconnected');
      this.mcpClients.delete(ws);
    });

    ws.on('error', (error) => {
      this.logger.error('MCP client error:', error);
    });
  }

  /**
   * Handle MCP messages from clients
   */
  async handleMCPMessage(client, message) {
    try {
      const data = JSON.parse(message);
      this.logger.log('📨 MCP Request:', data.method || 'unknown');

      // Handle MCP protocol messages
      if (data.method === 'tools/list') {
        this.sendMCPResponse(client, data.id, {
          tools: this.getMCPTools()
        });
      } else if (data.method === 'tools/call') {
        await this.handleMCPToolCall(client, data);
      } else {
        // Unknown method
        this.sendMCPError(client, data.id, -32601, 'Method not found');
      }
    } catch (error) {
      this.logger.error('Error handling MCP message:', error);
      this.sendMCPError(client, null, -32700, 'Parse error');
    }
  }

  /**
   * Get available MCP tools
   */
  getMCPTools() {
    return [
      {
        name: 'brop_navigate',
        description: 'Navigate to a URL in the browser',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to navigate to'
            },
            tabId: {
              type: 'number',
              description: 'Optional tab ID to navigate in'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'brop_get_page_content',
        description: 'Get page content from the browser',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: {
              type: 'number',
              description: 'Optional tab ID to get content from'
            },
            format: {
              type: 'string',
              enum: ['text', 'html', 'markdown'],
              description: 'Content format'
            }
          }
        }
      },
      {
        name: 'brop_execute_script',
        description: 'Execute JavaScript in the browser',
        inputSchema: {
          type: 'object',
          properties: {
            script: {
              type: 'string',
              description: 'JavaScript code to execute'
            },
            tabId: {
              type: 'number',
              description: 'Optional tab ID to execute in'
            }
          },
          required: ['script']
        }
      },
      {
        name: 'brop_click_element',
        description: 'Click an element on the page',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the element to click'
            },
            tabId: {
              type: 'number',
              description: 'Optional tab ID'
            }
          },
          required: ['selector']
        }
      },
      {
        name: 'brop_type_text',
        description: 'Type text into an input field',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the input element'
            },
            text: {
              type: 'string',
              description: 'Text to type'
            },
            tabId: {
              type: 'number',
              description: 'Optional tab ID'
            }
          },
          required: ['selector', 'text']
        }
      }
    ];
  }

  /**
   * Handle MCP tool calls
   */
  async handleMCPToolCall(client, data) {
    const { name, arguments: args } = data.params;

    try {
      let result;

      if (this.isServerMode && this.bridgeServer) {
        // Server mode - use bridge server directly
        result = await this.executeBROPCommand(name, args);
      } else if (this.bropClient) {
        // Relay mode - send through BROP client
        result = await this.relayBROPCommand(name, args);
      } else {
        throw new Error('No BROP connection available');
      }

      this.sendMCPResponse(client, data.id, result);
    } catch (error) {
      this.logger.error('Tool call failed:', error);
      this.sendMCPError(client, data.id, -32000, error.message);
    }
  }

  /**
   * Execute BROP command in server mode
   */
  async executeBROPCommand(toolName, args) {
    // Convert MCP tool call to BROP command format
    const bropCommand = this.convertMCPToolToBROPCommand(toolName, args);

    // Execute command through bridge server extension client
    if (!this.bridgeServer.extensionClient) {
      throw new Error('Chrome extension not connected');
    }

    return new Promise((resolve, reject) => {
      const messageId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Set up response handler
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 10000);

      const responseHandler = (message) => {
        try {
          const data = JSON.parse(message);
          if (data.id === messageId) {
            clearTimeout(timeout);
            this.bridgeServer.extensionClient.off('message', responseHandler);

            if (data.success) {
              resolve(data.result);
            } else {
              reject(new Error(data.error || 'Command failed'));
            }
          }
        } catch (error) {
          // Ignore parse errors for other messages
        }
      };

      this.bridgeServer.extensionClient.on('message', responseHandler);

      // Send command
      const command = {
        ...bropCommand,
        id: messageId,
        type: 'brop_command'
      };

      this.bridgeServer.extensionClient.send(JSON.stringify(command));
    });
  }

  /**
   * Relay BROP command in relay mode
   */
  async relayBROPCommand(toolName, args) {
    if (!this.bropClient || this.bropClient.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to BROP server');
    }

    const bropCommand = this.convertMCPToolToBROPCommand(toolName, args);

    return new Promise((resolve, reject) => {
      const messageId = `mcp_relay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 10000);

      const responseHandler = (message) => {
        try {
          const data = JSON.parse(message);
          if (data.id === messageId) {
            clearTimeout(timeout);
            this.bropClient.off('message', responseHandler);

            if (data.success) {
              resolve(data.result);
            } else {
              reject(new Error(data.error || 'Command failed'));
            }
          }
        } catch (error) {
          // Ignore parse errors for other messages
        }
      };

      this.bropClient.on('message', responseHandler);

      // Send command
      const command = {
        ...bropCommand,
        id: messageId
      };

      this.bropClient.send(JSON.stringify(command));
    });
  }

  /**
   * Convert MCP tool call to BROP command format
   */
  convertMCPToolToBROPCommand(toolName, args) {
    switch (toolName) {
      case 'brop_navigate':
        return {
          method: 'navigate_to_url',
          params: {
            url: args.url,
            tab_id: args.tabId
          }
        };

      case 'brop_get_page_content':
        return {
          method: 'get_page_content',
          params: {
            tab_id: args.tabId,
            format: args.format || 'markdown'
          }
        };

      case 'brop_execute_script':
        return {
          method: 'execute_script',
          params: {
            script: args.script,
            tab_id: args.tabId
          }
        };

      case 'brop_click_element':
        return {
          method: 'click_element',
          params: {
            selector: args.selector,
            tab_id: args.tabId
          }
        };

      case 'brop_type_text':
        return {
          method: 'type_text',
          params: {
            selector: args.selector,
            text: args.text,
            tab_id: args.tabId
          }
        };

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Send MCP response
   */
  sendMCPResponse(client, id, result) {
    const response = {
      jsonrpc: '2.0',
      id: id,
      result: result
    };
    client.send(JSON.stringify(response));
  }

  /**
   * Send MCP error
   */
  sendMCPError(client, id, code, message) {
    const error = {
      jsonrpc: '2.0',
      id: id,
      error: {
        code: code,
        message: message
      }
    };
    client.send(JSON.stringify(error));
  }

  /**
   * Broadcast message to all MCP clients
   */
  broadcastToMCPClients(message) {
    if (!this.mcpClients) return;

    const messageStr = JSON.stringify(message);
    this.mcpClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Start the MCP BROP server
   */
  async start() {
    this.logger.log('🚀 Starting MCP BROP Server...');

    // Check if port 9223 is available
    const portAvailable = await this.checkPortAvailability(9223);

    if (portAvailable) {
      this.logger.log('✅ Port 9223 is available - starting in SERVER MODE');
      await this.startServerMode();
    } else {
      this.logger.log('🔗 Port 9223 is occupied - starting in RELAY MODE');
      await this.startRelayMode();
    }

    this.logger.success('MCP BROP Server started successfully!');
    this.logger.log(`📊 Mode: ${this.isServerMode ? 'SERVER' : 'RELAY'}`);
    this.logger.log('📡 MCP interface available on ws://localhost:3000');
  }

  /**
   * Shutdown the server
   */
  async shutdown() {
    this.logger.log('🛑 Shutting down MCP BROP Server...');

    if (this.mcpServer) {
      this.mcpServer.close();
    }

    if (this.bridgeServer) {
      await this.bridgeServer.shutdown();
    }

    if (this.bropClient) {
      this.bropClient.close();
    }

    this.logger.success('Shutdown complete');
  }
}

// Main function
async function main() {
  console.log('🌉 MCP BROP Server');
  console.log('=' + '='.repeat(50));
  console.log('Model Context Protocol interface for BROP');
  console.log('');

  const server = new MCPBROPServer();

  // Setup signal handlers
  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT');
    server.shutdown().then(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM');
    server.shutdown().then(() => process.exit(0));
  });

  try {
    await server.start();
  } catch (error) {
    console.error('💥 Server error:', error);
    process.exit(1);
  }
}

// Check dependencies
try {
  require('ws');
} catch (error) {
  console.error('❌ Missing dependencies. Please run: pnpm install');
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { MCPBROPServer };