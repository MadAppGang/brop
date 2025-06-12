// Browser Remote Operations Protocol - Background Script (Bridge Client)
// This version connects to the external bridge server as a WebSocket client

class BROPBridgeClient {
  constructor() {
    this.bridgeSocket = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.connectionStatus = 'disconnected'; // 'connecting', 'connected', 'disconnected'
    this.lastConnectionTime = null;
    this.isConnected = false;
    this.enabled = true;
    this.callLogs = [];
    this.maxLogEntries = 1000;
    
    // Error collection system
    this.extensionErrors = [];
    this.maxErrorEntries = 100;
    
    this.bridgeUrl = 'ws://localhost:9224'; // Extension server port
    
    // Track target discovery state
    this.targetsDiscovered = false;
    this.sentTargetIds = new Set();
    
    // Track debugger sessions for showing "debugging this browser" status
    this.debuggerSessions = new Map(); // tabId -> debuggee
    this.debuggerAttached = new Set(); // Set of attached tab IDs
    
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
    this.setupDebuggerHandlers();
    this.setupErrorHandlers();
    this.loadSettings();
    this.connectToBridge();
  }

  setupMessageHandlers() {
    // BROP command handlers
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
    this.messageHandlers.set('get_simplified_dom', this.handleGetSimplifiedDOM.bind(this));
    this.messageHandlers.set('get_extension_errors', this.handleGetExtensionErrors.bind(this));
    this.messageHandlers.set('get_chrome_extension_errors', this.handleGetChromeExtensionErrors.bind(this));
    this.messageHandlers.set('clear_extension_errors', this.handleClearExtensionErrors.bind(this));
    this.messageHandlers.set('reload_extension', this.handleReloadExtension.bind(this));
    this.messageHandlers.set('test_reload_feature', this.handleTestReloadFeature.bind(this));
    
    // CDP command handlers
    this.cdpHandlers = new Map([
      ['Browser.getVersion', this.cdpBrowserGetVersion.bind(this)],
      ['Browser.setDownloadBehavior', this.cdpBrowserSetDownloadBehavior.bind(this)],
      ['Browser.getWindowForTarget', this.cdpBrowserGetWindowForTarget.bind(this)],
      ['Browser.createBrowserContext', this.cdpBrowserCreateBrowserContext.bind(this)],
      ['Browser.disposeBrowserContext', this.cdpBrowserDisposeBrowserContext.bind(this)],
      ['Browser.getBrowserContexts', this.cdpBrowserGetBrowserContexts.bind(this)],
      ['Target.setDiscoverTargets', this.cdpTargetSetDiscoverTargets.bind(this)],
      ['Target.getTargets', this.cdpTargetGetTargets.bind(this)],
      ['Target.attachToTarget', this.cdpTargetAttachToTarget.bind(this)],
      ['Target.setAutoAttach', this.cdpTargetSetAutoAttach.bind(this)],
      ['Target.getTargetInfo', this.cdpTargetGetTargetInfo.bind(this)],
      ['Target.createTarget', this.cdpTargetCreateTarget.bind(this)],
      ['Target.closeTarget', this.cdpTargetCloseTarget.bind(this)],
      ['Target.activateTarget', this.cdpTargetActivateTarget.bind(this)],
      ['Target.detachFromTarget', this.cdpTargetDetachFromTarget.bind(this)],
      ['Target.sendMessageToTarget', this.cdpTargetSendMessageToTarget.bind(this)],
      ['Target.receivedMessageFromTarget', this.cdpTargetReceivedMessageFromTarget.bind(this)],
      ['Target.targetCrashed', this.cdpTargetTargetCrashed.bind(this)],
      ['Target.targetDestroyed', this.cdpTargetTargetDestroyed.bind(this)],
      ['Target.setRemoteLocations', this.cdpTargetSetRemoteLocations.bind(this)],
      ['Target.createBrowserContext', this.cdpTargetCreateBrowserContext.bind(this)],
      ['Target.disposeBrowserContext', this.cdpTargetDisposeBrowserContext.bind(this)],
      ['Target.setAttachToFrames', this.cdpTargetSetAttachToFrames.bind(this)],
      ['Browser.close', this.cdpBrowserClose.bind(this)],
      ['Browser.crash', this.cdpBrowserCrash.bind(this)],
      ['Runtime.enable', this.cdpRuntimeEnable.bind(this)],
      ['Runtime.addBinding', this.cdpRuntimeAddBinding.bind(this)],
      ['Page.enable', this.cdpPageEnable.bind(this)],
      ['Page.addScriptToEvaluateOnNewDocument', this.cdpPageAddScriptToEvaluateOnNewDocument.bind(this)],
      ['Page.removeScriptToEvaluateOnNewDocument', this.cdpPageRemoveScriptToEvaluateOnNewDocument.bind(this)],
      ['Page.setLifecycleEventsEnabled', this.cdpPageSetLifecycleEventsEnabled.bind(this)],
      ['Page.getFrameTree', this.cdpPageGetFrameTree.bind(this)],
      ['Runtime.runIfWaitingForDebugger', this.cdpRuntimeRunIfWaitingForDebugger.bind(this)],
      ['Runtime.setCustomObjectFormatterEnabled', this.cdpRuntimeSetCustomObjectFormatterEnabled.bind(this)],
      ['Network.enable', this.cdpNetworkEnable.bind(this)],
      ['Log.enable', this.cdpLogEnable.bind(this)],
      ['Emulation.setFocusEmulationEnabled', this.cdpEmulationSetFocusEmulationEnabled.bind(this)],
      ['Emulation.setEmulatedMedia', this.cdpEmulationSetEmulatedMedia.bind(this)],
      ['Page.navigate', this.cdpPageNavigate.bind(this)],
      ['Runtime.evaluate', this.cdpRuntimeEvaluate.bind(this)],
      ['Page.captureScreenshot', this.cdpPageCaptureScreenshot.bind(this)],
      ['DOM.getDocument', this.cdpDOMGetDocument.bind(this)],
      ['DOM.querySelector', this.cdpDOMQuerySelector.bind(this)],
      ['Input.dispatchMouseEvent', this.cdpInputDispatchMouseEvent.bind(this)],
      ['Input.insertText', this.cdpInputInsertText.bind(this)]
    ]);
  }

  setupDebuggerHandlers() {
    // Listen for debugger events
    chrome.debugger.onEvent.addListener((source, method, params) => {
      this.handleDebuggerEvent(source, method, params);
    });
    
    // Listen for debugger detach events
    chrome.debugger.onDetach.addListener((source, reason) => {
      this.handleDebuggerDetach(source, reason);
    });
    
    // Listen for tab events to manage debugger sessions
    chrome.tabs.onCreated.addListener((tab) => {
      this.handleTabCreated(tab);
    });
    
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });
    
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });
  }

  async attachDebuggerToTab(tabId) {
    try {
      if (this.debuggerAttached.has(tabId)) {
        console.log(`Debugger already attached to tab ${tabId}`);
        return true;
      }
      
      const debuggee = { tabId: tabId };
      
      // Attach debugger with CDP version
      await chrome.debugger.attach(debuggee, "1.3");
      
      // Enable required CDP domains
      await chrome.debugger.sendCommand(debuggee, "Runtime.enable", {});
      await chrome.debugger.sendCommand(debuggee, "Page.enable", {});
      await chrome.debugger.sendCommand(debuggee, "Network.enable", {});
      await chrome.debugger.sendCommand(debuggee, "Log.enable", {});
      
      this.debuggerSessions.set(tabId, debuggee);
      this.debuggerAttached.add(tabId);
      
      console.log(`✅ Debugger attached to tab ${tabId} - "debugging this browser" status active`);
      
      // Update the tab's title to show debugging status
      chrome.tabs.get(tabId, (tab) => {
        if (tab && !tab.title.includes('🔧')) {
          // Add debugging indicator to tab title (this may not work due to browser restrictions)
          console.log(`🔧 Tab ${tabId} is now being debugged: ${tab.title}`);
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to attach debugger to tab ${tabId}:`, error);
      return false;
    }
  }

  async detachDebuggerFromTab(tabId) {
    try {
      if (!this.debuggerAttached.has(tabId)) {
        return true;
      }
      
      const debuggee = this.debuggerSessions.get(tabId);
      if (debuggee) {
        await chrome.debugger.detach(debuggee);
        this.debuggerSessions.delete(tabId);
        this.debuggerAttached.delete(tabId);
        console.log(`✅ Debugger detached from tab ${tabId}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to detach debugger from tab ${tabId}:`, error);
      return false;
    }
  }

  async attachDebuggerToAllTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      const attachPromises = [];
      
      for (const tab of tabs) {
        // Skip chrome:// and extension pages
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          continue;
        }
        
        attachPromises.push(this.attachDebuggerToTab(tab.id));
      }
      
      const results = await Promise.allSettled(attachPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
      
      console.log(`🔧 Attached debugger to ${successCount}/${attachPromises.length} tabs`);
      console.log(`🎯 Chrome should now show "debugging this browser" status`);
      
      return successCount;
    } catch (error) {
      console.error('Failed to attach debugger to tabs:', error);
      return 0;
    }
  }

  setupErrorHandlers() {
    // Enhanced error capture system
    
    // 1. Capture uncaught errors in the extension
    self.addEventListener('error', (event) => {
      this.logError('Uncaught Error', event.error?.message || event.message, event.error?.stack, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // 2. Capture unhandled promise rejections
    self.addEventListener('unhandledrejection', (event) => {
      this.logError('Unhandled Promise Rejection', event.reason?.message || String(event.reason), event.reason?.stack);
    });

    // 3. Capture Chrome runtime errors
    if (chrome.runtime.onStartup) {
      chrome.runtime.onStartup.addListener(() => {
        if (chrome.runtime.lastError) {
          this.logError('Runtime Startup Error', chrome.runtime.lastError.message);
        }
      });
    }

    // 4. Capture debugger attachment errors
    chrome.debugger.onDetach.addListener((source, reason) => {
      if (reason && reason !== 'target_closed') {
        this.logError('Debugger Detach Error', `Debugger detached from tab ${source.tabId}: ${reason}`, null, {
          tabId: source.tabId,
          reason: reason
        });
      }
    });

    // 5. Capture tab errors
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      // Check if we had debugger attached to this tab
      if (this.debuggerAttached.has(tabId)) {
        this.logError('Tab Closed with Debugger', `Tab ${tabId} was closed while debugger was attached`, null, {
          tabId: tabId,
          removeInfo: removeInfo
        });
        
        // Clean up stale debugger attachment
        this.debuggerAttached.delete(tabId);
        this.debuggerSessions.delete(tabId);
      }
    });

    // 6. Monitor for Chrome API errors
    this.setupChromeAPIErrorMonitoring();
  }

  setupChromeAPIErrorMonitoring() {
    // Wrap Chrome API calls to catch errors
    const originalTabsUpdate = chrome.tabs.update;
    chrome.tabs.update = async (...args) => {
      try {
        return await originalTabsUpdate.apply(chrome.tabs, args);
      } catch (error) {
        this.logError('Chrome Tabs API Error', `tabs.update failed: ${error.message}`, error.stack, {
          api: 'chrome.tabs.update',
          args: args
        });
        throw error;
      }
    };

    const originalDebuggerAttach = chrome.debugger.attach;
    chrome.debugger.attach = async (...args) => {
      try {
        return await originalDebuggerAttach.apply(chrome.debugger, args);
      } catch (error) {
        this.logError('Chrome Debugger API Error', `debugger.attach failed: ${error.message}`, error.stack, {
          api: 'chrome.debugger.attach',
          args: args
        });
        throw error;
      }
    };
  }

  logError(type, message, stack = null, context = {}) {
    const errorEntry = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: type,
      message: message,
      stack: stack,
      url: globalThis.location?.href || 'Extension Background',
      userAgent: navigator.userAgent,
      context: context
    };

    this.extensionErrors.unshift(errorEntry);
    
    // Keep only recent errors
    if (this.extensionErrors.length > this.maxErrorEntries) {
      this.extensionErrors = this.extensionErrors.slice(0, this.maxErrorEntries);
    }

    // Also log to console for debugging
    console.error(`[BROP Error] ${type}: ${message}`, stack ? `\nStack: ${stack}` : '');
    
    this.saveSettings();
  }

  async detachDebuggerFromAllTabs() {
    try {
      const detachPromises = [];
      
      for (const tabId of this.debuggerAttached) {
        detachPromises.push(this.detachDebuggerFromTab(tabId));
      }
      
      await Promise.allSettled(detachPromises);
      console.log('🔧 Detached debugger from all tabs');
      
      return true;
    } catch (error) {
      console.error('Failed to detach debugger from tabs:', error);
      return false;
    }
  }

  handleDebuggerEvent(source, method, params) {
    // Forward debugger events to bridge if needed
    if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
      this.sendToBridge({
        type: 'debugger_event',
        tabId: source.tabId,
        method: method,
        params: params,
        timestamp: Date.now()
      });
    }
  }

  handleDebuggerDetach(source, reason) {
    const tabId = source.tabId;
    console.log(`🔧 Debugger detached from tab ${tabId}, reason: ${reason}`);
    
    // Clean up our tracking
    this.debuggerSessions.delete(tabId);
    this.debuggerAttached.delete(tabId);
    
    // If we're still enabled and connected, try to reattach (unless user initiated detach)
    if (this.enabled && this.isConnected && reason !== 'canceled_by_user') {
      setTimeout(() => {
        this.attachDebuggerToTab(tabId);
      }, 1000);
    }
  }

  handleTabCreated(tab) {
    // Auto-attach debugger to new tabs if we're active
    if (this.enabled && this.isConnected && tab.url && 
        !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      setTimeout(() => {
        this.attachDebuggerToTab(tab.id);
      }, 500); // Small delay to let tab initialize
    }
  }

  handleTabRemoved(tabId) {
    // Clean up debugger session for removed tab
    this.debuggerSessions.delete(tabId);
    this.debuggerAttached.delete(tabId);
    this.sentTargetIds.delete(`tab_${tabId}`);
  }

  handleTabUpdated(tabId, changeInfo, tab) {
    // If tab URL changed and we're not attached, attach debugger
    if (this.enabled && this.isConnected && changeInfo.url && 
        !this.debuggerAttached.has(tabId) &&
        !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      setTimeout(() => {
        this.attachDebuggerToTab(tabId);
      }, 500);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['brop_enabled', 'brop_logs', 'brop_errors']);
      this.enabled = result.brop_enabled !== false;
      this.callLogs = result.brop_logs || [];
      this.extensionErrors = result.brop_errors || [];
      console.log(`BROP bridge client loaded: ${this.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error loading BROP settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({
        'brop_enabled': this.enabled,
        'brop_logs': this.callLogs.slice(-this.maxLogEntries),
        'brop_errors': this.extensionErrors.slice(-this.maxErrorEntries)
      });
    } catch (error) {
      console.error('Error saving BROP settings:', error);
    }
  }

  connectToBridge() {
    if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.CONNECTING) {
      return; // Already trying to connect
    }

    this.connectionStatus = 'connecting';
    this.broadcastStatusUpdate();
    
    console.log(`Connecting to BROP bridge server at ${this.bridgeUrl}... (attempt ${this.reconnectAttempts + 1})`);
    
    try {
      this.bridgeSocket = new WebSocket(this.bridgeUrl);
      
      this.bridgeSocket.onopen = () => {
        console.log('✅ Connected to BROP bridge server');
        this.isConnected = true;
        this.connectionStatus = 'connected';
        this.lastConnectionTime = Date.now();
        this.reconnectAttempts = 0;
        
        // Reset target discovery state on new connection
        this.targetsDiscovered = false;
        this.sentTargetIds.clear();
        
        // Clear any pending reconnect timer
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        
        // Send connection confirmation
        this.sendToBridge({
          type: 'extension_ready',
          message: 'BROP extension connected and ready',
          timestamp: Date.now()
        });
        
        // Attach debugger to all tabs to show "debugging this browser" status
        if (this.enabled) {
          setTimeout(() => {
            this.attachDebuggerToAllTabs();
          }, 1000);
        }
        
        this.broadcastStatusUpdate();
      };
      
      this.bridgeSocket.onmessage = (event) => {
        this.handleBridgeMessage(event.data);
      };
      
      this.bridgeSocket.onclose = (event) => {
        console.log(`🔌 Disconnected from BROP bridge server (code: ${event.code})`);
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
        this.bridgeSocket = null;
        
        // Detach debuggers when disconnected to remove "debugging this browser" status
        this.detachDebuggerFromAllTabs();
        
        this.broadcastStatusUpdate();
        
        // Attempt to reconnect
        this.scheduleReconnect();
      };
      
      this.bridgeSocket.onerror = (error) => {
        console.error('Bridge connection error:', error);
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
        this.broadcastStatusUpdate();
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.connectionStatus = 'disconnected';
      this.broadcastStatusUpdate();
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    // Clear any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Always try to reconnect every 5 seconds, don't give up
    const delay = 5000; // Fixed 5 second interval
    
    this.reconnectAttempts++;
    console.log(`Scheduling reconnect to bridge server in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connectToBridge();
    }, delay);
  }

  generateUUID() {
    // Generate RFC 4122 compliant UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  getTabIdFromTarget(targetId) {
    // Extract tab ID from target ID format: "tab_123456"
    if (targetId && targetId.startsWith('tab_')) {
      const tabId = parseInt(targetId.replace('tab_', ''));
      return isNaN(tabId) ? null : tabId;
    }
    return null;
  }

  broadcastStatusUpdate() {
    // Broadcast status update to any listening popup or content scripts
    const statusUpdate = {
      type: 'BRIDGE_STATUS_UPDATE',
      connectionStatus: this.connectionStatus,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastConnectionTime: this.lastConnectionTime,
      bridgeUrl: this.bridgeUrl,
      timestamp: Date.now()
    };

    // Send to any open popup
    chrome.runtime.sendMessage(statusUpdate).catch(() => {
      // Ignore errors if no popup is open
    });
  }

  sendToBridge(message) {
    if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
      this.bridgeSocket.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('Bridge connection not available, cannot send message');
      return false;
    }
  }

  async handleBridgeMessage(data) {
    try {
      const message = JSON.parse(data);
      const messageType = message.type;
      
      if (messageType === 'welcome') {
        console.log('Bridge server welcome:', message.message);
        return;
      }
      
      if (messageType === 'cdp_command') {
        await this.processCDPCommand(message);
      } else if (messageType === 'brop_command') {
        await this.processBROPCommand(message);
      } else {
        console.warn('Unknown message type from bridge:', messageType);
      }
    } catch (error) {
      console.error('Error handling bridge message:', error);
      // Don't let errors disconnect us - send error response
      if (message && message.id) {
        this.sendToBridge({
          type: 'response',
          id: message.id,
          success: false,
          error: `Message handling error: ${error.message}`
        });
      }
    }
  }

  async processCDPCommand(message) {
    const { id, method, params, targetId } = message;
    
    console.log(`Processing CDP command: ${method}${targetId ? ` (target: ${targetId})` : ''}`, params ? `with params: ${JSON.stringify(params).substring(0, 100)}` : '');
    
    // Check if service is enabled
    if (!this.enabled) {
      console.log(`CDP command ignored (service disabled): ${method}`);
      this.sendToBridge({
        type: 'response',
        id: id,
        success: false,
        error: 'BROP service is disabled'
      });
      return;
    }
    
    try {
      const handler = this.cdpHandlers.get(method);
      if (handler) {
        // Pass target context to handler
        const result = await handler(params, targetId);
        console.log(`CDP command ${method} completed successfully${targetId ? ` for target ${targetId}` : ''}`);
        
        // Log successful CDP command
        this.logCall(method, 'CDP', params, result, null, null);
        
        this.sendToBridge({
          type: 'response',
          id: id,
          success: true,
          result: result
        });
      } else {
        console.warn(`Unsupported CDP method: ${method}`);
        
        // Log unsupported CDP command
        this.logCall(method, 'CDP', params, null, `Unsupported CDP method: ${method}`, null);
        
        this.sendToBridge({
          type: 'response',
          id: id,
          success: false,
          error: `Unsupported CDP method: ${method}`
        });
      }
    } catch (error) {
      console.error(`CDP command error (${method}):`, error);
      this.logError('CDP Command Error', `${method}: ${error.message}`, error.stack);
      
      // Log failed CDP command
      this.logCall(method, 'CDP', params, null, error.message, null);
      
      this.sendToBridge({
        type: 'response',
        id: id,
        success: false,
        error: error.message
      });
    }
  }

  async processBROPCommand(message) {
    const { id, command } = message;
    const commandType = command?.type;
    
    // Check if service is enabled
    if (!this.enabled) {
      console.log(`BROP command ignored (service disabled): ${commandType}`);
      this.sendToBridge({
        type: 'response',
        id: id,
        success: false,
        error: 'BROP service is disabled'
      });
      return;
    }
    
    try {
      const handler = this.messageHandlers.get(commandType);
      if (handler) {
        const result = await handler(command.params || {});
        
        // Log successful BROP command
        this.logCall(commandType, 'BROP', command.params, result, null, null);
        
        this.sendToBridge({
          type: 'response',
          id: id,
          success: true,
          result: result
        });
      } else {
        throw new Error(`Unsupported BROP command: ${commandType}`);
      }
    } catch (error) {
      console.error(`BROP command error (${commandType}):`, error);
      this.logError('BROP Command Error', `${commandType}: ${error.message}`, error.stack);
      
      // Log failed BROP command
      this.logCall(commandType, 'BROP', command.params, null, error.message, null);
      
      this.sendToBridge({
        type: 'response',
        id: id,
        success: false,
        error: error.message
      });
    }
  }

  // CDP Method Implementations
  async cdpBrowserGetVersion(params) {
    // Send existing targets immediately when Playwright first connects
    // This ensures targets are available before any other operations
    if (!this.targetsDiscovered) {
      console.log('Browser.getVersion called - sending existing targets immediately');
      await this.sendExistingTargets();
    }
    
    return {
      protocolVersion: "1.3",
      product: "Chrome/BROP-Extension",
      revision: "@1.0.0",
      userAgent: "Mozilla/5.0 (Chrome BROP Extension)",
      jsVersion: "12.0.0"
    };
  }

  async sendExistingTargets() {
    if (this.targetsDiscovered) {
      console.log('Targets already discovered - skipping');
      return;
    }
    
    console.log('Sending existing targets proactively...');
    this.targetsDiscovered = true;
    
    const tabs = await chrome.tabs.query({});
    console.log(`Found ${tabs.length} existing tabs to send proactively`);
    
    for (const tab of tabs) {
      // Skip chrome:// URLs and other internal pages
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.log(`Skipping internal tab: ${tab.url}`);
        continue;
      }
      
      const targetId = `tab_${tab.id}`;
      
      if (this.sentTargetIds.has(targetId)) {
        console.log(`Already sent target: ${targetId}`);
        continue;
      }
      
      console.log(`Proactively sending target: ${tab.id} - ${tab.title}`);
      this.sentTargetIds.add(targetId);
      
      const targetInfo = {
        targetId: targetId,
        type: "page",
        title: tab.title || "New Tab",
        url: tab.url || "about:blank",
        attached: false,
        canAccessOpener: false,
        browserContextId: "default"
      };
      
      // Send target created event
      this.sendTargetCreatedEvent(targetInfo);
    }
  }

  async cdpBrowserSetDownloadBehavior(params) {
    // Just acknowledge the download behavior setting
    console.log('Browser download behavior set:', params);
    return {};
  }

  async cdpBrowserGetWindowForTarget(params) {
    const { targetId } = params;
    console.log('Getting window for target:', targetId, 'params:', JSON.stringify(params));
    
    // If no targetId is provided, get the current active tab's window
    let tabId;
    
    if (targetId && targetId.startsWith('tab_')) {
      tabId = parseInt(targetId.replace('tab_', ''));
    } else {
      // No targetId provided - get current active tab
      console.log('No targetId provided, getting current active tab');
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
          tabId = activeTab.id;
          console.log('Using active tab:', tabId);
        }
      } catch (error) {
        console.log('Failed to get active tab:', error);
      }
    }
    
    if (tabId) {
      try {
        // Get tab information
        const tab = await chrome.tabs.get(tabId);
        console.log('Found tab:', tab.id, 'in window:', tab.windowId);
        
        // Get window information
        const window = await chrome.windows.get(tab.windowId);
        console.log('Window info:', JSON.stringify({
          id: window.id,
          left: window.left,
          top: window.top,
          width: window.width,
          height: window.height
        }));
        
        // Return window bounds information in the exact format Playwright expects
        const response = {
          windowId: window.id,
          bounds: {
            left: window.left || 0,
            top: window.top || 0,
            width: window.width || 1200,
            height: window.height || 800
          }
        };
        
        console.log('Returning Browser.getWindowForTarget response:', JSON.stringify(response));
        return response;
      } catch (error) {
        console.error('Failed to get window for tab:', tabId, error);
      }
    }
    
    // Return default window information when no specific target or if lookup failed
    console.log('Returning default window information');
    const defaultResponse = {
      windowId: 1,
      bounds: {
        left: 0,
        top: 0,
        width: 1200,
        height: 800
      }
    };
    console.log('Returning default Browser.getWindowForTarget response:', JSON.stringify(defaultResponse));
    return defaultResponse;
  }

  async cdpTargetSetDiscoverTargets(params) {
    const { discover } = params;
    console.log('Target discovery set to:', discover);
    
    if (discover) {
      console.log('Target discovery enabled - sending existing targets');
      
      // When target discovery is enabled, we should send targetCreated events for existing targets
      const tabs = await chrome.tabs.query({});
      console.log(`Found ${tabs.length} existing tabs to report`);
      
      for (const tab of tabs) {
        // Skip chrome:// URLs and other internal pages
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          console.log(`Skipping internal tab: ${tab.url}`);
          continue;
        }
        
        console.log(`Sending targetCreated for existing tab: ${tab.id} - ${tab.title}`);
        
        // Send target created event for each existing tab
        this.sendTargetCreatedEvent({
          targetId: `tab_${tab.id}`,
          type: "page",
          title: tab.title || "New Tab",
          url: tab.url || "about:blank",
          attached: true,
          canAccessOpener: false,
          browserContextId: "default"
        });
      }
    }
    
    return {};
  }

  async cdpTargetGetTargets(params) {
    // Get ALL tabs, not just current window
    const tabs = await chrome.tabs.query({});
    
    console.log(`Getting targets: found ${tabs.length} tabs total`);
    
    const targets = [];
    
    // Add browser context target first
    targets.push({
      targetId: "browser_context_default",
      type: "browser",
      title: "",
      url: "",
      attached: true, // Browser context should be attached
      canAccessOpener: false,
      browserContextId: "default"
    });
    
    // Add page targets for each tab
    for (const tab of tabs) {
      // Skip chrome:// URLs and other internal pages
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.log(`Skipping internal tab: ${tab.url}`);
        continue;
      }
      
      console.log(`Adding tab target: ${tab.id} - ${tab.title} - ${tab.url}`);
      targets.push({
        targetId: `tab_${tab.id}`,
        type: "page",
        title: tab.title || "New Tab",
        url: tab.url || "about:blank",
        attached: true, // Mark existing tabs as attached so Playwright can use them
        canAccessOpener: false,
        browserContextId: "default"
      });
    }

    console.log(`Returning ${targets.length} targets total (${targets.length - 1} pages)`);
    return { targetInfos: targets };
  }

  async cdpTargetAttachToTarget(params) {
    const { targetId, flatten } = params;
    
    console.log(`Attaching to target: ${targetId}, flatten: ${flatten}`);
    
    // Use UUID-like session ID format that matches real Chrome CDP
    const sessionId = this.generateUUID();
    console.log(`Created session: ${sessionId}`);
    
    return {
      sessionId: sessionId
    };
  }

  async cdpTargetSetAutoAttach(params) {
    const { autoAttach, waitForDebuggerOnStart, flatten } = params;
    console.log('Target auto-attach set:', params);
    
    // Re-enable auto-attach but with proper session management
    // The assertion errors were caused by session routing, not auto-attach itself
    this.autoAttachEnabled = autoAttach;
    this.waitForDebuggerOnStart = waitForDebuggerOnStart;
    this.flattenAutoAttach = flatten;
    
    // DISABLED: Auto-attach causes assertion errors in Playwright
    console.log('DISABLED auto-attach behavior to prevent Playwright assertion errors');
    // When auto-attach is enabled, proactively send existing targets (but only once)
    if (false && autoAttach && !this.targetsDiscovered) {
      console.log('Auto-attach enabled - proactively sending existing targets (first time)');
      this.targetsDiscovered = true;
      
      // Send target events for existing tabs
      const tabs = await chrome.tabs.query({});
      console.log(`Found ${tabs.length} existing tabs to report via auto-attach`);
      
      for (const tab of tabs) {
        // Skip chrome:// URLs and other internal pages
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          console.log(`Skipping internal tab: ${tab.url}`);
          continue;
        }
        
        const targetId = `tab_${tab.id}`;
        
        // Skip if we've already sent this target
        if (this.sentTargetIds.has(targetId)) {
          console.log(`Already sent target: ${targetId}`);
          continue;
        }
        
        console.log(`Auto-attach: Sending targetCreated for tab: ${tab.id} - ${tab.title}`);
        this.sentTargetIds.add(targetId);
        
        const targetInfo = {
          targetId: targetId,
          type: "page",
          title: tab.title || "New Tab",
          url: tab.url || "about:blank",
          attached: false,
          canAccessOpener: false,
          browserContextId: "default"
        };
        
        // Send target created event
        this.sendTargetCreatedEvent(targetInfo);
        
        // If auto-attach is enabled, also send attached event
        const sessionId = this.generateUUID();
        const attachInfo = {
          sessionId: sessionId,
          targetInfo: {
            ...targetInfo,
            attached: true
          },
          waitingForDebugger: false
        };
        console.log('🔧 DEBUG: Sending Target.attachedToTarget with sessionId:', attachInfo.sessionId, 'waitingForDebugger:', attachInfo.waitingForDebugger);
        this.sendTargetAttachedEvent(attachInfo);
      }
    } else if (autoAttach && this.targetsDiscovered) {
      console.log('Auto-attach enabled but targets already discovered - skipping duplicate events');
    }
    
    return {};
  }

  async cdpTargetGetTargetInfo(params) {
    const { targetId } = params;
    
    // If targetId provided, get specific target info
    if (targetId) {
      if (targetId === "browser_context_default") {
        return {
          targetInfo: {
            targetId: "browser_context_default",
            type: "browser",
            title: "",
            url: "",
            attached: false,
            canAccessOpener: false,
            browserContextId: "default"
          }
        };
      } else if (targetId.startsWith('tab_')) {
        const tabId = parseInt(targetId.replace('tab_', ''));
        try {
          const tab = await chrome.tabs.get(tabId);
          return {
            targetInfo: {
              targetId: targetId,
              type: "page",
              title: tab.title,
              url: tab.url,
              attached: false,
              canAccessOpener: false,
              browserContextId: "default"
            }
          };
        } catch (error) {
          console.error('Failed to get tab info:', error);
        }
      }
    }
    
    // Fallback to current active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    return {
      targetInfo: {
        targetId: activeTab ? `tab_${activeTab.id}` : "tab_default",
        type: "page",
        title: activeTab ? activeTab.title : "BROP Tab",
        url: activeTab ? activeTab.url : "about:blank",
        attached: false,
        canAccessOpener: false,
        browserContextId: "default"
      }
    };
  }

  async cdpTargetCreateTarget(params) {
    const { url, width, height, browserContextId, enableBeginFrameControl } = params;
    
    console.log('Creating target with params:', params);
    
    // Create a new tab
    const newTab = await chrome.tabs.create({
      url: url || 'about:blank',
      active: false
    });
    
    console.log('Created new tab:', newTab.id);
    
    const targetId = `tab_${newTab.id}`;
    
    // Wait a moment for tab to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Send Target.targetCreated event to bridge
    const targetInfo = {
      targetId: targetId,
      type: "page",
      title: newTab.title || "New Tab", 
      url: newTab.url || url || 'about:blank',
      attached: false,
      canAccessOpener: false,
      browserContextId: browserContextId || "default"
    };
    
    this.sendTargetCreatedEvent(targetInfo);
    
    // Re-enable auto-attach with proper session management
    if (this.autoAttachEnabled) {
      console.log('Auto-attaching to new target:', targetId);
      const sessionId = this.generateUUID();
      
      // Send Target.attachedToTarget event - but with proper session routing
      const attachInfo = {
        sessionId: sessionId,
        targetInfo: {
          ...targetInfo,
          attached: true
        },
        waitingForDebugger: false
      };
      console.log('🔧 DEBUG: Sending Target.attachedToTarget (createTarget) with sessionId:', attachInfo.sessionId, 'waitingForDebugger:', attachInfo.waitingForDebugger);
      this.sendTargetAttachedEvent(attachInfo);
    }
    
    return {
      targetId: targetId
    };
  }

  sendTargetCreatedEvent(targetInfo) {
    // Send target created event to bridge
    if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
      this.sendToBridge({
        type: 'event',
        event_type: 'target_created',
        method: 'Target.targetCreated',
        params: {
          targetInfo: targetInfo
        }
      });
      console.log('Sent Target.targetCreated event for:', targetInfo.targetId);
      
      // CRITICAL: Also send Runtime.executionContextCreated event
      // This is what Playwright needs to properly initialize pages
      setTimeout(() => {
        this.sendExecutionContextCreatedEvent(targetInfo.targetId);
      }, 100); // Small delay to ensure target is ready
    }
  }

  sendExecutionContextCreatedEvent(targetId) {
    // Send execution context created event - CRITICAL for Playwright page initialization
    if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
      const contextId = Math.floor(Math.random() * 1000000); // Generate unique context ID
      
      this.sendToBridge({
        type: 'event',
        event_type: 'execution_context_created',
        method: 'Runtime.executionContextCreated',
        params: {
          context: {
            id: contextId,
            origin: 'about:blank',
            name: '',
            auxData: {
              isDefault: true,
              type: 'default',
              frameId: 'main_frame'
            }
          }
        }
      });
      console.log('Sent Runtime.executionContextCreated event for target:', targetId);
    }
  }

  sendTargetAttachedEvent(attachInfo) {
    // Send target attached event to bridge
    if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
      this.sendToBridge({
        type: 'event',
        event_type: 'target_attached',
        method: 'Target.attachedToTarget',
        params: attachInfo
      });
      console.log('Sent Target.attachedToTarget event for:', attachInfo.targetInfo.targetId);
    }
  }

  async cdpTargetCloseTarget(params) {
    const { targetId } = params;
    
    // Extract tab ID from target ID
    if (targetId.startsWith('tab_')) {
      const tabId = parseInt(targetId.replace('tab_', ''));
      try {
        await chrome.tabs.remove(tabId);
        return { success: true };
      } catch (error) {
        console.error('Failed to close tab:', error);
        return { success: false };
      }
    }
    
    return { success: false };
  }

  async cdpRuntimeEnable(params) {
    return {};
  }

  async cdpRuntimeAddBinding(params) {
    const { name, executionContextId } = params;
    console.log('Runtime binding added:', name);
    return {};
  }

  async cdpRuntimeRunIfWaitingForDebugger(params) {
    return {};
  }

  async cdpRuntimeSetCustomObjectFormatterEnabled(params) {
    const { enabled } = params;
    console.log('Custom object formatter enabled:', enabled);
    return {};
  }

  async cdpPageEnable(params) {
    return {};
  }

  async cdpPageAddScriptToEvaluateOnNewDocument(params) {
    const { source, worldName } = params;
    console.log('Script added to evaluate on new document:', { source: source?.substring(0, 100), worldName });
    return {
      identifier: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  async cdpPageRemoveScriptToEvaluateOnNewDocument(params) {
    const { identifier } = params;
    console.log('Script removed from new document evaluation:', identifier);
    return {};
  }

  async cdpPageSetLifecycleEventsEnabled(params) {
    const { enabled } = params;
    console.log('Page lifecycle events enabled:', enabled);
    return {};
  }

  async cdpPageGetFrameTree(params) {
    // For a newly created page, we need to use the target's tab info
    // Get the tab that corresponds to this CDP session
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // If no active tab, try to get any tab for this target
    let targetTab = activeTab;
    if (!targetTab) {
      const allTabs = await chrome.tabs.query({});
      targetTab = allTabs[allTabs.length - 1]; // Use the most recently created tab
    }
    
    const url = targetTab?.url || "about:blank";
    let securityOrigin;
    try {
      securityOrigin = url === "about:blank" ? "null" : new URL(url).origin;
    } catch {
      securityOrigin = "null";
    }
    
    const frameTree = {
      frame: {
        id: "main_frame",
        loaderId: `loader_${Date.now()}`,
        url: url,
        domainAndRegistry: "",
        securityOrigin: securityOrigin,
        mimeType: "text/html",
        adFrameType: "none"
      },
      childFrames: []
    };
    
    console.log('Returning frame tree for URL:', url);
    return { frameTree };
  }

  async cdpNetworkEnable(params) {
    return {};
  }

  async cdpLogEnable(params) {
    console.log('Log domain enabled');
    return {};
  }

  async cdpEmulationSetFocusEmulationEnabled(params) {
    const { enabled } = params;
    console.log('Focus emulation enabled:', enabled);
    return {};
  }

  async cdpEmulationSetEmulatedMedia(params) {
    const { media, features } = params;
    console.log('Emulated media set:', { media, features });
    return {};
  }

  async cdpPageNavigate(params, targetId) {
    const { url } = params;
    
    // Extract tab ID from target ID
    const tabId = this.getTabIdFromTarget(targetId);
    if (!tabId) {
      throw new Error(`Invalid target ID: ${targetId}`);
    }

    await chrome.tabs.update(tabId, { url });
    
    // Wait for navigation to complete
    return new Promise((resolve) => {
      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve({
            frameId: '1',
            loaderId: `loader_${Date.now()}`
          });
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      
      // Add timeout to prevent hanging
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve({
          frameId: '1',
          loaderId: `loader_${Date.now()}`
        });
      }, 5000);
    });
  }

  async cdpRuntimeEvaluate(params, targetId) {
    const { expression, returnByValue = true } = params;
    
    // Extract tab ID from target ID
    const tabId = this.getTabIdFromTarget(targetId);
    if (!tabId) {
      throw new Error(`Invalid target ID: ${targetId}`);
    }

    try {
      // Use Chrome's executeScript API which respects CSP
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (code) => {
          try {
            // Use Function constructor instead of eval to bypass some CSP restrictions
            const result = new Function('return ' + code)();
            return { success: true, result: result };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        args: [expression]
      });

      const result = results[0]?.result;
      if (!result?.success) {
        throw new Error(result?.error || 'Evaluation failed');
      }

      return {
        result: {
          type: typeof result.result,
          value: result.result
        }
      };
    } catch (error) {
      // If executeScript fails due to CSP, try a simpler approach
      if (error.message.includes('Content Security Policy')) {
        console.log('CSP blocked executeScript, trying alternative approach');
        
        // For CSP-restricted sites, we can still get basic page info
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              // These don't require eval and work with most CSP policies
              if (window.location && document) {
                return {
                  success: true,
                  result: document.title || window.location.href || 'CSP-restricted page'
                };
              }
              return { success: false, error: 'Document not accessible' };
            }
          });
          
          const result = results[0]?.result;
          if (result?.success) {
            return {
              result: {
                type: 'string',
                value: result.result
              }
            };
          }
        } catch (altError) {
          console.log('Alternative approach also failed:', altError);
        }
      }
      
      throw error;
    }
  }

  async cdpPageCaptureScreenshot(params) {
    const { format = 'png', quality = 90, fromSurface = true } = params;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: format === 'jpeg' ? 'jpeg' : 'png',
      quality: quality
    });

    // Remove data URL prefix to get just the base64 data
    const base64Data = dataUrl.split(',')[1];
    
    return {
      data: base64Data
    };
  }

  // BROP Method Implementations (same as before)
  async handleGetConsoleLogs(params) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        if (window.BROP && window.BROP.getConsoleLogs) {
          return window.BROP.getConsoleLogs();
        }
        return [];
      }
    });

    return { logs: results[0]?.result || [] };
  }

  async handleExecuteConsole(params) {
    const { code } = params;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (code) => {
        try {
          const result = eval(code);
          console.log('BROP Execute:', result);
          return result;
        } catch (error) {
          console.error('BROP Execute Error:', error);
          throw error;
        }
      },
      args: [code]
    });

    return { result: results[0]?.result };
  }

  async handleGetScreenshot(params) {
    const { full_page = false, format = 'png' } = params;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: format === 'jpeg' ? 'jpeg' : 'png'
    });

    return { 
      image_data: dataUrl.split(',')[1],
      format: format
    };
  }

  async handleGetPageContent(params) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => ({
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
        title: document.title,
        url: window.location.href
      })
    });

    return results[0]?.result || {};
  }

  async handleNavigate(params) {
    const { url } = params;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    await chrome.tabs.update(activeTab.id, { url });
    return { success: true };
  }

  // Browser context management
  async cdpBrowserCreateBrowserContext(params) {
    const { disposeOnDetach, proxyServer, proxyBypassList } = params;
    // Generate a unique browser context ID
    const contextId = `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Creating browser context:', contextId);
    return { browserContextId: contextId };
  }

  async cdpBrowserDisposeBrowserContext(params) {
    const { browserContextId } = params;
    console.log('Disposing browser context:', browserContextId);
    return {};
  }

  async cdpBrowserGetBrowserContexts(params) {
    // Return a default browser context
    return { 
      browserContextIds: ["default"] 
    };
  }

  async cdpTargetActivateTarget(params) {
    const { targetId } = params;
    
    // Extract tab ID from target ID and activate the tab
    if (targetId.startsWith('tab_')) {
      const tabId = parseInt(targetId.replace('tab_', ''));
      try {
        await chrome.tabs.update(tabId, { active: true });
        return {};
      } catch (error) {
        console.error('Failed to activate tab:', error);
        return {};
      }
    }
    
    return {};
  }

  async cdpTargetDetachFromTarget(params) {
    const { sessionId, targetId } = params;
    console.log('Detaching from target:', { sessionId, targetId });
    return {};
  }

  async cdpTargetSendMessageToTarget(params) {
    const { message, sessionId, targetId } = params;
    console.log('Send message to target:', { message: message?.substring(0, 100), sessionId, targetId });
    
    // For now, just acknowledge the message was sent
    // In a full implementation, this would route the message to the appropriate target
    return {};
  }

  async cdpTargetReceivedMessageFromTarget(params) {
    console.log('Received message from target:', params);
    return {};
  }

  async cdpTargetTargetCrashed(params) {
    console.log('Target crashed:', params);
    return {};
  }

  async cdpTargetTargetDestroyed(params) {
    console.log('Target destroyed:', params);
    return {};
  }

  async cdpBrowserClose(params) {
    console.log('Browser close requested');
    return {};
  }

  async cdpBrowserCrash(params) {
    console.log('Browser crash requested');
    return {};
  }

  async cdpTargetSetRemoteLocations(params) {
    const { locations } = params;
    console.log('Set remote locations:', locations);
    return {};
  }

  async cdpTargetCreateBrowserContext(params) {
    const { disposeOnDetach, proxyServer, proxyBypassList } = params;
    
    // Generate a unique browser context ID  
    const contextId = `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Creating target browser context:', contextId);
    
    // This is the same as Browser.createBrowserContext but under Target domain
    return { browserContextId: contextId };
  }

  async cdpTargetDisposeBrowserContext(params) {
    const { browserContextId } = params;
    console.log('Disposing target browser context:', browserContextId);
    // This is the same as Browser.disposeBrowserContext but under Target domain
    return {};
  }

  async cdpTargetSetAttachToFrames(params) {
    const { value } = params;
    console.log('Set attach to frames:', value);
    return {};
  }

  // Additional BROP methods would be implemented here...
  async handleClick(params) { /* Implementation */ }
  async handleType(params) { /* Implementation */ }
  async handleWaitForElement(params) { /* Implementation */ }
  async handleEvaluateJS(params) { /* Implementation */ }
  async handleGetElement(params) { /* Implementation */ }
  
  async handleGetSimplifiedDOM(params) {
    // Forward simplified DOM request to active tab's content script
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    try {
      // Send message to content script
      const result = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'BROP_EXECUTE',
        command: {
          type: 'get_simplified_dom',
          params: params
        },
        id: `simplified_dom_${Date.now()}`
      });

      if (result.success) {
        return result.result;
      } else {
        throw new Error(result.error || 'Failed to get simplified DOM');
      }
    } catch (error) {
      console.error('Simplified DOM request failed:', error);
      throw new Error(`Simplified DOM error: ${error.message}`);
    }
  }

  async handleGetExtensionErrors(params) {
    const limit = params?.limit || 50;
    const errors = this.extensionErrors.slice(0, limit);
    
    return {
      errors: errors,
      total_errors: this.extensionErrors.length,
      max_stored: this.maxErrorEntries,
      extension_info: {
        name: chrome.runtime.getManifest()?.name || 'BROP Extension',
        version: chrome.runtime.getManifest()?.version || '1.0.0',
        id: chrome.runtime.id
      }
    };
  }

  async handleGetChromeExtensionErrors(params) {
    const errors = [];
    
    try {
      // Method 1: Check chrome.runtime.lastError if available
      if (chrome.runtime.lastError) {
        errors.push({
          type: 'Chrome Runtime Error',
          message: chrome.runtime.lastError.message,
          timestamp: Date.now(),
          source: 'chrome.runtime.lastError'
        });
      }
      
      // Method 2: Try to access extension management API for error details
      if (chrome.management) {
        try {
          const extensionInfo = await new Promise((resolve, reject) => {
            chrome.management.getSelf((info) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(info);
              }
            });
          });
          
          // Note: Chrome doesn't provide direct API access to extension console errors
          // This is a limitation of the Chrome Extension API
        } catch (error) {
          errors.push({
            type: 'Management API Error',
            message: error.message,
            timestamp: Date.now(),
            source: 'chrome.management.getSelf'
          });
        }
      }
      
      // Method 3: Check for specific Chrome extension error patterns
      // We'll need to capture these through other means since Chrome doesn't expose them directly
      
      // Method 4: Check debugger attachment errors
      const debuggerErrors = [];
      for (const tabId of this.debuggerAttached) {
        try {
          // Try to query the tab to see if it still exists
          const tab = await chrome.tabs.get(tabId);
          if (!tab) {
            debuggerErrors.push({
              type: 'Debugger Tab Error',
              message: `Tab ${tabId} no longer exists but debugger still attached`,
              timestamp: Date.now(),
              source: 'debugger_tab_check',
              tabId: tabId
            });
          }
        } catch (error) {
          debuggerErrors.push({
            type: 'Debugger Tab Error', 
            message: `Failed to access tab ${tabId}: ${error.message}`,
            timestamp: Date.now(),
            source: 'debugger_tab_check',
            tabId: tabId
          });
        }
      }
      
      errors.push(...debuggerErrors);
      
      // Method 5: Check for invalid debugger sessions
      for (const [tabId, session] of this.debuggerSessions) {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (!tab) {
            errors.push({
              type: 'Debugger Session Error',
              message: `Debugger session exists for non-existent tab ${tabId}`,
              timestamp: Date.now(),
              source: 'debugger_session_check',
              tabId: tabId
            });
          }
        } catch (error) {
          errors.push({
            type: 'Debugger Session Error',
            message: `Invalid debugger session for tab ${tabId}: ${error.message}`,
            timestamp: Date.now(), 
            source: 'debugger_session_check',
            tabId: tabId
          });
        }
      }
      
      // Method 6: Get all current tabs and check for inconsistencies
      try {
        const allTabs = await chrome.tabs.query({});
        const existingTabIds = new Set(allTabs.map(tab => tab.id));
        
        // Check for debugger attachments to non-existent tabs
        for (const attachedTabId of this.debuggerAttached) {
          if (!existingTabIds.has(attachedTabId)) {
            errors.push({
              type: 'Stale Debugger Attachment',
              message: `Debugger attached to non-existent tab ${attachedTabId}`,
              timestamp: Date.now(),
              source: 'tab_consistency_check',
              tabId: attachedTabId
            });
          }
        }
        
      } catch (error) {
        errors.push({
          type: 'Tab Query Error',
          message: `Failed to query tabs: ${error.message}`,
          timestamp: Date.now(),
          source: 'chrome.tabs.query'
        });
      }
      
      return {
        chrome_errors: errors,
        total_chrome_errors: errors.length,
        debugger_attached_tabs: Array.from(this.debuggerAttached),
        debugger_sessions: Array.from(this.debuggerSessions.keys()),
        note: 'Chrome Extension API does not expose console errors directly. These are detected issues based on extension state.',
        limitation: 'To see actual Chrome extension console errors, check chrome://extensions/ > Developer mode > Errors button for this extension'
      };
      
    } catch (error) {
      return {
        chrome_errors: [{
          type: 'Chrome Error Detection Failed',
          message: error.message,
          timestamp: Date.now(),
          source: 'handleGetChromeExtensionErrors'
        }],
        total_chrome_errors: 1,
        error: `Failed to check Chrome extension errors: ${error.message}`
      };
    }
  }

  async handleClearExtensionErrors(params) {
    const clearedCount = this.extensionErrors.length;
    
    // Clear all extension errors
    this.extensionErrors = [];
    
    // Also clear call logs if requested
    if (params?.clearLogs) {
      const clearedLogs = this.callLogs.length;
      this.callLogs = [];
      
      // Save cleared state
      await this.saveSettings();
      
      return {
        success: true,
        cleared_errors: clearedCount,
        cleared_logs: clearedLogs,
        message: `Cleared ${clearedCount} errors and ${clearedLogs} logs`
      };
    } else {
      // Save cleared state
      await this.saveSettings();
      
      return {
        success: true,
        cleared_errors: clearedCount,
        message: `Cleared ${clearedCount} extension errors`
      };
    }
  }

  async handleReloadExtension(params) {
    const reloadReason = params?.reason || 'Manual reload requested';
    const delay = params?.delay || 1000; // Default 1 second delay
    
    try {
      // Log the reload event
      this.logError('Extension Reload', `Extension reload requested: ${reloadReason}`, null, {
        reason: reloadReason,
        delay: delay,
        timestamp: Date.now()
      });
      
      // Save current state before reload
      await this.saveSettings();
      
      // Schedule the reload
      setTimeout(() => {
        console.log(`[BROP] Reloading extension: ${reloadReason}`);
        chrome.runtime.reload();
      }, delay);
      
      return {
        success: true,
        message: `Extension will reload in ${delay}ms`,
        reason: reloadReason,
        scheduled_time: Date.now() + delay
      };
      
    } catch (error) {
      this.logError('Extension Reload Error', `Failed to reload extension: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message,
        message: 'Failed to schedule extension reload'
      };
    }
  }

  async handleTestReloadFeature(params) {
    // This is a NEW feature added specifically to test extension reload
    const timestamp = new Date().toISOString();
    const message = params?.message || 'Hello from the NEW reload test feature!';
    
    console.log(`[BROP] 🆕 NEW FEATURE CALLED: test_reload_feature at ${timestamp}`);
    
    return {
      success: true,
      message: message,
      timestamp: timestamp,
      feature_version: '1.0.0',
      reload_test: true,
      note: 'This feature was added to test extension reload mechanism'
    };
  }
  
  async cdpDOMGetDocument(params) { /* Implementation */ }
  async cdpDOMQuerySelector(params) { /* Implementation */ }
  async cdpInputDispatchMouseEvent(params) { /* Implementation */ }
  async cdpInputInsertText(params) { /* Implementation */ }

  logCall(method, type, params, result, error, duration) {
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      method: method,
      type: type,
      params: JSON.stringify(params),
      result: result ? JSON.stringify(result) : undefined,
      error: error,
      success: !error,
      duration: duration
    };

    this.callLogs.unshift(logEntry);
    if (this.callLogs.length > this.maxLogEntries) {
      this.callLogs = this.callLogs.slice(0, this.maxLogEntries);
    }

    this.saveSettings();
  }
}

// Runtime message handling for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const messageType = message.type;

  if (messageType === 'GET_STATUS') {
    sendResponse({
      enabled: bropBridgeClient.enabled,
      connected: bropBridgeClient.isConnected,
      connectionStatus: bropBridgeClient.connectionStatus,
      reconnectAttempts: bropBridgeClient.reconnectAttempts,
      lastConnectionTime: bropBridgeClient.lastConnectionTime,
      bridgeUrl: bropBridgeClient.bridgeUrl,
      totalLogs: bropBridgeClient.callLogs.length,
      activeSessions: bropBridgeClient.isConnected ? 1 : 0,
      debuggerAttached: bropBridgeClient.debuggerAttached.size > 0,
      controlledTabs: bropBridgeClient.debuggerAttached.size,
      debuggerSessions: Array.from(bropBridgeClient.debuggerAttached)
    });
  } else if (messageType === 'SET_ENABLED') {
    bropBridgeClient.enabled = message.enabled;
    
    // Attach or detach debuggers based on enabled state
    if (message.enabled && bropBridgeClient.isConnected) {
      // Enable service - attach debuggers to show "debugging this browser"
      bropBridgeClient.attachDebuggerToAllTabs();
    } else if (!message.enabled) {
      // Disable service - detach debuggers to remove "debugging this browser"
      bropBridgeClient.detachDebuggerFromAllTabs();
    }
    
    bropBridgeClient.saveSettings();
    sendResponse({ success: true });
  } else if (messageType === 'GET_LOGS') {
    const limit = message.limit || 100;
    const logs = bropBridgeClient.callLogs.slice(-limit); // Get last N entries (most recent)
    sendResponse({ logs: logs });
  } else if (messageType === 'CLEAR_LOGS') {
    bropBridgeClient.callLogs = [];
    bropBridgeClient.saveSettings();
    sendResponse({ success: true });
  } else if (messageType === 'BROP_COMMAND') {
    // Handle direct BROP commands from popup (these respect the enabled setting)
    if (!bropBridgeClient.enabled) {
      sendResponse({ success: false, error: 'BROP service is disabled' });
      return;
    }
    
    const startTime = Date.now();
    bropBridgeClient.processBROPCommand(message).then(result => {
      const duration = Date.now() - startTime;
      bropBridgeClient.logCall(
        message.command?.type || 'unknown',
        'BROP',
        message.command?.params,
        result,
        null,
        duration
      );
      sendResponse({ success: true, response: result });
    }).catch(error => {
      const duration = Date.now() - startTime;
      bropBridgeClient.logCall(
        message.command?.type || 'unknown',
        'BROP',
        message.command?.params,
        null,
        error.message,
        duration
      );
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }
});

// Initialize the bridge client
const bropBridgeClient = new BROPBridgeClient();

// Export for debugging
self.bropBridgeClient = bropBridgeClient;