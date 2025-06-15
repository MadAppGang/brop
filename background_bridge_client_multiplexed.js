// Browser Remote Operations Protocol - Multiplexed Background Script
// This version implements the complete BROP multiplexing architecture:
// 1. BROP_NATIVE commands → Execute via extension APIs
// 2. BROP_CDP commands → Forward to real Chrome CDP

class BROPMultiplexedClient {
  constructor() {
    this.bridgeSocket = null;
    this.realChromeConnection = null;
    this.reconnectAttempts = 0;
    this.connectionStatus = 'disconnected';
    this.isConnected = false;
    this.enabled = true;
    
    // Real Chrome CDP connection
    this.realChromeUrl = 'ws://localhost:9223'; // Real Chrome on different port
    this.realChromePendingRequests = new Map(); // messageId -> { bridgeMessageId, connectionId }
    
    this.bridgeUrl = 'ws://localhost:9224'; // Extension server port
    
    // Error collection
    this.extensionErrors = [];
    this.maxErrorEntries = 100;
    
    // BROP message handlers (for native commands)
    this.messageHandlers = new Map();
    this.setupBropHandlers();
    this.setupErrorHandlers();
    this.connectToBridge();
    this.connectToRealChrome();
  }

  setupBropHandlers() {
    // Native BROP command handlers (unchanged)
    this.messageHandlers.set('get_console_logs', this.handleGetConsoleLogs.bind(this));
    this.messageHandlers.set('execute_console', this.handleExecuteConsole.bind(this));
    this.messageHandlers.set('get_screenshot', this.handleGetScreenshot.bind(this));
    this.messageHandlers.set('get_page_content', this.handleGetPageContent.bind(this));
    this.messageHandlers.set('navigate', this.handleNavigate.bind(this));
    this.messageHandlers.set('click', this.handleClick.bind(this));
    this.messageHandlers.set('type', this.handleType.bind(this));
    this.messageHandlers.set('create_tab', this.handleCreateTab.bind(this));
    this.messageHandlers.set('close_tab', this.handleCloseTab.bind(this));
    this.messageHandlers.set('list_tabs', this.handleListTabs.bind(this));
    this.messageHandlers.set('get_extension_errors', this.handleGetExtensionErrors.bind(this));
    this.messageHandlers.set('reload_extension', this.handleReloadExtension.bind(this));
  }

  setupErrorHandlers() {
    // Enhanced error capture system (unchanged)
    self.addEventListener('error', (event) => {
      this.logError('Uncaught Error', event.error?.message || event.message, event.error?.stack);
    });

    self.addEventListener('unhandledrejection', (event) => {
      this.logError('Unhandled Promise Rejection', event.reason?.message || String(event.reason), event.reason?.stack);
    });
  }

  logError(type, message, stack = null) {
    const errorEntry = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: type,
      message: message,
      stack: stack,
      url: globalThis.location?.href || 'Extension Background'
    };

    this.extensionErrors.unshift(errorEntry);
    if (this.extensionErrors.length > this.maxErrorEntries) {
      this.extensionErrors = this.extensionErrors.slice(0, this.maxErrorEntries);
    }

    console.error(`[BROP Error] ${type}: ${message}`, stack ? `\nStack: ${stack}` : '');
  }

  async connectToBridge() {
    try {
      console.log('🔗 Connecting to multiplexed bridge server...');
      this.bridgeSocket = new WebSocket(this.bridgeUrl);

      this.bridgeSocket.onopen = () => {
        console.log('✅ Connected to multiplexed bridge server');
        this.isConnected = true;
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
      };

      this.bridgeSocket.onmessage = (event) => {
        this.handleBridgeMessage(event.data);
      };

      this.bridgeSocket.onclose = () => {
        console.log('🔌 Bridge connection closed');
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
        this.scheduleReconnect();
      };

      this.bridgeSocket.onerror = (error) => {
        console.error('❌ Bridge connection error:', error);
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
      };

    } catch (error) {
      console.error('Failed to connect to bridge:', error);
      this.scheduleReconnect();
    }
  }

  async connectToRealChrome() {
    try {
      // Get real Chrome WebSocket URL
      const response = await fetch('http://localhost:9223/json/version');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      this.realChromeUrl = data.webSocketDebuggerUrl;
      
      console.log('🔗 Connecting to real Chrome CDP:', this.realChromeUrl);
      this.realChromeConnection = new WebSocket(this.realChromeUrl);

      this.realChromeConnection.onopen = () => {
        console.log('✅ Connected to real Chrome CDP');
      };

      this.realChromeConnection.onmessage = (event) => {
        this.handleRealChromeMessage(event.data);
      };

      this.realChromeConnection.onclose = () => {
        console.log('🔌 Real Chrome CDP connection closed');
        this.realChromeConnection = null;
        // Retry connection after delay
        setTimeout(() => this.connectToRealChrome(), 5000);
      };

      this.realChromeConnection.onerror = (error) => {
        console.error('❌ Real Chrome CDP error:', error);
      };

    } catch (error) {
      console.log('⚠️ Cannot connect to real Chrome:', error.message);
      console.log('💡 Start Chrome with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9223 --headless');
      // Retry connection after delay
      setTimeout(() => this.connectToRealChrome(), 10000);
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < 10) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`🔄 Reconnecting to bridge in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connectToBridge(), delay);
    }
  }

  async handleBridgeMessage(data) {
    try {
      const message = JSON.parse(data);
      const messageType = message.type;

      console.log('📥 Bridge message type:', messageType);

      if (messageType === 'welcome') {
        console.log('👋 Bridge welcome:', message.message);
        return;
      }

      if (messageType === 'brop_command') {
        // Native BROP command - handle via extension APIs
        await this.processBROPNativeCommand(message);
      } else if (messageType === 'BROP_CDP') {
        // Wrapped CDP command - forward to real Chrome
        await this.processBROPCDPCommand(message);
      } else {
        console.warn('Unknown message type from bridge:', messageType);
      }
    } catch (error) {
      console.error('Error handling bridge message:', error);
    }
  }

  async processBROPNativeCommand(message) {
    const { id, method, params } = message;
    
    console.log('🔧 Processing BROP native command:', method);

    if (!this.enabled) {
      this.sendToBridge({
        type: 'response',
        id: id,
        success: false,
        error: 'BROP service is disabled'
      });
      return;
    }

    try {
      const handler = this.messageHandlers.get(method);
      if (handler) {
        const result = await handler(params || {});
        
        this.sendToBridge({
          type: 'response',
          id: id,
          success: true,
          result: result
        });
      } else {
        throw new Error(`Unsupported BROP command: ${method}`);
      }
    } catch (error) {
      console.error(`BROP command error (${method}):`, error);
      this.logError('BROP Command Error', `${method}: ${error.message}`, error.stack);

      this.sendToBridge({
        type: 'response',
        id: id,
        success: false,
        error: error.message
      });
    }
  }

  async processBROPCDPCommand(message) {
    const { id, method, params, sessionId, connectionId, originalCommand } = message;
    
    console.log('🎭 Processing wrapped CDP command:', { method, id, connectionId, sessionId });

    // Check if real Chrome is available
    if (!this.realChromeConnection || this.realChromeConnection.readyState !== WebSocket.OPEN) {
      console.log('⚠️ Real Chrome not available, handling via extension fallback');
      await this.handleCDPFallback(message);
      return;
    }

    try {
      // Generate a new ID for the real Chrome request to avoid conflicts
      const realChromeId = this.generateRealChromeId();
      
      // Store mapping for response routing
      this.realChromePendingRequests.set(realChromeId, {
        bridgeMessageId: id,
        connectionId: connectionId,
        originalMethod: method
      });

      // Forward to real Chrome with new ID
      const realChromeCommand = {
        id: realChromeId,
        method: method,
        params: params || {}
      };

      if (sessionId) {
        realChromeCommand.sessionId = sessionId;
      }

      console.log(`🔄 Forwarding ${method} to real Chrome (${realChromeId} -> ${id})`);
      this.realChromeConnection.send(JSON.stringify(realChromeCommand));

    } catch (error) {
      console.error(`CDP forwarding error (${method}):`, error);
      
      this.sendToBridge({
        type: 'response',
        id: id,
        error: { 
          code: -32603, 
          message: `CDP forwarding failed: ${error.message}` 
        }
      });
    }
  }

  handleRealChromeMessage(data) {
    try {
      const message = JSON.parse(data);
      
      if (message.id) {
        // This is a response to a command we forwarded
        const requestInfo = this.realChromePendingRequests.get(message.id);
        if (requestInfo) {
          this.realChromePendingRequests.delete(message.id);
          
          console.log(`📥 Real Chrome response for ${requestInfo.originalMethod} (${message.id} -> ${requestInfo.bridgeMessageId})`);
          
          // Route response back to bridge with original ID
          this.sendToBridge({
            type: 'response',
            id: requestInfo.bridgeMessageId,
            result: message.result,
            error: message.error
          });
        } else {
          console.log('🤷 Received Chrome response for unknown request:', message.id);
        }
      } else if (message.method) {
        // This is an event from Chrome - send to bridge
        console.log(`📡 Real Chrome event: ${message.method}`);
        this.sendToBridge({
          type: 'cdp_event',
          method: message.method,
          params: message.params
        });
      }
      
    } catch (error) {
      console.error('Error handling real Chrome message:', error);
    }
  }

  async handleCDPFallback(message) {
    // Fallback for when real Chrome is not available
    // Handle some basic commands via extension APIs
    const { id, method, params } = message;
    
    console.log(`🔄 CDP fallback for ${method}`);
    
    try {
      let result = null;

      if (method === 'Browser.getVersion') {
        result = {
          protocolVersion: '1.3',
          product: `Chrome/${navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'unknown'}`,
          revision: '@' + Date.now(),
          userAgent: navigator.userAgent,
          jsVersion: '12.0.0'
        };
      } else if (method === 'Target.createTarget') {
        const { url = 'about:blank' } = params;
        const tab = await chrome.tabs.create({ url: url, active: false });
        result = { targetId: `tab_${tab.id}` };
      } else {
        throw new Error(`CDP fallback not implemented for ${method}`);
      }

      this.sendToBridge({
        type: 'response',
        id: id,
        result: result
      });

    } catch (error) {
      this.sendToBridge({
        type: 'response',
        id: id,
        error: { 
          code: -32603, 
          message: `CDP fallback failed: ${error.message}` 
        }
      });
    }
  }

  generateRealChromeId() {
    return Math.floor(Math.random() * 1000000);
  }

  sendToBridge(message) {
    if (this.isConnected && this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
      this.bridgeSocket.send(JSON.stringify(message));
    } else {
      console.error('Cannot send to bridge: not connected');
    }
  }

  // BROP Native Command Implementations (examples)
  async handleCreateTab(params) {
    const { url = 'about:blank', active = false } = params;
    const tab = await chrome.tabs.create({ url, active });
    return {
      tabId: tab.id,
      tab: {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        active: tab.active
      }
    };
  }

  async handleCloseTab(params) {
    const { tabId } = params;
    if (!tabId) throw new Error('tabId is required');
    
    await chrome.tabs.remove(tabId);
    return { success: true, tabId };
  }

  async handleListTabs(params) {
    const tabs = await chrome.tabs.query({});
    return {
      tabs: tabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        active: tab.active,
        pinned: tab.pinned
      }))
    };
  }

  async handleGetExtensionErrors(params) {
    const { limit = 50 } = params;
    return {
      errors: this.extensionErrors.slice(0, limit),
      total: this.extensionErrors.length
    };
  }

  async handleReloadExtension(params) {
    setTimeout(() => {
      chrome.runtime.reload();
    }, 1000);
    
    return {
      message: 'Extension will reload in 1 second',
      timestamp: Date.now()
    };
  }

  // Additional BROP handlers would go here...
  async handleGetConsoleLogs(params) {
    // Implementation for console logs
    return { logs: [], message: 'Console logs not implemented in multiplexed version' };
  }

  async handleExecuteConsole(params) {
    // Implementation for console execution
    return { result: null, message: 'Console execution not implemented in multiplexed version' };
  }

  async handleGetScreenshot(params) {
    // Implementation for screenshots
    return { screenshot: null, message: 'Screenshot not implemented in multiplexed version' };
  }

  async handleGetPageContent(params) {
    // Implementation for page content
    return { content: '', message: 'Page content not implemented in multiplexed version' };
  }

  async handleNavigate(params) {
    // Implementation for navigation
    return { success: false, message: 'Navigation not implemented in multiplexed version' };
  }

  async handleClick(params) {
    // Implementation for clicking
    return { success: false, message: 'Click not implemented in multiplexed version' };
  }

  async handleType(params) {
    // Implementation for typing
    return { success: false, message: 'Type not implemented in multiplexed version' };
  }
}

// Initialize the multiplexed client
const bropClient = new BROPMultiplexedClient();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BROPMultiplexedClient;
}