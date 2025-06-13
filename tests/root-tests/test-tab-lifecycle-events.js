#!/usr/bin/env node
/**
 * Test tab lifecycle event subscription
 * Shows how tabs can subscribe to and receive lifecycle messages
 */

const { createNamedBROPConnection } = require('./test-utils');

class LifecycleAwarePage {
  constructor(ws, connectionName) {
    this.ws = ws;
    this.connectionName = connectionName;
    this.tabId = null;
    this.status = 'creating';
    this.messageCounter = 0;
    this.pendingCallbacks = new Map();
    this.url = null;
    this.lifecycleListeners = new Map(); // event_type -> callback
    
    // Listen for messages (both responses and events)
    this.ws.on('message', (data) => {
      this._handleMessage(data);
    });
    
    this.ws.on('close', () => {
      this.status = 'destroyed';
      this._rejectAllPending('Connection closed');
      this._notifyLifecycleListeners('connection_lost', { reason: 'WebSocket closed' });
    });
    
    this.ws.on('error', (error) => {
      this.status = 'destroyed';
      this._rejectAllPending(`Connection error: ${error.message}`);
      this._notifyLifecycleListeners('connection_error', { error: error.message });
    });
  }

  // Create a lifecycle-aware page
  static async create(url = 'https://httpbin.org/html', connectionName = 'lifecycle-page') {
    const ws = createNamedBROPConnection(connectionName);
    const page = new LifecycleAwarePage(ws, connectionName);
    
    return new Promise((resolve, reject) => {
      ws.on('open', async () => {
        try {
          // Subscribe to lifecycle events first
          console.log('📡 Subscribing to tab lifecycle events...');
          await page._subscribeToEvents();
          
          // Create the tab
          const result = await page._createTab(url);
          page.tabId = result.tabId;
          page.url = url;
          page.status = 'connected';
          
          console.log(`   ✅ Subscribed to events for tab ${page.tabId}`);
          resolve(page);
        } catch (error) {
          page.status = 'destroyed';
          reject(error);
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        if (page.status === 'creating') {
          page.status = 'destroyed';
          reject(new Error('Page creation timeout'));
        }
      }, 10000);
    });
  }

  // Subscribe to tab lifecycle events
  async _subscribeToEvents() {
    return this._sendCommand('subscribe_events', {
      events: ['tab_closed', 'tab_updated', 'tab_activated', 'tab_removed']
    });
  }

  // Handle incoming messages (responses and events)
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
          const error = message.error || 'Unknown error';
          if (error.includes('not found') && this.tabId && error.includes(this.tabId)) {
            this.status = 'destroyed';
            this._rejectAllPending('Tab was closed externally');
            this._notifyLifecycleListeners('tab_closed', { tabId: this.tabId, external: true });
          }
          callback.reject(new Error(error));
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  // Handle lifecycle events
  _handleEvent(event) {
    console.log(`📡 Received event: ${event.event_type || event.type}`, event);
    
    const eventType = event.event_type || event.type;
    
    // Check if this event affects our tab
    if (event.tabId && event.tabId !== this.tabId) {
      return; // Not our tab
    }
    
    switch (eventType) {
      case 'tab_closed':
      case 'tab_removed':
        if (event.tabId === this.tabId) {
          console.log(`🔔 Tab ${this.tabId} was closed externally!`);
          this.status = 'destroyed';
          this._rejectAllPending('Tab closed externally via event');
          this._notifyLifecycleListeners('tab_closed', event);
        }
        break;
        
      case 'tab_updated':
        if (event.tabId === this.tabId) {
          console.log(`🔔 Tab ${this.tabId} was updated:`, event);
          if (event.url) {
            this.url = event.url;
          }
          this._notifyLifecycleListeners('tab_updated', event);
        }
        break;
        
      case 'tab_activated':
        if (event.tabId === this.tabId) {
          console.log(`🔔 Tab ${this.tabId} was activated`);
          this._notifyLifecycleListeners('tab_activated', event);
        }
        break;
    }
  }

  // Add lifecycle event listener
  onLifecycleEvent(eventType, callback) {
    if (!this.lifecycleListeners.has(eventType)) {
      this.lifecycleListeners.set(eventType, []);
    }
    this.lifecycleListeners.get(eventType).push(callback);
  }

  // Notify lifecycle listeners
  _notifyLifecycleListeners(eventType, eventData) {
    const listeners = this.lifecycleListeners.get(eventType) || [];
    listeners.forEach(callback => {
      try {
        callback(eventData);
      } catch (error) {
        console.error(`Error in lifecycle listener for ${eventType}:`, error);
      }
    });
  }

  // Send command (same as regular Page class)
  _sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (this.status === 'destroyed') {
        reject(new Error('Page has been destroyed'));
        return;
      }

      const id = `${this.connectionName}-${++this.messageCounter}`;
      const finalParams = { ...params };
      
      if (this.tabId && this._needsTabId(method)) {
        finalParams.tabId = this.tabId;
      }

      const message = { id, method, params: finalParams };
      this.pendingCallbacks.set(id, { resolve, reject });
      
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        this.pendingCallbacks.delete(id);
        reject(error);
      }

      setTimeout(() => {
        if (this.pendingCallbacks.has(id)) {
          this.pendingCallbacks.delete(id);
          reject(new Error(`Command timeout: ${method}`));
        }
      }, 15000);
    });
  }

  // Same helper methods as regular Page class
  async _createTab(url) {
    return this._sendCommand('create_tab', { url });
  }

  _needsTabId(method) {
    const methodsNeedingTabId = [
      'navigate', 'get_page_content', 'get_console_logs', 
      'get_screenshot', 'execute_console', 'get_simplified_dom',
      'close_tab'
    ];
    return methodsNeedingTabId.includes(method);
  }

  _rejectAllPending(reason) {
    for (const callback of this.pendingCallbacks.values()) {
      callback.reject(new Error(reason));
    }
    this.pendingCallbacks.clear();
  }

  // Page methods (same as regular Page class)
  async getContent() {
    if (this.status !== 'connected') {
      throw new Error(`Cannot get content: Page status is ${this.status}`);
    }
    return this._sendCommand('get_page_content', { include_metadata: true });
  }

  async close() {
    if (this.status === 'destroyed') {
      return;
    }

    try {
      if (this.tabId) {
        await this._sendCommand('close_tab');
      }
    } catch (error) {
      console.warn('Error closing tab:', error.message);
    } finally {
      this.status = 'destroyed';
      if (this.ws && this.ws.readyState === 1) {
        this.ws.close();
      }
      this._rejectAllPending('Page closed');
      this._notifyLifecycleListeners('page_closed', { tabId: this.tabId });
    }
  }

  // Status methods
  isConnected() { return this.status === 'connected'; }
  isDestroyed() { return this.status === 'destroyed'; }
  getStatus() { return this.status; }
  getTabId() { return this.tabId; }
  toString() { return `LifecyclePage(tabId=${this.tabId}, status=${this.status}, url=${this.url})`; }
}

// Test the lifecycle-aware page
async function testLifecycleEvents() {
  console.log('🧪 Testing Tab Lifecycle Event Subscription');
  console.log('============================================\n');

  let page = null;
  let externalConnection = null;

  try {
    // Create lifecycle-aware page
    console.log('📋 Step 1: Creating lifecycle-aware page...');
    page = await LifecycleAwarePage.create('https://example.com', 'lifecycle-test');
    console.log(`   ✅ ${page.toString()}`);

    // Set up event listeners
    console.log('\n📋 Step 2: Setting up event listeners...');
    
    page.onLifecycleEvent('tab_closed', (event) => {
      console.log(`   🔔 LISTENER: Tab closed event received!`, event);
    });
    
    page.onLifecycleEvent('tab_updated', (event) => {
      console.log(`   🔔 LISTENER: Tab updated event received!`, event);
    });
    
    page.onLifecycleEvent('connection_lost', (event) => {
      console.log(`   🔔 LISTENER: Connection lost event received!`, event);
    });

    console.log('   ✅ Event listeners registered');

    // Test normal operation
    console.log('\n📋 Step 3: Testing normal operations...');
    const content = await page.getContent();
    console.log(`   ✅ Content retrieved: ${content.title}`);

    // Create external connection to close the tab
    console.log('\n📋 Step 4: Creating external connection...');
    externalConnection = createNamedBROPConnection('external-closer');
    
    await new Promise((resolve) => {
      externalConnection.on('open', resolve);
    });

    // Close tab externally and see if we get events
    console.log('\n📋 Step 5: Closing tab externally...');
    const tabIdToClose = page.getTabId();
    
    const closePromise = new Promise((resolve) => {
      let messageId = 1;
      const message = {
        id: messageId,
        method: 'close_tab',
        params: { tabId: tabIdToClose }
      };

      externalConnection.send(JSON.stringify(message));
      externalConnection.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === messageId) {
          resolve(response);
        }
      });
    });

    const closeResult = await closePromise;
    console.log(`   ✅ External close result: ${closeResult.success ? 'SUCCESS' : closeResult.error}`);

    // Wait for events
    console.log('\n📋 Step 6: Waiting for lifecycle events...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test operations after closure
    console.log('\n📋 Step 7: Testing operations after external closure...');
    console.log(`   📊 Page status: ${page.getStatus()}`);
    
    try {
      await page.getContent();
      console.log('   ❌ Should have failed!');
    } catch (error) {
      console.log(`   ✅ Operation correctly failed: ${error.message}`);
    }

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
  } finally {
    console.log('\n🧹 Cleaning up...');
    if (externalConnection) {
      externalConnection.close();
    }
    if (page && page.isConnected()) {
      await page.close();
    }
  }
}

testLifecycleEvents().catch(console.error);