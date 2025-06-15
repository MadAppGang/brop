// CDP Server - Chrome DevTools Protocol Implementation
// This class handles all CDP commands using Chrome Extension APIs

class CDPServer {
  constructor() {
    this.pendingRequests = new Map(); // messageId -> { bridgeMessageId, connectionId }
    this.isConnected = true; // Always connected since we're inside Chrome
    this.attachedTabs = new Set();
    this.debuggerSessions = new Map(); // tabId -> sessionInfo
    
    this.setupCDPEventForwarding();
    console.log('🎭 CDP Server initialized using Chrome Extension APIs');
  }

  setupCDPEventForwarding() {
    // Forward CDP events from debugger to bridge
    chrome.debugger.onEvent.addListener((source, method, params) => {
      console.log(`🎭 CDP Event: ${method} from tab ${source.tabId}`);

      // Forward the event
      if (this.onEventCallback) {
        this.onEventCallback({
          type: 'cdp_event',
          method: method,
          params: params,
          tabId: source.tabId
        });
      }
    });

    // Handle debugger detach events
    chrome.debugger.onDetach.addListener((source, reason) => {
      console.log(`🎭 CDP Debugger detached from tab ${source.tabId}: ${reason}`);
      this.attachedTabs.delete(source.tabId);
      this.debuggerSessions.delete(source.tabId);
    });

    // Clean up debugger sessions when tabs are closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (this.attachedTabs.has(tabId)) {
        console.log(`🎭 Cleaning up CDP session for closed tab ${tabId}`);
        chrome.debugger.detach({ tabId }).catch(() => {
          // Ignore errors when tab is already gone
        });
        this.attachedTabs.delete(tabId);
        this.debuggerSessions.delete(tabId);
      }
    });

    console.log('🎭 CDP event forwarding set up');
  }

  // Process CDP command using Chrome Extension APIs
  async processCDPCommand(message, sendResponseCallback) {
    const { id, method, params, sessionId, connectionId } = message;

    console.log('🎭 CDP Server processing command:', {
      method: method,
      id: id,
      connectionId: connectionId,
      sessionId: sessionId,
      params: params
    });

    if (!method) {
      console.error('🎭 ERROR: CDP method is undefined!', message);
      sendResponseCallback({
        type: 'response',
        id: id,
        error: { code: -32600, message: 'Invalid CDP command: missing method' }
      });
      return;
    }

    try {
      // Check domain to determine target type
      const domain = method.split('.')[0];
      const isBrowserDomain = domain === 'Browser';
      const isTargetDomain = domain === 'Target';
      
      console.log(`🎭 Method: ${method}, Domain: ${domain}, isBrowserDomain: ${isBrowserDomain}, isTargetDomain: ${isTargetDomain}`);
      
      if (isBrowserDomain || isTargetDomain) {
        // Browser/Target domain - use Chrome extension APIs
        console.log(`🎭 Browser/Target domain command: ${method}`);
        const result = await this.handleBrowserTargetCommand(method, params || {});
        
        sendResponseCallback({
          type: 'response',
          id: id,
          result: result
        });
      } else {
        // Non-browser domain - use tab target
        const tabId = this.getTabIdFromParams(params, sessionId);
        
        if (tabId) {
          // Use specified tab
          if (!this.attachedTabs.has(tabId)) {
            console.log(`🎭 Attaching debugger to tab ${tabId}`);
            await chrome.debugger.attach({ tabId }, "1.3");
            this.attachedTabs.add(tabId);
          }
          
          const result = await chrome.debugger.sendCommand(
            { tabId },
            method,
            params || {}
          );
          
          console.log(`✅ Tab command ${method} completed`);
          sendResponseCallback({
            type: 'response',
            id: id,
            result: result
          });
        } else {
          // Find any available tab
          const tabs = await chrome.tabs.query({});
          const targetTab = tabs.find(tab => 
            tab.url && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('chrome:')
          );
          
          if (!targetTab) {
            throw new Error(`No suitable tab found for command ${method}`);
          }
          
          if (!this.attachedTabs.has(targetTab.id)) {
            console.log(`🎭 Attaching debugger to tab ${targetTab.id}`);
            await chrome.debugger.attach({ tabId: targetTab.id }, "1.3");
            this.attachedTabs.add(targetTab.id);
          }
          
          const result = await chrome.debugger.sendCommand(
            { tabId: targetTab.id },
            method,
            params || {}
          );
          
          console.log(`✅ Tab command ${method} completed`);
          sendResponseCallback({
            type: 'response',
            id: id,
            result: result
          });
        }
      }

    } catch (error) {
      console.error(`🎭 CDP Server error forwarding ${method}:`, error);
      console.error(`🎭 Error stack:`, error.stack);
      
      try {
        sendResponseCallback({
          type: 'response',
          id: id,
          error: {
            code: -32603,
            message: `CDP command failed: ${error.message}`
          }
        });
      } catch (callbackError) {
        console.error(`🎭 Error in callback:`, callbackError);
      }
    }
  }

  getTabIdFromParams(params, sessionId) {
    // Try to get tab ID from sessionId first
    if (sessionId) {
      for (const [tabId, session] of this.debuggerSessions) {
        if (session.sessionId === sessionId) {
          return tabId;
        }
      }
    }

    // Try to get tab ID from targetId in params
    if (params?.targetId) {
      return this.getTabIdFromTarget(params.targetId);
    }

    // No tab ID found
    return null;
  }

  getTabIdFromTarget(targetId) {
    // Extract tab ID from target ID format: "tab_123456"
    if (targetId?.startsWith('tab_')) {
      const tabId = Number.parseInt(targetId.replace('tab_', ''));
      return Number.isNaN(tabId) ? null : tabId;
    }
    return null;
  }

  // Handle Browser and Target domain commands using Chrome extension APIs
  async handleBrowserTargetCommand(method, params) {
    switch (method) {
      // Browser domain
      case 'Browser.getVersion':
        return await this.browserGetVersion();
      
      case 'Browser.close':
        return await this.browserClose();
      
      // Target domain
      case 'Target.getTargets':
        return await this.targetGetTargets();
      
      case 'Target.createTarget':
        return await this.targetCreateTarget(params);
      
      case 'Target.closeTarget':
        return await this.targetCloseTarget(params);
      
      case 'Target.activateTarget':
        return await this.targetActivateTarget(params);
      
      case 'Target.attachToTarget':
        return await this.targetAttachToTarget(params);
      
      case 'Target.detachFromTarget':
        return await this.targetDetachFromTarget(params);
      
      case 'Target.sendMessageToTarget':
        return await this.targetSendMessageToTarget(params);
      
      case 'Target.setAutoAttach':
        return await this.targetSetAutoAttach(params);
      
      case 'Target.setDiscoverTargets':
        return await this.targetSetDiscoverTargets(params);
      
      default:
        throw new Error(`Unsupported Browser/Target command: ${method}`);
    }
  }

  // Browser.getVersion implementation
  async browserGetVersion() {
    try {
      const browserInfo = await chrome.runtime.getBrowserInfo();
      return {
        protocolVersion: "1.3",
        product: browserInfo.name || "Chrome",
        revision: "@0",
        userAgent: navigator.userAgent,
        jsVersion: browserInfo.version || "unknown"
      };
    } catch (error) {
      // Fallback if getBrowserInfo fails
      const manifest = chrome.runtime.getManifest();
      return {
        protocolVersion: "1.3",
        product: "Chrome",
        revision: "@0",
        userAgent: navigator.userAgent,
        jsVersion: manifest.version || "unknown"
      };
    }
  }

  // Browser.close implementation
  async browserClose() {
    const windows = await chrome.windows.getAll({ populate: false });
    for (const window of windows) {
      await chrome.windows.remove(window.id);
    }
    return {};
  }

  // Target.getTargets implementation
  async targetGetTargets() {
    const targets = await new Promise((resolve) => {
      chrome.debugger.getTargets((targets) => {
        resolve(targets);
      });
    });
    
    const targetInfos = targets.map(target => ({
      targetId: target.id,
      type: target.type,
      title: target.title || "",
      url: target.url || "",
      attached: target.attached || false,
      canAccessOpener: false
    }));
    
    return { targetInfos };
  }

  // Target.createTarget implementation
  async targetCreateTarget(params) {
    const url = params.url || 'about:blank';
    const width = params.width;
    const height = params.height;
    const newWindow = params.newWindow;
    
    if (newWindow) {
      const createData = { url };
      if (width && height) {
        createData.width = width;
        createData.height = height;
      }
      const window = await chrome.windows.create(createData);
      const tab = window.tabs[0];
      return { targetId: tab.id.toString() };
    } else {
      const tab = await chrome.tabs.create({ url });
      return { targetId: tab.id.toString() };
    }
  }

  // Target.closeTarget implementation
  async targetCloseTarget(params) {
    const targetId = params.targetId;
    const tabId = parseInt(targetId);
    await chrome.tabs.remove(tabId);
    return { success: true };
  }

  // Target.activateTarget implementation
  async targetActivateTarget(params) {
    const targetId = params.targetId;
    const tabId = parseInt(targetId);
    
    // Get tab info to find its window
    const tab = await chrome.tabs.get(tabId);
    
    // Activate the tab
    await chrome.tabs.update(tabId, { active: true });
    
    // Focus the window
    await chrome.windows.update(tab.windowId, { focused: true });
    
    return {};
  }

  // Target.attachToTarget implementation
  async targetAttachToTarget(params) {
    const targetId = params.targetId;
    const tabId = parseInt(targetId);
    const flatten = params.flatten !== false;
    
    await new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId }, "1.3", () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          this.attachedTabs.add(tabId);
          resolve();
        }
      });
    });
    
    // Generate a session ID
    const sessionId = `session_${targetId}_${Date.now()}`;
    this.debuggerSessions.set(tabId, { sessionId, targetId });
    
    return { sessionId };
  }

  // Target.detachFromTarget implementation
  async targetDetachFromTarget(params) {
    const sessionId = params.sessionId;
    
    // Find tab by session ID
    let tabId = null;
    for (const [tid, session] of this.debuggerSessions.entries()) {
      if (session.sessionId === sessionId) {
        tabId = tid;
        break;
      }
    }
    
    if (tabId) {
      await chrome.debugger.detach({ tabId });
      this.attachedTabs.delete(tabId);
      this.debuggerSessions.delete(tabId);
    }
    
    return {};
  }

  // Target.sendMessageToTarget implementation
  async targetSendMessageToTarget(params) {
    const sessionId = params.sessionId;
    const message = JSON.parse(params.message);
    
    // Find tab by session ID
    let tabId = null;
    for (const [tid, session] of this.debuggerSessions.entries()) {
      if (session.sessionId === sessionId) {
        tabId = tid;
        break;
      }
    }
    
    if (!tabId) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    const result = await new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(
        { tabId },
        message.method,
        message.params || {},
        (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        }
      );
    });
    
    return result;
  }

  // Target.setAutoAttach implementation
  async targetSetAutoAttach(params) {
    const autoAttach = params.autoAttach;
    const waitForDebuggerOnStart = params.waitForDebuggerOnStart || false;
    const flatten = params.flatten !== false;
    
    // Find any attached tab to send the command
    const tabId = Array.from(this.attachedTabs)[0];
    if (!tabId) {
      throw new Error('No attached tabs to set auto attach');
    }
    
    await new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(
        { tabId },
        "Target.setAutoAttach",
        { autoAttach, waitForDebuggerOnStart, flatten },
        (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        }
      );
    });
    
    return {};
  }

  // Target.setDiscoverTargets implementation
  async targetSetDiscoverTargets(params) {
    // This command is not allowed in extension context
    // Return empty result instead of error for compatibility
    console.log('🎭 Target.setDiscoverTargets not allowed in extension context');
    return {};
  }

  // Set callback for event forwarding
  setEventCallback(callback) {
    this.onEventCallback = callback;
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      attachedTabs: this.attachedTabs.size,
      debuggerSessions: this.debuggerSessions.size
    };
  }

  // Close connection and cleanup
  close() {
    // Detach from all tabs
    for (const tabId of this.attachedTabs) {
      chrome.debugger.detach({ tabId }).catch(() => {
        // Ignore errors during cleanup
      });
    }
    
    this.attachedTabs.clear();
    this.debuggerSessions.clear();
    this.isConnected = false;
  }
}

// Export for use in background scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CDPServer;
} else {
  self.CDPServer = CDPServer;
}