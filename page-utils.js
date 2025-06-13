#!/usr/bin/env node
/**
 * Page utility class for BROP testing
 * Encapsulates page/tab functionality with automatic tabId management
 */

const WebSocket = require('ws');
const { createNamedBROPConnection } = require('./test-utils');

class Page {
  constructor(ws, connectionName) {
    this.ws = ws;
    this.connectionName = connectionName;
    this.tabId = null;
    this.status = 'creating'; // creating, connected, destroyed
    this.messageCounter = 0;
    this.pendingCallbacks = new Map();
    this.url = null;
    this.title = null;
    this.eventsSubscribed = false;
    
    // Listen for messages (both responses and events)
    this.ws.on('message', (data) => {
      this._handleMessage(data);
    });
    
    this.ws.on('close', () => {
      this.status = 'destroyed';
      this._rejectAllPending('Connection closed');
    });
    
    this.ws.on('error', (error) => {
      this.status = 'destroyed';
      this._rejectAllPending(`Connection error: ${error.message}`);
    });
  }

  // Create a new page
  static async create(url = 'https://httpbin.org/html', connectionName = 'page-test') {
    const ws = createNamedBROPConnection(connectionName);
    const page = new Page(ws, connectionName);
    
    return new Promise((resolve, reject) => {
      ws.on('open', async () => {
        try {
          // 1. Create the tab
          const result = await page._createTab(url);
          page.tabId = result.tabId;
          page.url = url;
          
          // 2. Subscribe to tab events automatically
          await page._subscribeToTabEvents();
          
          page.status = 'connected';
          resolve(page);
        } catch (error) {
          page.status = 'destroyed';
          reject(error);
        }
      });
      
      ws.on('error', reject);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (page.status === 'creating') {
          page.status = 'destroyed';
          reject(new Error('Page creation timeout'));
        }
      }, 10000);
    });
  }

  // Private method to create tab
  async _createTab(url) {
    return this._sendCommand('create_tab', { url });
  }

  // Private method to subscribe to tab events
  async _subscribeToTabEvents() {
    if (!this.tabId) {
      throw new Error('Cannot subscribe to events: no tabId');
    }
    
    const result = await this._sendCommand('subscribe_tab_events', { 
      tabId: this.tabId,
      events: ['tab_closed', 'tab_removed', 'tab_updated', 'tab_activated']
    });
    
    this.eventsSubscribed = true;
    console.log(`📡 Subscribed to events for tab ${this.tabId}`);
    return result;
  }

  // Handle incoming messages (both responses and events)
  _handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Check if this is an event broadcast
      if (message.event_type || message.type === 'event') {
        this._handleEvent(message);
        return;
      }
      
      // Handle command responses
      const callback = this.pendingCallbacks.get(message.id);
      if (callback) {
        this.pendingCallbacks.delete(message.id);
        if (message.success) {
          callback.resolve(message.result);
        } else {
          // Check if this is a tab closure error
          const error = message.error || 'Unknown error';
          if (error.includes('not found') && error.includes(this.tabId)) {
            this.status = 'destroyed';
            this._rejectAllPending('Tab was closed externally');
          }
          callback.reject(new Error(error));
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  // Handle tab lifecycle events
  _handleEvent(event) {
    const eventType = event.event_type || event.type;
    
    // Only process events for our specific tab
    if (event.tabId && event.tabId !== this.tabId) {
      return; // Not our tab
    }
    
    console.log(`🔔 Page received event: ${eventType} for tab ${this.tabId}`);
    
    switch (eventType) {
      case 'tab_closed':
      case 'tab_removed':
        console.log(`🔔 Tab ${this.tabId} was closed externally via event!`);
        this.status = 'destroyed';
        this._rejectAllPending('Tab closed externally via event notification');
        break;
        
      case 'tab_updated':
        console.log(`🔔 Tab ${this.tabId} was updated:`, event);
        if (event.url) {
          this.url = event.url;
        }
        if (event.title) {
          this.title = event.title;
        }
        break;
        
      case 'tab_activated':
        console.log(`🔔 Tab ${this.tabId} was activated`);
        break;
        
      default:
        console.log(`🔔 Unknown event type: ${eventType}`, event);
    }
  }

  // Reject all pending callbacks
  _rejectAllPending(reason) {
    for (const callback of this.pendingCallbacks.values()) {
      callback.reject(new Error(reason));
    }
    this.pendingCallbacks.clear();
  }

  // Send command to bridge
  _sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (this.status === 'destroyed') {
        reject(new Error('Page has been destroyed'));
        return;
      }

      const id = `${this.connectionName}-${++this.messageCounter}`;
      
      // Add tabId to params if this page has one and method needs it
      const finalParams = { ...params };
      if (this.tabId && this._needsTabId(method)) {
        finalParams.tabId = this.tabId;
      }

      const message = {
        id,
        method,
        params: finalParams
      };

      this.pendingCallbacks.set(id, { resolve, reject });
      
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        this.pendingCallbacks.delete(id);
        reject(error);
      }

      // Timeout after 15 seconds
      setTimeout(() => {
        if (this.pendingCallbacks.has(id)) {
          this.pendingCallbacks.delete(id);
          reject(new Error(`Command timeout: ${method}`));
        }
      }, 15000);
    });
  }

  // Check if method needs tabId
  _needsTabId(method) {
    const methodsNeedingTabId = [
      'navigate', 'get_page_content', 'get_console_logs', 
      'get_screenshot', 'execute_console', 'get_simplified_dom',
      'close_tab'
    ];
    return methodsNeedingTabId.includes(method);
  }

  // Navigation methods
  async navigate(url) {
    if (this.status !== 'connected') {
      throw new Error(`Cannot navigate: Page status is ${this.status}`);
    }
    
    const result = await this._sendCommand('navigate', { url });
    this.url = url;
    return result;
  }

  // Content extraction methods
  async getContent(options = {}) {
    if (this.status !== 'connected') {
      throw new Error(`Cannot get content: Page status is ${this.status}`);
    }
    
    return this._sendCommand('get_page_content', {
      include_metadata: true,
      ...options
    });
  }

  async getConsoleLogs(options = {}) {
    if (this.status !== 'connected') {
      throw new Error(`Cannot get console logs: Page status is ${this.status}`);
    }
    
    return this._sendCommand('get_console_logs', {
      limit: 10,
      ...options
    });
  }

  async getScreenshot(options = {}) {
    if (this.status !== 'connected') {
      throw new Error(`Cannot get screenshot: Page status is ${this.status}`);
    }
    
    return this._sendCommand('get_screenshot', {
      format: 'png',
      ...options
    });
  }

  async getSimplifiedDOM(options = {}) {
    if (this.status !== 'connected') {
      throw new Error(`Cannot get simplified DOM: Page status is ${this.status}`);
    }
    
    return this._sendCommand('get_simplified_dom', {
      max_depth: 3,
      include_hidden: false,
      include_text_nodes: true,
      include_coordinates: true,
      ...options
    });
  }

  // JavaScript execution
  async executeConsole(code, options = {}) {
    if (this.status !== 'connected') {
      throw new Error(`Cannot execute console: Page status is ${this.status}`);
    }
    
    return this._sendCommand('execute_console', {
      code,
      ...options
    });
  }

  // Wait for page load
  async waitForLoad(timeout = 3000) {
    return new Promise(resolve => setTimeout(resolve, timeout));
  }

  // Close the page
  async close() {
    if (this.status === 'destroyed') {
      return; // Already closed
    }

    try {
      // Unsubscribe from events before closing
      if (this.eventsSubscribed && this.tabId) {
        try {
          await this._sendCommand('unsubscribe_tab_events', { tabId: this.tabId });
          console.log(`📡 Unsubscribed from events for tab ${this.tabId}`);
        } catch (error) {
          console.warn('Error unsubscribing from events:', error.message);
        }
      }
      
      if (this.tabId) {
        await this._sendCommand('close_tab');
      }
    } catch (error) {
      console.warn('Error closing tab:', error.message);
    } finally {
      this.status = 'destroyed';
      this.eventsSubscribed = false;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this._rejectAllPending('Page closed');
    }
  }

  // Status checks
  isConnected() {
    return this.status === 'connected';
  }

  isDestroyed() {
    return this.status === 'destroyed';
  }

  getStatus() {
    return this.status;
  }

  getTabId() {
    return this.tabId;
  }

  getUrl() {
    return this.url;
  }

  // Utility methods for testing
  toString() {
    return `Page(tabId=${this.tabId}, status=${this.status}, url=${this.url})`;
  }
}

// Helper function to create a page
async function createPage(url = 'https://httpbin.org/html', connectionName = 'page-test') {
  return Page.create(url, connectionName);
}

module.exports = { Page, createPage };