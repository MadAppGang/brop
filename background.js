// Browser Remote Operations Protocol - Background Service Worker
import { BrowserMessage, Command, Response, ConsoleLogsResponse, ScreenshotResponse, PageContentResponse } from './generated/browser_commands_pb.js';

class BROPServer {
  constructor() {
    this.port = 8765;
    this.clients = new Map();
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
    this.startServer();
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

  async startServer() {
    // Chrome extensions can't create WebSocket servers directly
    // Instead, we'll use chrome.runtime messaging and expose a bridge
    console.log('BROP Server starting - listening for external connections');
    
    // Listen for external connections (from native messaging or web page)
    chrome.runtime.onConnectExternal.addListener((port) => {
      console.log('External connection established');
      this.handleConnection(port);
    });

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleRuntimeMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Create a simple HTTP server endpoint via chrome.debugger
    this.setupDebuggerEndpoint();
  }

  async setupDebuggerEndpoint() {
    // This creates a WebSocket-like interface using Chrome's debugging protocol
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.notifyTabReady(tabId, tab);
      }
    });
  }

  handleConnection(port) {
    const clientId = Date.now().toString();
    this.clients.set(clientId, port);

    port.onMessage.addListener((data) => {
      this.handleMessage(clientId, data);
    });

    port.onDisconnect.addListener(() => {
      this.clients.delete(clientId);
      console.log(`Client ${clientId} disconnected`);
    });

    console.log(`Client ${clientId} connected`);
  }

  async handleMessage(clientId, data) {
    try {
      // Decode protobuf message
      const message = BrowserMessage.deserializeBinary(new Uint8Array(data));
      const command = message.getCommand();
      
      if (!command) {
        throw new Error('No command in message');
      }

      const response = await this.processCommand(message.getId(), command);
      
      // Send response back to client
      const responseMessage = new BrowserMessage();
      responseMessage.setId(message.getId());
      responseMessage.setResponse(response);
      
      const client = this.clients.get(clientId);
      if (client) {
        client.postMessage(responseMessage.serializeBinary());
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendErrorResponse(clientId, data.id || 'unknown', error.message);
    }
  }

  async handleRuntimeMessage(message, sender, sendResponse) {
    if (message.type === 'BROP_COMMAND') {
      try {
        const response = await this.processCommand(message.id, message.command);
        sendResponse({ success: true, response });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
  }

  async processCommand(messageId, command) {
    // Get active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    // Determine command type and delegate to appropriate handler
    const commandType = this.getCommandType(command);
    const handler = this.messageHandlers.get(commandType);
    
    if (!handler) {
      throw new Error(`Unknown command type: ${commandType}`);
    }

    return await handler(activeTab, command);
  }

  getCommandType(command) {
    // Map protobuf command to handler key
    if (command.getGetConsoleLogs()) return 'get_console_logs';
    if (command.getExecuteConsole()) return 'execute_console';
    if (command.getGetScreenshot()) return 'get_screenshot';
    if (command.getGetPageContent()) return 'get_page_content';
    if (command.getNavigate()) return 'navigate';
    if (command.getClick()) return 'click';
    if (command.getType()) return 'type';
    if (command.getWaitForElement()) return 'wait_for_element';
    if (command.getEvaluateJs()) return 'evaluate_js';
    if (command.getGetElement()) return 'get_element';
    
    throw new Error('Unknown command type');
  }

  async handleGetConsoleLogs(tab, command) {
    const cmd = command.getGetConsoleLogs();
    
    // Use chrome.debugger to get console logs
    await chrome.debugger.attach({ tabId: tab.id }, '1.3');
    
    try {
      await chrome.debugger.sendCommand({ tabId: tab.id }, 'Runtime.enable');
      await chrome.debugger.sendCommand({ tabId: tab.id }, 'Console.enable');
      
      // Get console messages (this is simplified - you'd need to track them over time)
      const response = new Response();
      response.setSuccess(true);
      
      const consoleResponse = new ConsoleLogsResponse();
      // Add sample log for demonstration
      const log = new ConsoleLog();
      log.setTimestamp(new Date().toISOString());
      log.setLevel('info');
      log.setMessage('Console logs retrieved via BROP');
      log.setSource('extension');
      
      consoleResponse.addLogs(log);
      response.setConsoleLogs(consoleResponse);
      
      return response;
    } finally {
      await chrome.debugger.detach({ tabId: tab.id });
    }
  }

  async handleExecuteConsole(tab, command) {
    const cmd = command.getExecuteConsole();
    
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
        args: [cmd.getCode()]
      });

      const response = new Response();
      const consoleResponse = new ConsoleExecutionResponse();
      
      if (results[0].result.success) {
        response.setSuccess(true);
        consoleResponse.setResult(results[0].result.result);
      } else {
        response.setSuccess(false);
        response.setError(results[0].result.error);
        consoleResponse.setError(results[0].result.error);
      }
      
      response.setConsoleExecution(consoleResponse);
      return response;
    } catch (error) {
      const response = new Response();
      response.setSuccess(false);
      response.setError(error.message);
      return response;
    }
  }

  async handleGetScreenshot(tab, command) {
    const cmd = command.getGetScreenshot();
    
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: cmd.getFormat() || 'png',
        quality: cmd.getQuality() || 90
      });
      
      // Convert data URL to bytes
      const base64Data = dataUrl.split(',')[1];
      const imageData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const response = new Response();
      response.setSuccess(true);
      
      const screenshotResponse = new ScreenshotResponse();
      screenshotResponse.setImageData(imageData);
      screenshotResponse.setFormat(cmd.getFormat() || 'png');
      
      response.setScreenshot(screenshotResponse);
      return response;
    } catch (error) {
      const response = new Response();
      response.setSuccess(false);
      response.setError(error.message);
      return response;
    }
  }

  async handleGetPageContent(tab, command) {
    const cmd = command.getGetPageContent();
    
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (includeHtml, includeText, includeMeta) => {
          const result = {};
          
          if (includeHtml) {
            result.html = document.documentElement.outerHTML;
          }
          
          if (includeText) {
            result.text = document.body.innerText;
          }
          
          if (includeMeta) {
            result.title = document.title;
            result.url = window.location.href;
            result.links = Array.from(document.links).map(l => l.href);
            result.images = Array.from(document.images).map(i => i.src);
          }
          
          return result;
        },
        args: [cmd.getIncludeHtml(), cmd.getIncludeText(), cmd.getIncludeMetadata()]
      });

      const response = new Response();
      response.setSuccess(true);
      
      const contentResponse = new PageContentResponse();
      const data = results[0].result;
      
      if (data.html) contentResponse.setHtml(data.html);
      if (data.text) contentResponse.setText(data.text);
      if (data.title) contentResponse.setTitle(data.title);
      if (data.url) contentResponse.setUrl(data.url);
      if (data.links) data.links.forEach(link => contentResponse.addLinks(link));
      if (data.images) data.images.forEach(img => contentResponse.addImages(img));
      
      response.setPageContent(contentResponse);
      return response;
    } catch (error) {
      const response = new Response();
      response.setSuccess(false);
      response.setError(error.message);
      return response;
    }
  }

  async handleNavigate(tab, command) {
    const cmd = command.getNavigate();
    
    try {
      await chrome.tabs.update(tab.id, { url: cmd.getUrl() });
      
      // Wait for navigation to complete if requested
      if (cmd.getWaitForLoad()) {
        await this.waitForTabLoad(tab.id, cmd.getTimeout() || 30000);
      }
      
      const updatedTab = await chrome.tabs.get(tab.id);
      
      const response = new Response();
      response.setSuccess(true);
      
      const navResponse = new NavigationResponse();
      navResponse.setFinalUrl(updatedTab.url);
      navResponse.setTitle(updatedTab.title);
      navResponse.setLoaded(updatedTab.status === 'complete');
      
      response.setNavigation(navResponse);
      return response;
    } catch (error) {
      const response = new Response();
      response.setSuccess(false);
      response.setError(error.message);
      return response;
    }
  }

  async handleClick(tab, command) {
    // Implementation would use content script injection
    const response = new Response();
    response.setSuccess(false);
    response.setError('Click command not yet implemented');
    return response;
  }

  async handleType(tab, command) {
    // Implementation would use content script injection
    const response = new Response();
    response.setSuccess(false);
    response.setError('Type command not yet implemented');
    return response;
  }

  async handleWaitForElement(tab, command) {
    // Implementation would use content script injection
    const response = new Response();
    response.setSuccess(false);
    response.setError('Wait for element command not yet implemented');
    return response;
  }

  async handleEvaluateJS(tab, command) {
    // Similar to console execution but more robust
    const response = new Response();
    response.setSuccess(false);
    response.setError('Evaluate JS command not yet implemented');
    return response;
  }

  async handleGetElement(tab, command) {
    // Implementation would use content script injection
    const response = new Response();
    response.setSuccess(false);
    response.setError('Get element command not yet implemented');
    return response;
  }

  async waitForTabLoad(tabId, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Tab load timeout'));
      }, timeout);

      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  sendErrorResponse(clientId, messageId, error) {
    const response = new Response();
    response.setSuccess(false);
    response.setError(error);
    
    const responseMessage = new BrowserMessage();
    responseMessage.setId(messageId);
    responseMessage.setResponse(response);
    
    const client = this.clients.get(clientId);
    if (client) {
      client.postMessage(responseMessage.serializeBinary());
    }
  }

  notifyTabReady(tabId, tab) {
    console.log(`Tab ${tabId} ready: ${tab.url}`);
  }
}

// Initialize the BROP server when the background script loads
const bropServer = new BROPServer();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BROPServer;
}