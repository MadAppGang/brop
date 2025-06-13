#!/usr/bin/env node
/**
 * MCP BROP Server - STDIO Transport
 * 
 * Model Context Protocol server for Browser Remote Operations Protocol (BROP)
 * Uses STDIO transport for compatibility with MCP Inspector and other tools
 */

const net = require('node:net');
const WebSocket = require('ws');
const { BROPBridgeServer } = require('./bridge_server.js');

class MCPBROPStdioServer {
  constructor() {
    this.isServerMode = false;
    this.bridgeServer = null;
    this.bropClient = null;
    this.messageCounter = 0;
  }

  log(message) {
    // Log to stderr to avoid interfering with STDIO transport
    console.error(`[MCP-BROP] ${new Date().toISOString()} ${message}`);
  }

  sendMessage(message) {
    // Send to stdout for STDIO transport
    console.log(JSON.stringify(message));
  }

  sendError(id, code, message) {
    this.sendMessage({
      jsonrpc: '2.0',
      id: id,
      error: {
        code: code,
        message: message
      }
    });
  }

  sendResult(id, result) {
    this.sendMessage({
      jsonrpc: '2.0',
      id: id,
      result: result
    });
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
    this.log('Starting in SERVER MODE - will start BROP bridge servers');
    
    try {
      this.bridgeServer = new BROPBridgeServer({
        mcpMode: true,
        logToStderr: true
      });
      await this.bridgeServer.startServers();
      
      this.isServerMode = true;
      this.log('Server Mode: BROP bridge servers started successfully');
      
    } catch (error) {
      this.log(`Failed to start server mode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start in Relay Mode - connect to existing BROP server
   */
  async startRelayMode() {
    this.log('Starting in RELAY MODE - will connect to existing BROP server');
    
    try {
      await this.connectToBROPServer();
      this.isServerMode = false;
      this.log('Relay Mode: Connected to BROP server successfully');
      
    } catch (error) {
      this.log(`Failed to start relay mode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect to existing BROP server as a client
   */
  async connectToBROPServer() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:9223?name=mcp-stdio');
      
      ws.on('open', () => {
        this.log('Connected to BROP server as relay client');
        this.bropClient = ws;
        resolve();
      });
      
      ws.on('error', (error) => {
        this.log(`Failed to connect to BROP server: ${error.message}`);
        reject(error);
      });
      
      ws.on('close', () => {
        this.log('Connection to BROP server closed');
        this.bropClient = null;
      });
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.log(`Received from BROP server: ${data.type || data.method || 'unknown'}`);
        } catch (error) {
          this.log(`Error parsing BROP message: ${error.message}`);
        }
      });
    });
  }

  async initialize() {
    this.log('Initializing MCP BROP Server...');
    
    // Check if port 9223 is available
    const portAvailable = await this.checkPortAvailability(9223);
    
    if (portAvailable) {
      this.log('Port 9223 is available - starting in SERVER MODE');
      await this.startServerMode();
    } else {
      this.log('Port 9223 is occupied - starting in RELAY MODE');
      await this.startRelayMode();
    }
    
    this.log(`MCP BROP Server initialized in ${this.isServerMode ? 'SERVER' : 'RELAY'} mode`);
  }

  async handleMessage(message) {
    const { method, params, id } = message;

    try {
      switch (method) {
        case 'initialize':
          await this.initialize();
          this.sendResult(id, {
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
          });
          break;

        case 'notifications/initialized':
          // No response needed for notifications
          break;

        case 'ping':
          this.sendResult(id, {
            status: 'pong',
            timestamp: new Date().toISOString(),
            mode: this.isServerMode ? 'server' : 'relay',
            uptime: this.bridgeServer ? Date.now() - this.bridgeServer.startTime : null,
            connections: {
              extensionConnected: this.bridgeServer?.extensionClient != null,
              bropConnected: this.bropClient != null
            }
          });
          break;

        case 'tools/list':
          this.sendResult(id, {
            tools: this.getMCPTools()
          });
          break;

        case 'tools/call':
          const result = await this.handleToolCall(params);
          this.sendResult(id, result);
          break;

        default:
          this.sendError(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      this.log(`Error handling method ${method}: ${error.message}`);
      this.sendError(id, -32000, error.message);
    }
  }

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
        description: 'Get basic page content from the browser (raw HTML and text)',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: {
              type: 'number',
              description: 'Tab ID to get content from'
            }
          },
          required: ['tabId']
        }
      },
      {
        name: 'brop_get_simplified_content',
        description: 'Get simplified and cleaned page content in HTML or Markdown format',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: {
              type: 'number',
              description: 'Tab ID to get content from'
            },
            format: {
              type: 'string',
              enum: ['html', 'markdown'],
              description: 'Output format - html (using Readability) or markdown (semantic conversion)'
            },
            enableDetailedResponse: {
              type: 'boolean',
              description: 'Include detailed extraction statistics and metadata'
            }
          },
          required: ['tabId', 'format']
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
      },
      {
        name: 'brop_create_page',
        description: 'Create a new browser page/tab',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Optional URL to navigate to in the new page (defaults to about:blank)'
            },
            active: {
              type: 'boolean',
              description: 'Whether to make the new tab active (defaults to true)'
            }
          }
        }
      },
      {
        name: 'brop_close_tab',
        description: 'Close a browser tab',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: {
              type: 'number',
              description: 'ID of the tab to close'
            }
          },
          required: ['tabId']
        }
      },
      {
        name: 'brop_list_tabs',
        description: 'List all open browser tabs',
        inputSchema: {
          type: 'object',
          properties: {
            windowId: {
              type: 'number',
              description: 'Optional window ID to filter tabs (if not provided, lists tabs from all windows)'
            },
            includeContent: {
              type: 'boolean',
              description: 'Whether to include page content in the response (defaults to false)'
            }
          }
        }
      },
      {
        name: 'brop_activate_tab',
        description: 'Switch to/activate a specific browser tab',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: {
              type: 'number',
              description: 'ID of the tab to activate'
            }
          },
          required: ['tabId']
        }
      },
      {
        name: 'brop_get_server_status',
        description: 'Get BROP server status and connection info',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  async handleToolCall(params) {
    const { name, arguments: args } = params;

    try {
      switch (name) {
        case 'brop_get_server_status':
          return {
            mode: this.isServerMode ? 'server' : 'relay',
            status: 'running',
            bropPort: 9223,
            extensionPort: 9224,
            hasExtensionConnection: this.bridgeServer?.extensionClient != null,
            hasBropConnection: this.bropClient != null
          };

        case 'brop_navigate':
        case 'brop_get_page_content':
        case 'brop_get_simplified_content':
        case 'brop_execute_script':
        case 'brop_click_element':
        case 'brop_type_text':
        case 'brop_create_page':
        case 'brop_close_tab':
        case 'brop_list_tabs':
        case 'brop_activate_tab':
          return await this.executeBROPCommand(name, args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  async executeBROPCommand(toolName, args) {
    const bropCommand = this.convertMCPToolToBROPCommand(toolName, args);
    
    if (this.isServerMode && this.bridgeServer?.extensionClient) {
      // Server mode - use bridge server directly
      return await this.executeCommandInServerMode(bropCommand);
    } else if (this.bropClient && this.bropClient.readyState === WebSocket.OPEN) {
      // Relay mode - send through BROP client
      return await this.executeCommandInRelayMode(bropCommand);
    } else {
      throw new Error('No BROP connection available');
    }
  }

  async executeCommandInServerMode(bropCommand) {
    if (!this.bridgeServer?.extensionClient) {
      throw new Error('Chrome extension not connected');
    }

    return new Promise((resolve, reject) => {
      const messageId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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

      const command = {
        ...bropCommand,
        id: messageId,
        type: 'brop_command'
      };

      this.bridgeServer.extensionClient.send(JSON.stringify(command));
    });
  }

  async executeCommandInRelayMode(bropCommand) {
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

      const command = {
        ...bropCommand,
        id: messageId
      };

      this.bropClient.send(JSON.stringify(command));
    });
  }

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
            tabId: args.tabId
          }
        };
      
      case 'brop_get_simplified_content':
        return {
          method: 'get_simplified_dom',
          params: {
            tabId: args.tabId,
            format: args.format,
            enableDetailedResponse: args.enableDetailedResponse || false
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
      
      case 'brop_create_page':
        return {
          method: 'create_tab',
          params: {
            url: args.url || 'about:blank',
            active: args.active !== false  // Default to true unless explicitly false
          }
        };
      
      case 'brop_close_tab':
        return {
          method: 'close_tab',
          params: {
            tabId: args.tabId
          }
        };
      
      case 'brop_list_tabs':
        return {
          method: 'list_tabs',
          params: {
            include_content: args.includeContent || false
          }
        };
      
      case 'brop_activate_tab':
        return {
          method: 'activate_tab',
          params: {
            tabId: args.tabId
          }
        };
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async start() {
    this.log('Starting MCP BROP STDIO Server...');

    // Set up STDIO message handling
    process.stdin.setEncoding('utf8');
    
    let buffer = '';
    process.stdin.on('readable', () => {
      let chunk;
      while (null !== (chunk = process.stdin.read())) {
        buffer += chunk;
        
        // Process complete JSON messages
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          
          if (line) {
            try {
              const message = JSON.parse(line);
              this.handleMessage(message);
            } catch (error) {
              this.log(`Failed to parse message: ${error.message}`);
              this.sendError(null, -32700, 'Parse error');
            }
          }
        }
      }
    });

    process.stdin.on('end', () => {
      this.log('STDIN closed, shutting down...');
      this.shutdown();
    });

    // Handle process signals
    process.on('SIGINT', () => {
      this.log('Received SIGINT, shutting down...');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      this.log('Received SIGTERM, shutting down...');
      this.shutdown();
    });

    this.log('MCP BROP STDIO Server ready and listening for messages');
  }

  async shutdown() {
    this.log('Shutting down MCP BROP Server...');
    
    if (this.bridgeServer) {
      await this.bridgeServer.shutdown();
    }
    
    if (this.bropClient) {
      this.bropClient.close();
    }
    
    process.exit(0);
  }
}

// Main execution
async function main() {
  const server = new MCPBROPStdioServer();
  
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start MCP BROP STDIO Server:', error);
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

module.exports = { MCPBROPStdioServer };