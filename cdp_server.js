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

    console.log('🎭 CDP Server forwarding command to browser as-is:', {
      method: method,
      id: id,
      connectionId: connectionId,
      sessionId: sessionId
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
      // Get tab ID for the command
      const tabId = await this.getTabIdForCommand(params, sessionId);
      
      if (!tabId) {
        throw new Error('No active tab found for CDP command');
      }

      // Attach debugger if not already attached
      if (!this.attachedTabs.has(tabId)) {
        console.log(`🎭 Attaching debugger to tab ${tabId} for CDP`);
        await chrome.debugger.attach({ tabId }, "1.3");
        this.attachedTabs.add(tabId);
        console.log(`✅ Debugger attached to tab ${tabId}`);
      }

      // Forward command directly to Chrome's CDP via debugger API
      console.log(`🎭 Forwarding CDP command to browser: ${method}`);
      const result = await chrome.debugger.sendCommand(
        { tabId },
        method,
        params || {}
      );

      console.log(`✅ CDP command ${method} forwarded successfully`);

      // Send response back
      sendResponseCallback({
        type: 'response',
        id: id,
        result: result
      });

    } catch (error) {
      console.error(`🎭 CDP Server error forwarding ${method}:`, error);
      sendResponseCallback({
        type: 'response',
        id: id,
        error: {
          code: -32603,
          message: `CDP command failed: ${error.message}`
        }
      });
    }
  }

  async getTabIdForCommand(params, sessionId) {
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

    // Fallback to active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id || null;
  }

  getTabIdFromTarget(targetId) {
    // Extract tab ID from target ID format: "tab_123456"
    if (targetId?.startsWith('tab_')) {
      const tabId = Number.parseInt(targetId.replace('tab_', ''));
      return Number.isNaN(tabId) ? null : tabId;
    }
    return null;
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