// Browser Remote Operations Protocol - Enhanced Popup Script with Logs and Service Control

class BROPPopupEnhanced {
  constructor() {
    this.currentTab = 'overview';
    this.logs = [];
    this.filteredLogs = [];
    this.serviceEnabled = true;
    this.refreshInterval = null;
    
    this.initializePopup();
    this.setupEventListeners();
    this.startRefreshInterval();
  }

  async initializePopup() {
    await this.updateStatus();
    await this.updateActiveTab();
    await this.loadLogs();
    this.setupTabs();
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Service toggle
    document.getElementById('service-toggle').addEventListener('click', () => {
      this.toggleService();
    });


    // Logs tab controls
    document.getElementById('refresh-logs').addEventListener('click', () => {
      this.loadLogs();
    });

    document.getElementById('open-fullscreen').addEventListener('click', () => {
      this.openFullScreenLogs();
    });

    document.getElementById('export-logs').addEventListener('click', () => {
      this.exportLogs();
    });

    document.getElementById('clear-all-logs').addEventListener('click', () => {
      this.clearAllLogs();
    });

    // Log filtering
    document.getElementById('log-filter').addEventListener('change', () => {
      this.filterLogs();
    });

    document.getElementById('status-filter').addEventListener('change', () => {
      this.filterLogs();
    });

    document.getElementById('search-filter').addEventListener('input', () => {
      this.filterLogs();
    });

    // Settings tab
    document.getElementById('reset-settings').addEventListener('click', () => {
      this.resetSettings();
    });

    // Listen for new log entries from background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'NEW_LOG_ENTRY') {
        this.handleNewLogEntry(message.log);
      } else if (message.type === 'BRIDGE_STATUS_UPDATE') {
        this.handleBridgeStatusUpdate(message);
      }
    });
  }

  setupTabs() {
    // Ensure correct tab is shown
    this.switchTab(this.currentTab);
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });

    // Load tab-specific data
    if (tabName === 'logs') {
      this.loadLogs();
    } else if (tabName === 'settings') {
      this.updateSettingsTab();
    }
  }

  async updateStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      
      this.serviceEnabled = response.enabled;
      
      // Update service toggle
      const toggle = document.getElementById('service-toggle');
      const serviceText = document.getElementById('service-text');
      
      if (response.enabled) {
        toggle.classList.add('active');
        serviceText.textContent = 'Enabled';
      } else {
        toggle.classList.remove('active');
        serviceText.textContent = 'Disabled';
      }

      // Update connection status (separate from service status)
      this.updateConnectionStatus(response);

      // Update stats
      document.getElementById('total-calls').textContent = response.totalLogs || 0;
      document.getElementById('active-sessions').textContent = response.activeSessions || 0;
      
      // Update debugger status
      this.updateDebuggerStatus(response);
      
    } catch (error) {
      console.error('Failed to get status:', error);
      this.setConnectionStatus('error', 'Error connecting to background script');
    }
  }

  updateConnectionStatus(response) {
    const statusElement = document.getElementById('connection-status');
    const statusText = document.getElementById('connection-text');
    
    // Update based on bridge connection status (independent of service enabled/disabled)
    switch (response.connectionStatus) {
      case 'connected':
        statusElement.className = 'status active';
        statusText.textContent = 'Bridge Connected';
        break;
      case 'connecting':
        statusElement.className = 'status connecting';
        statusText.textContent = `Connecting... (${response.reconnectAttempts || 0})`;
        break;
      case 'disconnected':
      default:
        statusElement.className = 'status inactive';
        const attempts = response.reconnectAttempts || 0;
        statusText.textContent = attempts > 0 ? `Bridge Offline (${attempts})` : 'Bridge Offline';
        break;
    }

    // Update bridge info section if it exists
    this.updateBridgeInfo(response);
  }

  setConnectionStatus(status, message) {
    const statusElement = document.getElementById('connection-status');
    const statusText = document.getElementById('connection-text');
    
    statusElement.className = `status ${status}`;
    statusText.textContent = message;
  }

  updateBridgeInfo(response) {
    // Update active tab to show bridge URL
    const bridgeInfoElement = document.getElementById('active-tab');
    if (bridgeInfoElement) {
      if (response.connected) {
        const connectedTime = response.lastConnectionTime ? 
          new Date(response.lastConnectionTime).toLocaleTimeString() : 'Unknown';
        bridgeInfoElement.textContent = `Bridge: ws://localhost:9224 (since ${connectedTime})`;
      } else {
        bridgeInfoElement.textContent = `Bridge: ws://localhost:9224 (offline)`;
      }
    }
  }

  updateDebuggerStatus(response) {
    // Update debugger status section
    const debuggerStatusElement = document.getElementById('debugger-status');
    const controlledTabsElement = document.getElementById('controlled-tabs');
    const browserControlStatusElement = document.getElementById('browser-control-status');
    
    if (debuggerStatusElement) {
      if (response.debuggerAttached) {
        debuggerStatusElement.textContent = '🔧 Active';
        debuggerStatusElement.style.color = '#4caf50';
      } else {
        debuggerStatusElement.textContent = '❌ Inactive';
        debuggerStatusElement.style.color = '#f44336';
      }
    }
    
    if (controlledTabsElement) {
      controlledTabsElement.textContent = response.controlledTabs || 0;
    }
    
    if (browserControlStatusElement) {
      if (response.enabled && response.connected && response.debuggerAttached) {
        browserControlStatusElement.textContent = '🎯 "Debugging this browser" Active';
        browserControlStatusElement.style.color = '#4caf50';
      } else if (response.enabled && response.connected) {
        browserControlStatusElement.textContent = '⚠️ Ready to Debug';
        browserControlStatusElement.style.color = '#ff9800';
      } else if (response.enabled) {
        browserControlStatusElement.textContent = '🔌 Waiting for Bridge';
        browserControlStatusElement.style.color = '#ff9800';
      } else {
        browserControlStatusElement.textContent = '❌ Service Disabled';
        browserControlStatusElement.style.color = '#f44336';
      }
    }
  }

  async updateActiveTab() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        const url = new URL(activeTab.url);
        const displayUrl = url.hostname + (url.pathname !== '/' ? url.pathname : '');
        document.getElementById('active-tab').textContent = displayUrl;
      }
    } catch (error) {
      document.getElementById('active-tab').textContent = 'Error loading tab info';
    }
  }

  async loadLogs() {
    try {
      console.log('[BROP Popup] Loading logs...');
      const response = await chrome.runtime.sendMessage({ 
        type: 'GET_LOGS', 
        limit: 100 
      });
      
      console.log('[BROP Popup] Logs response:', response);
      
      if (response && response.logs) {
        this.logs = response.logs;
        console.log(`[BROP Popup] Loaded ${this.logs.length} logs`);
        this.filterLogs();
      } else {
        console.log('[BROP Popup] No logs in response or response is null');
        this.logs = [];
        this.filterLogs();
      }
    } catch (error) {
      console.error('[BROP Popup] Failed to load logs:', error);
      this.logs = [];
      this.filterLogs();
    }
  }

  filterLogs() {
    const typeFilter = document.getElementById('log-filter')?.value || 'all';
    const statusFilter = document.getElementById('status-filter')?.value || 'all';
    const searchFilter = document.getElementById('search-filter')?.value?.toLowerCase() || '';

    console.log(`[BROP Popup] Filtering ${this.logs.length} logs with filters:`, {
      type: typeFilter,
      status: statusFilter,
      search: searchFilter
    });

    this.filteredLogs = this.logs.filter(log => {
      // Type filter
      if (typeFilter !== 'all' && log.type !== typeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'success' && !log.success) {
        return false;
      }
      if (statusFilter === 'error' && log.success) {
        return false;
      }

      // Search filter
      if (searchFilter) {
        const searchText = `${log.method} ${log.params} ${log.result} ${log.error}`.toLowerCase();
        if (!searchText.includes(searchFilter)) {
          return false;
        }
      }

      return true;
    });

    console.log(`[BROP Popup] Filtered to ${this.filteredLogs.length} logs`);
    this.displayLogs();
  }

  displayLogs() {
    const container = document.getElementById('logs-container');
    
    if (!container) {
      console.error('[BROP Popup] logs-container element not found');
      return;
    }
    
    console.log(`[BROP Popup] Displaying ${this.filteredLogs.length} filtered logs`);
    
    if (this.filteredLogs.length === 0) {
      if (this.logs.length === 0) {
        container.innerHTML = '<div class="empty-logs">No call logs yet. Make some API calls to see them here.</div>';
      } else {
        container.innerHTML = '<div class="empty-logs">No logs match your filters.</div>';
      }
      return;
    }

    const logsHtml = this.filteredLogs.map(log => this.createLogEntryHtml(log)).join('');
    container.innerHTML = logsHtml;
    console.log(`[BROP Popup] Logs displayed successfully`);
  }

  escapeHtml(text) {
    if (typeof text !== 'string') {
      text = String(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  createLogEntryHtml(log) {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const successClass = log.success ? 'success' : 'error';
    const typeClass = log.type.toLowerCase();
    const statusIcon = log.success ? '✅' : '❌';
    
    // Extract context from params for one-liner display
    let context = 'No params';
    try {
      if (log.params && log.params !== 'undefined') {
        const params = JSON.parse(log.params);
        if (params.url) context = `→ ${this.truncateText(params.url, 30)}`;
        else if (params.selector) context = `🎯 ${this.truncateText(params.selector, 25)}`;
        else if (params.script) context = `📜 ${this.truncateText(params.script, 25)}`;
        else if (params.text) context = `"${this.truncateText(params.text, 20)}"`;
        else context = `${Object.keys(params).slice(0, 2).join(', ')}`;
      }
    } catch (e) {
      context = this.truncateText(log.params, 30);
    }

    return `
      <div class="log-entry-compact ${successClass} ${typeClass}" onclick="window.openLogDetails('${log.id}')" title="Click to view full details">
        <div class="log-compact-header">
          <div class="log-compact-left">
            <span class="status-icon">${statusIcon}</span>
            <span class="log-method-compact">${this.escapeHtml(log.method)}</span>
            <span class="log-context">${this.escapeHtml(context)}</span>
          </div>
          <div class="log-compact-right">
            <span class="log-type ${log.type}">${log.type}</span>
            <span class="log-time-compact">${time}</span>
            ${log.duration ? `<span class="log-duration-compact">${log.duration}ms</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    const str = String(text);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  }

  handleNewLogEntry(log) {
    // Add new log to the beginning of the array
    this.logs.unshift(log);
    
    // Keep only recent logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(0, 100);
    }

    // Update display if on logs tab
    if (this.currentTab === 'logs') {
      this.filterLogs();
    }

    // Update stats
    this.updateStatus();
  }

  handleBridgeStatusUpdate(statusUpdate) {
    // Update connection status in real-time
    const response = {
      enabled: this.serviceEnabled,
      connected: statusUpdate.isConnected,
      connectionStatus: statusUpdate.connectionStatus,
      reconnectAttempts: statusUpdate.reconnectAttempts,
      lastConnectionTime: statusUpdate.lastConnectionTime,
      bridgeUrl: statusUpdate.bridgeUrl,
      totalLogs: this.logs.length,
      activeSessions: statusUpdate.isConnected ? 1 : 0
    };

    this.updateConnectionStatus(response);
    
    // Update stats display
    document.getElementById('active-sessions').textContent = response.activeSessions;
  }

  async toggleService() {
    try {
      const newState = !this.serviceEnabled;
      const response = await chrome.runtime.sendMessage({ 
        type: 'SET_ENABLED', 
        enabled: newState 
      });
      
      if (response.success) {
        this.serviceEnabled = newState;
        await this.updateStatus();
      }
    } catch (error) {
      console.error('Failed to toggle service:', error);
    }
  }


  openLogDetails(logId) {
    // Find the log entry
    const log = this.logs.find(l => l.id === logId);
    if (!log) {
      console.error('Log entry not found:', logId);
      return;
    }

    // Create full-screen log details page URL with log data
    const logData = encodeURIComponent(JSON.stringify(log));
    const detailsUrl = chrome.runtime.getURL(`logs.html?log=${logData}`);
    
    // Open in new tab
    chrome.tabs.create({ url: detailsUrl });
  }

  async exportLogs() {
    try {
      const dataStr = JSON.stringify(this.logs, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `brop-logs-${new Date().toISOString().split('T')[0]}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  }

  async clearAllLogs() {
    if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      try {
        await chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' });
        this.logs = [];
        this.filteredLogs = [];
        this.displayLogs();
        await this.updateStatus();
      } catch (error) {
        console.error('Failed to clear logs:', error);
      }
    }
  }

  async updateSettingsTab() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      
      // Update service status
      const serviceStatus = response.enabled ? '✅ Enabled' : '❌ Disabled';
      document.getElementById('service-status').textContent = serviceStatus;
      
      // Update log count
      document.getElementById('log-count').textContent = this.logs.length.toString();

      // Update bridge connection status
      const bridgeStatus = response.connected ? 
        `✅ Connected (${response.reconnectAttempts || 0} attempts)` : 
        `❌ Offline (${response.reconnectAttempts || 0} attempts)`;
      document.getElementById('native-status').textContent = bridgeStatus;

      // Update CDP interface status (check if bridge provides CDP)
      if (response.connected) {
        try {
          const cdpResponse = await fetch('http://localhost:9225/json/version', { 
            method: 'GET',
            mode: 'cors'
          });
          document.getElementById('cdp-status').textContent = cdpResponse.ok ? 
            '✅ Available via Bridge' : '❌ Bridge Error';
        } catch (error) {
          document.getElementById('cdp-status').textContent = '⚠️ Bridge Running (CDP check failed)';
        }
      } else {
        document.getElementById('cdp-status').textContent = '❌ Bridge Offline';
      }

      // Update debugger status in settings
      const settingsDebuggerElement = document.getElementById('settings-debugger-status');
      if (settingsDebuggerElement) {
        if (response.debuggerAttached) {
          settingsDebuggerElement.textContent = `✅ Active (${response.controlledTabs} tabs)`;
        } else if (response.enabled && response.connected) {
          settingsDebuggerElement.textContent = '⚠️ Ready (no tabs attached)';
        } else {
          settingsDebuggerElement.textContent = '❌ Inactive';
        }
      }
    } catch (error) {
      console.error('Failed to update settings tab:', error);
    }
  }

  openFullScreenLogs() {
    // Get the extension ID
    const extensionId = chrome.runtime.id;
    const logsUrl = chrome.runtime.getURL('logs.html');
    
    // Open the full-screen logs page in a new tab
    chrome.tabs.create({
      url: logsUrl,
      active: true
    });
  }

  async resetSettings() {
    if (confirm('Are you sure you want to reset all settings? This will clear logs and reset to defaults.')) {
      try {
        await chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' });
        await chrome.runtime.sendMessage({ type: 'SET_ENABLED', enabled: true });
        
        // Reset UI
        this.logs = [];
        this.filteredLogs = [];
        this.serviceEnabled = true;
        
        await this.updateStatus();
        this.displayLogs();
        
      } catch (error) {
        console.error('Failed to reset settings:', error);
      }
    }
  }

  startRefreshInterval() {
    // Refresh status every 5 seconds when popup is open
    this.refreshInterval = setInterval(() => {
      this.updateStatus();
    }, 5000);
  }

  stopRefreshInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

// Global function for log detail opening (needed for onclick handlers)
window.openLogDetails = function(logId) {
  if (window.bropPopup) {
    window.bropPopup.openLogDetails(logId);
  }
};

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.bropPopup = new BROPPopupEnhanced();
  
  // Clean up interval when popup closes
  window.addEventListener('beforeunload', () => {
    window.bropPopup.stopRefreshInterval();
  });
});