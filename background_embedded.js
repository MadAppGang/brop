// Browser Remote Operations Protocol - Background Script with Embedded CDP Server
// This version includes everything in the Chrome extension without external servers

class EmbeddedBROPServer {
  constructor() {
    this.sessions = new Map();
    this.messageHandlers = new Map();
    this.nativePort = null;
    this.enabled = true;
    this.callLogs = [];
    this.maxLogEntries = 1000;
    this.setupMessageHandlers();
    this.loadSettings();
    this.startEmbeddedServer();
    this.setupPlaywrightBridge();
  }

  setupMessageHandlers() {
    this.messageHandlers.set('get_console_logs', this.handleGetConsoleLogs.bind(this));
    this.messageHandlers.set('execute_console', this.handleExecuteConsole.bind(this));
    this.messageHandlers.set('get_screenshot', this.handleGetScreenshot.bind(this));
    this.messageHandlers.set('get_page_content', this.handleGetPageContent.bind(this));
    this.messageHandlers.set('navigate', this.handleNavigate.bind(this));
    this.messageHandlers.set('click', this.handleClick.bind(this));
    this.messageHandlers.set('type', this.handleType.bind(this));
    this.messageHandlers.set('wait_for_element', this.handleWaitForElement.bind(this));
    this.messageHandlers.set('evaluate_js', this.handleEvaluateJS.bind(this));
    this.messageHandlers.set('get_element', this.handleGetElement.bind(this));
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['brop_enabled', 'brop_logs']);
      this.enabled = result.brop_enabled !== false; // Default to enabled
      this.callLogs = result.brop_logs || [];
      console.log(`BROP service loaded: ${this.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error loading BROP settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({
        'brop_enabled': this.enabled,
        'brop_logs': this.callLogs.slice(-this.maxLogEntries) // Keep only recent logs
      });
    } catch (error) {
      console.error('Error saving BROP settings:', error);
    }
  }

  logCall(type, method, params, result, error = null, duration = 0) {
    const logEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type: type, // 'BROP' or 'CDP'
      method: method,
      params: this.sanitizeLogData(params),
      result: error ? null : this.sanitizeLogData(result),
      error: error,
      duration: duration,
      success: !error
    };

    this.callLogs.push(logEntry);
    
    // Keep only recent logs in memory
    if (this.callLogs.length > this.maxLogEntries) {
      this.callLogs = this.callLogs.slice(-this.maxLogEntries);
    }

    // Save to storage (debounced)
    this.debouncedSave();

    // Notify popup if it's open
    this.notifyPopupOfNewLog(logEntry);

    console.log(`BROP ${type} call: ${method}`, logEntry);
  }

  sanitizeLogData(data) {
    if (!data) return data;
    
    // Convert to string and limit size for storage
    let sanitized = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Truncate very long data
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000) + '... [truncated]';
    }
    
    return sanitized;
  }

  debouncedSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSettings();
    }, 1000);
  }

  notifyPopupOfNewLog(logEntry) {
    // Try to notify popup about new log entry
    chrome.runtime.sendMessage({
      type: 'NEW_LOG_ENTRY',
      log: logEntry
    }).catch(() => {
      // Popup might not be open, ignore error
    });
  }

  async setEnabled(enabled) {
    this.enabled = enabled;
    await this.saveSettings();
    
    this.logCall('SYSTEM', 'service_toggle', { enabled }, { success: true });
    
    console.log(`BROP service ${enabled ? 'enabled' : 'disabled'}`);
  }

  clearLogs() {
    this.callLogs = [];
    this.saveSettings();
    console.log('BROP logs cleared');
  }

  getRecentLogs(limit = 50) {
    return this.callLogs.slice(-limit).reverse(); // Most recent first
  }

  async startEmbeddedServer() {
    console.log('BROP Embedded Server starting...');
    
    // Listen for external connections via various methods
    this.setupNativeMessaging();
    this.setupRuntimeMessaging();
    this.createVirtualCDPServer();
  }

  setupNativeMessaging() {
    // Set up native messaging for external applications
    try {
      chrome.runtime.onConnectExternal.addListener((port) => {
        console.log('External connection established via native messaging');
        this.handleConnection(port);
      });
    } catch (error) {
      console.log('Native messaging not available:', error);
    }
  }

  setupRuntimeMessaging() {
    // Listen for messages from content scripts and external sources
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleRuntimeMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Listen for external messages (from web pages)
    chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
      console.log('External message received:', message);
      this.handleExternalMessage(message, sender, sendResponse);
      return true;
    });
  }

  createVirtualCDPServer() {
    // Create a virtual CDP server that can be accessed via chrome.runtime
    // This allows external applications to connect via chrome.runtime.sendMessage
    console.log('Virtual CDP server created - accessible via chrome.runtime messaging');
    
    // Store server info in chrome.storage for external access
    chrome.storage.local.set({
      'brop_server_info': {
        type: 'embedded',
        version: '1.0.0',
        protocol: 'chrome.runtime',
        capabilities: ['Page', 'Runtime', 'DOM', 'Input', 'Network'],
        targets: [{
          id: 'default-target',
          title: 'BROP Extension Target',
          type: 'page',
          url: 'chrome-extension://brop'
        }]
      }
    });
  }

  setupPlaywrightBridge() {
    // Create a CDP-compatible interface for Playwright
    this.cdpHandlers = new Map([
      ['Runtime.enable', this.cdpRuntimeEnable.bind(this)],
      ['Page.enable', this.cdpPageEnable.bind(this)],
      ['Network.enable', this.cdpNetworkEnable.bind(this)],
      ['Page.navigate', this.cdpPageNavigate.bind(this)],
      ['Runtime.evaluate', this.cdpRuntimeEvaluate.bind(this)],
      ['Page.captureScreenshot', this.cdpPageCaptureScreenshot.bind(this)],
      ['DOM.getDocument', this.cdpDOMGetDocument.bind(this)],
      ['DOM.querySelector', this.cdpDOMQuerySelector.bind(this)],
      ['Input.dispatchMouseEvent', this.cdpInputDispatchMouseEvent.bind(this)],
      ['Input.insertText', this.cdpInputInsertText.bind(this)]
    ]);
  }

  handleConnection(port) {
    const clientId = Date.now().toString();
    this.sessions.set(clientId, { port, type: 'external' });

    port.onMessage.addListener((data) => {
      this.handleMessage(clientId, data);
    });

    port.onDisconnect.addListener(() => {
      this.sessions.delete(clientId);
      console.log(`Client ${clientId} disconnected`);
    });

    console.log(`Client ${clientId} connected`);
  }

  async handleMessage(clientId, data) {
    try {
      let message;
      
      // Handle both JSON and protobuf messages
      if (typeof data === 'string') {
        message = JSON.parse(data);
      } else if (data.id && (data.command || data.method)) {
        message = data;
      } else {
        // Assume protobuf binary data
        throw new Error('Protobuf decoding not implemented in this simplified version');
      }

      let response;
      
      // Check if it's a CDP message (has 'method') or BROP message (has 'command')
      if (message.method) {
        response = await this.processCDPCommand(message);
      } else if (message.command) {
        response = await this.processBROPCommand(message.id, message.command);
      } else {
        throw new Error('Unknown message format');
      }
      
      // Send response back to client
      const session = this.sessions.get(clientId);
      if (session && session.port) {
        session.port.postMessage(response);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendErrorResponse(clientId, data.id || 'unknown', error.message);
    }
  }

  async handleRuntimeMessage(message, sender, sendResponse) {
    // Handle popup/UI messages first
    if (message.type === 'GET_LOGS') {
      sendResponse({ logs: this.getRecentLogs(message.limit) });
      return;
    } else if (message.type === 'CLEAR_LOGS') {
      this.clearLogs();
      sendResponse({ success: true });
      return;
    } else if (message.type === 'SET_ENABLED') {
      await this.setEnabled(message.enabled);
      sendResponse({ success: true, enabled: this.enabled });
      return;
    } else if (message.type === 'GET_STATUS') {
      sendResponse({ 
        enabled: this.enabled, 
        totalLogs: this.callLogs.length,
        activeSessions: this.sessions.size 
      });
      return;
    }

    // Check if service is enabled for automation commands
    if (!this.enabled && (message.type === 'BROP_COMMAND' || message.type === 'CDP_COMMAND')) {
      sendResponse({ success: false, error: 'BROP service is disabled' });
      return;
    }

    if (message.type === 'BROP_COMMAND') {
      const startTime = Date.now();
      try {
        const response = await this.processBROPCommand(message.id, message.command);
        const duration = Date.now() - startTime;
        this.logCall('BROP', message.command.type || 'unknown', message.command.params, response, null, duration);
        sendResponse({ success: true, response });
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logCall('BROP', message.command.type || 'unknown', message.command.params, null, error.message, duration);
        sendResponse({ success: false, error: error.message });
      }
    } else if (message.type === 'CDP_COMMAND') {
      const startTime = Date.now();
      try {
        const response = await this.processCDPCommand(message);
        const duration = Date.now() - startTime;
        this.logCall('CDP', message.method, message.params, response, null, duration);
        sendResponse(response);
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logCall('CDP', message.method, message.params, null, error.message, duration);
        sendResponse({
          id: message.id,
          error: { code: -1, message: error.message }
        });
      }
    } else if (message.type === 'PLAYWRIGHT_CONNECT') {
      // Handle Playwright connection requests
      const targets = await this.getTargets();
      sendResponse({
        success: true,
        targets: targets,
        webSocketDebuggerUrl: 'chrome-extension://runtime-messaging'
      });
    }
  }

  async handleExternalMessage(message, sender, sendResponse) {
    // Handle messages from external web pages or applications
    if (message.type === 'CDP_DISCOVER') {
      sendResponse({
        Browser: 'BROP-Extension/1.0.0',
        'Protocol-Version': '1.3',
        'User-Agent': 'Mozilla/5.0 (BROP Extension) Chrome/120.0.0.0',
        webSocketDebuggerUrl: 'chrome-extension://runtime-messaging'
      });
    } else if (message.type === 'CDP_LIST_TARGETS') {
      const targets = await this.getTargets();
      sendResponse(targets);
    } else {
      // Forward other messages to the main handler
      await this.handleRuntimeMessage(message, sender, sendResponse);
    }
  }

  async getTargets() {
    const tabs = await chrome.tabs.query({});
    return tabs.map(tab => ({
      id: tab.id.toString(),
      title: tab.title,
      type: 'page',
      url: tab.url,
      webSocketDebuggerUrl: `chrome-extension://tab/${tab.id}`
    }));
  }

  // CDP Command Handlers
  async processCDPCommand(message) {
    const method = message.method;
    const params = message.params || {};
    const id = message.id;

    const handler = this.cdpHandlers.get(method);
    if (handler) {
      try {
        const result = await handler(params);
        return { id, result };
      } catch (error) {
        return {
          id,
          error: { code: -1, message: error.message }
        };
      }
    } else {
      console.warn(`Unhandled CDP method: ${method}`);
      return { id, result: {} };
    }
  }

  async cdpRuntimeEnable(params) {
    return {};
  }

  async cdpPageEnable(params) {
    return {};
  }

  async cdpNetworkEnable(params) {
    return {};
  }

  async cdpPageNavigate(params) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) throw new Error('No active tab');

    await chrome.tabs.update(activeTab.id, { url: params.url });
    
    return {
      frameId: activeTab.id.toString(),
      loaderId: Date.now().toString()
    };
  }

  async cdpRuntimeEvaluate(params) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) throw new Error('No active tab');

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (expression) => {
        try {
          const result = eval(expression);
          return { success: true, result: result, type: typeof result };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      args: [params.expression]
    });

    const result = results[0].result;
    if (result.success) {
      return {
        result: {
          type: result.type,
          value: result.result
        }
      };
    } else {
      return {
        exceptionDetails: {
          text: result.error
        }
      };
    }
  }

  async cdpPageCaptureScreenshot(params) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) throw new Error('No active tab');

    const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: params.format || 'png',
      quality: params.quality || 90
    });

    // Return base64 data without the data URL prefix
    const base64Data = dataUrl.split(',')[1];
    return { data: base64Data };
  }

  async cdpDOMGetDocument(params) {
    return {
      root: {
        nodeId: 1,
        nodeType: 9,
        nodeName: '#document',
        childNodeCount: 1
      }
    };
  }

  async cdpDOMQuerySelector(params) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) throw new Error('No active tab');

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (selector) => {
        const element = document.querySelector(selector);
        return element ? 2 : 0; // Return node ID or 0 if not found
      },
      args: [params.selector]
    });

    return { nodeId: results[0].result };
  }

  async cdpInputDispatchMouseEvent(params) {
    if (params.type === 'mousePressed') {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) throw new Error('No active tab');

      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (x, y) => {
          const element = document.elementFromPoint(x, y);
          if (element) {
            element.click();
          }
        },
        args: [params.x, params.y]
      });
    }
    return {};
  }

  async cdpInputInsertText(params) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) throw new Error('No active tab');

    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (text) => {
        if (document.activeElement && 
            (document.activeElement.tagName === 'INPUT' || 
             document.activeElement.tagName === 'TEXTAREA' ||
             document.activeElement.contentEditable === 'true')) {
          
          if (document.activeElement.value !== undefined) {
            document.activeElement.value += text;
            document.activeElement.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            document.activeElement.textContent += text;
          }
        }
      },
      args: [params.text]
    });

    return {};
  }

  // BROP Command Processing (existing methods)
  async processBROPCommand(messageId, command) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    const commandType = this.getBROPCommandType(command);
    const handler = this.messageHandlers.get(commandType);
    
    if (!handler) {
      throw new Error(`Unknown command type: ${commandType}`);
    }

    return await handler(activeTab, command);
  }

  getBROPCommandType(command) {
    if (command.type) return command.type;
    
    // Legacy format support
    if (command.getGetConsoleLogs) return 'get_console_logs';
    if (command.getExecuteConsole) return 'execute_console';
    if (command.getGetScreenshot) return 'get_screenshot';
    if (command.getGetPageContent) return 'get_page_content';
    if (command.getNavigate) return 'navigate';
    if (command.getClick) return 'click';
    if (command.getType) return 'type';
    if (command.getWaitForElement) return 'wait_for_element';
    if (command.getEvaluateJs) return 'evaluate_js';
    if (command.getGetElement) return 'get_element';
    
    throw new Error('Unknown command type');
  }

  // Existing BROP handlers (simplified versions)
  async handleGetConsoleLogs(tab, command) {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'BROP_EXECUTE',
      command: { type: 'get_console_logs', params: command.params || {} }
    });
    return { success: true, result: response.result };
  }

  async handleExecuteConsole(tab, command) {
    const code = command.params?.code || command.getCode?.() || '';
    
    // Check if tab URL is restricted
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      throw new Error(`Cannot access a ${tab.url.split('://')[0]}:// URL - Chrome restricts script execution on internal pages`);
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (code) => {
          try {
            const result = eval(code);
            return { success: true, result: String(result) };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        args: [code]
      });

      const result = results[0].result;
      return {
        success: result.success,
        result: { result: result.result, error: result.error }
      };
    } catch (error) {
      // Handle Chrome scripting API errors
      if (error.message.includes('Cannot access')) {
        throw new Error(`Cannot execute scripts on this page (${tab.url}). Try opening a regular website like google.com`);
      }
      throw error;
    }
  }

  async handleGetScreenshot(tab, command) {
    const params = command.params || {};
    
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: params.format || 'png',
      quality: params.quality || 90
    });
    
    const base64Data = dataUrl.split(',')[1];
    
    return {
      success: true,
      result: {
        image_data: base64Data,
        format: params.format || 'png'
      }
    };
  }

  async handleGetPageContent(tab, command) {
    const params = command.params || {};
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (includeHtml, includeText, includeMeta) => {
        const result = {};
        
        if (includeHtml) result.html = document.documentElement.outerHTML;
        if (includeText) result.text = document.body.innerText;
        if (includeMeta) {
          result.title = document.title;
          result.url = window.location.href;
          result.links = Array.from(document.links).map(l => l.href);
          result.images = Array.from(document.images).map(i => i.src);
        }
        
        return result;
      },
      args: [params.include_html, params.include_text, params.include_metadata]
    });

    return { success: true, result: results[0].result };
  }

  async handleNavigate(tab, command) {
    const url = command.params?.url || command.getUrl?.() || '';
    
    await chrome.tabs.update(tab.id, { url });
    
    const updatedTab = await chrome.tabs.get(tab.id);
    
    return {
      success: true,
      result: {
        final_url: updatedTab.url,
        title: updatedTab.title,
        loaded: updatedTab.status === 'complete'
      }
    };
  }

  // Placeholder implementations for other handlers
  async handleClick(tab, command) {
    return { success: false, error: 'Click command requires content script implementation' };
  }

  async handleType(tab, command) {
    return { success: false, error: 'Type command requires content script implementation' };
  }

  async handleWaitForElement(tab, command) {
    return { success: false, error: 'Wait for element command requires content script implementation' };
  }

  async handleEvaluateJS(tab, command) {
    return await this.handleExecuteConsole(tab, command);
  }

  async handleGetElement(tab, command) {
    return { success: false, error: 'Get element command requires content script implementation' };
  }

  sendErrorResponse(clientId, messageId, error) {
    const response = {
      id: messageId,
      success: false,
      error: error
    };
    
    const session = this.sessions.get(clientId);
    if (session && session.port) {
      session.port.postMessage(response);
    }
  }
}

// Initialize the embedded BROP server
const embeddedBropServer = new EmbeddedBROPServer();

// Expose API for debugging
globalThis.BROP = embeddedBropServer;

console.log('BROP Extension with embedded CDP server loaded');

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmbeddedBROPServer;
}