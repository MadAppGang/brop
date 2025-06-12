// BROP Full-Screen Logs Viewer

class BROPLogsViewer {
  constructor() {
    this.logs = [];
    this.filteredLogs = [];
    this.autoRefresh = true;
    this.refreshInterval = null;
    this.selectedLogs = new Set();
    
    this.initializeViewer();
    this.setupEventListeners();
    this.startAutoRefresh();
  }

  async initializeViewer() {
    // Check if we're displaying a specific log from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const logParam = urlParams.get('log');
    
    if (logParam) {
      // Single log detail mode
      console.log('[BROP Logs] Loading single log from URL parameter');
      this.loadSingleLog(logParam);
    } else {
      // Normal logs viewer mode
      console.log('[BROP Logs] Loading all logs from extension');
      this.showLoadingMessage();
      await this.loadLogsWithRetry();
      await this.updateStatus();
      this.filterLogs();
    }
  }
  
  showLoadingMessage() {
    const container = document.getElementById('logs-container');
    if (container) {
      container.innerHTML = '<div class="loading-message">📋 Loading logs from extension...</div>';
    }
  }
  
  async loadLogsWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[BROP Logs] Load attempt ${attempt}/${maxRetries}`);
      
      try {
        await this.loadLogs();
        return; // Success, exit retry loop
      } catch (error) {
        console.warn(`[BROP Logs] Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          console.log(`[BROP Logs] Retrying in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error('[BROP Logs] All retry attempts failed');
          
          // Try alternative data access method as last resort
          console.log('[BROP Logs] Trying alternative data access...');
          await this.tryAlternativeDataAccess();
          return;
        }
      }
    }
  }

  async tryAlternativeDataAccess() {
    try {
      console.log('[BROP Logs] Attempting alternative data access via storage API...');
      
      // Try accessing stored logs directly
      const result = await chrome.storage.local.get(['brop_logs']);
      console.log('[BROP Logs] Storage result:', result);
      
      let logs = [];
      if (result.brop_logs && Array.isArray(result.brop_logs)) {
        logs = result.brop_logs;
      }
      
      if (logs.length > 0) {
        console.log(`[BROP Logs] Found ${logs.length} logs in storage`);
        console.log('[BROP Logs] Sample log structure:', logs[0]);
        this.logs = logs.slice(-500); // Keep last 500 logs
        this.filterLogs();
        this.updateLogsCount();
        return;
      }
      
      // If no logs in storage, show empty state with helpful message
      console.log('[BROP Logs] No logs found in storage, showing empty state');
      this.logs = [];
      this.filterLogs();
      
    } catch (storageError) {
      console.error('[BROP Logs] Alternative data access also failed:', storageError);
      
      // Show error with more helpful message
      this.showError(`
        Failed to load logs from extension. This can happen when:
        <br>• Extension background script is not running
        <br>• Page opened in wrong context
        <br>• Extension needs to be reloaded
        <br><br>
        Try: Reload extension → Open popup → Click "Open Full Screen"
      `);
    }
  }

  setupEventListeners() {
    // Filter controls
    document.getElementById('type-filter').addEventListener('change', () => this.filterLogs());
    document.getElementById('status-filter').addEventListener('change', () => this.filterLogs());
    document.getElementById('search-input').addEventListener('input', () => this.filterLogs());

    // Action buttons
    document.getElementById('refresh-btn').addEventListener('click', () => this.loadLogs());
    document.getElementById('export-btn').addEventListener('click', () => this.exportLogs());
    document.getElementById('copy-btn').addEventListener('click', () => this.copySelectedLogs());
    document.getElementById('clear-btn').addEventListener('click', () => this.clearAllLogs());

    // Auto-refresh toggle
    document.getElementById('auto-refresh-toggle').addEventListener('click', () => this.toggleAutoRefresh());

    // Listen for new logs from extension
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'NEW_LOG_ENTRY') {
        this.handleNewLogEntry(message.log);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'r':
            e.preventDefault();
            this.loadLogs();
            break;
          case 'f':
            e.preventDefault();
            document.getElementById('search-input').focus();
            break;
          case 'a':
            e.preventDefault();
            this.selectAllVisibleLogs();
            break;
        }
      }
    });
  }

  async loadLogs() {
    try {
      console.log('[BROP Logs] Attempting to load all logs from extension...');
      
      // Check if chrome.runtime is available
      if (!chrome || !chrome.runtime) {
        throw new Error('Chrome extension runtime not available');
      }
      
      const response = await chrome.runtime.sendMessage({ 
        type: 'GET_LOGS', 
        limit: 500 
      });
      
      console.log('[BROP Logs] Response received:', response);
      
      if (response && response.logs) {
        this.logs = response.logs;
        console.log(`[BROP Logs] Loaded ${this.logs.length} logs successfully`);
        if (this.logs.length > 0) {
          console.log('[BROP Logs] Sample log structure from runtime:', this.logs[0]);
        }
        this.filterLogs();
        this.updateLogsCount();
      } else {
        console.warn('[BROP Logs] No logs in response or response is null');
        this.logs = [];
        this.filterLogs();
        this.updateLogsCount();
      }
    } catch (error) {
      console.error('[BROP Logs] Failed to load logs:', error);
      
      // Provide more specific error message
      let errorMessage = 'Failed to load logs. ';
      if (error.message.includes('runtime not available')) {
        errorMessage += 'Extension context not available. Try opening this page from the extension popup.';
      } else if (error.message.includes('Could not establish connection')) {
        errorMessage += 'Extension background script not responding. Try reloading the extension.';
      } else {
        errorMessage += 'Make sure the BROP extension is active and try refreshing this page.';
      }
      
      this.showError(errorMessage);
    }
  }

  loadSingleLog(logParam) {
    try {
      console.log('[BROP Logs] Parsing log parameter:', logParam);
      
      // Decode and parse the log data from URL parameter
      const logData = JSON.parse(decodeURIComponent(logParam));
      console.log('[BROP Logs] Parsed log data:', logData);
      
      // Set up single log display
      this.logs = [logData];
      this.filteredLogs = [logData];
      
      // Hide filters and controls since we're showing single log
      this.hideFiltersForSingleLog();
      
      // Display the single log
      this.displayLogs();
      
      // Update page title
      document.title = `BROP Log Details - ${logData.method}`;
      
      // Update header to show single log mode
      this.updateHeaderForSingleLog(logData);
      
    } catch (error) {
      console.error('[BROP Logs] Failed to parse log parameter:', error);
      this.showError('Failed to load log details. Invalid log data in URL.');
    }
  }

  hideFiltersForSingleLog() {
    // Hide filter controls since we're showing a single log
    const filterSection = document.querySelector('.filters');
    if (filterSection) {
      filterSection.style.display = 'none';
    }
    
    // Hide actions that don't make sense for single log
    const actionsSection = document.querySelector('.actions');
    if (actionsSection) {
      actionsSection.style.display = 'none';
    }
  }

  updateHeaderForSingleLog(logData) {
    const headerTitle = document.querySelector('.header h1');
    if (headerTitle) {
      headerTitle.textContent = `Log Details: ${logData.method}`;
    }
    
    const statusElement = document.querySelector('.status');
    if (statusElement) {
      const successIcon = logData.success ? '✅' : '❌';
      const statusText = logData.success ? 'SUCCESS' : 'FAILED';
      statusElement.innerHTML = `${successIcon} ${statusText}`;
    }
  }

  async updateStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      
      const statusBadge = document.getElementById('status-badge');
      const totalCalls = document.getElementById('total-calls');
      const activeSessions = document.getElementById('active-sessions');
      
      if (response.enabled) {
        statusBadge.textContent = 'Service Active';
        statusBadge.className = 'status-badge active';
      } else {
        statusBadge.textContent = 'Service Disabled';
        statusBadge.className = 'status-badge inactive';
      }

      totalCalls.textContent = response.totalLogs || 0;
      activeSessions.textContent = response.activeSessions || 0;
      
    } catch (error) {
      console.error('Failed to get status:', error);
      const statusBadge = document.getElementById('status-badge');
      statusBadge.textContent = 'Connection Error';
      statusBadge.className = 'status-badge inactive';
    }
  }

  filterLogs() {
    const typeFilter = document.getElementById('type-filter')?.value || 'all';
    const statusFilter = document.getElementById('status-filter')?.value || 'all';
    const searchFilter = document.getElementById('search-input')?.value?.toLowerCase() || '';

    console.log(`[BROP Logs] Filtering ${this.logs.length} logs with filters:`, {
      type: typeFilter,
      status: statusFilter,
      search: searchFilter
    });

    this.filteredLogs = this.logs.filter(log => {
      // Type filter
      if (typeFilter !== 'all' && log.type !== typeFilter) {
        console.log(`[BROP Logs] Log filtered out by type: ${log.type} != ${typeFilter}`);
        return false;
      }

      // Status filter
      if (statusFilter === 'success' && !log.success) {
        console.log(`[BROP Logs] Log filtered out by status: not success`);
        return false;
      }
      if (statusFilter === 'error' && log.success) {
        console.log(`[BROP Logs] Log filtered out by status: is success`);
        return false;
      }

      // Search filter
      if (searchFilter) {
        const searchText = `${log.method || ''} ${log.params || ''} ${log.result || ''} ${log.error || ''}`.toLowerCase();
        if (!searchText.includes(searchFilter)) {
          console.log(`[BROP Logs] Log filtered out by search: "${searchFilter}" not in "${searchText.substring(0, 100)}..."`);
          return false;
        }
      }

      return true;
    });

    console.log(`[BROP Logs] Filtered to ${this.filteredLogs.length} logs from ${this.logs.length} total`);
    this.displayLogs();
    this.updateFilteredCount();
  }

  displayLogs() {
    const container = document.getElementById('logs-container');
    
    console.log(`[BROP Logs] displayLogs called with ${this.filteredLogs.length} filtered logs`);
    
    if (!container) {
      console.error('[BROP Logs] logs-container element not found!');
      return;
    }
    
    if (this.filteredLogs.length === 0) {
      console.log('[BROP Logs] No filtered logs, showing empty state');
      container.innerHTML = this.createEmptyState();
      return;
    }

    console.log('[BROP Logs] Creating HTML for logs...');
    const logsHtml = this.filteredLogs.map(log => this.createLogEntryHtml(log)).join('');
    console.log(`[BROP Logs] Generated HTML length: ${logsHtml.length} characters`);
    container.innerHTML = logsHtml;

    // Add click handlers for log selection
    container.querySelectorAll('.log-entry').forEach((entry, index) => {
      entry.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
          this.toggleLogSelection(entry, this.filteredLogs[index]);
        } else {
          this.clearSelection();
          this.selectLog(entry, this.filteredLogs[index]);
        }
      });
    });
  }

  createLogEntryHtml(log) {
    const time = new Date(log.timestamp).toLocaleString();
    const successClass = log.success ? 'success' : 'error';
    const typeClass = (log.type || 'unknown').toLowerCase();
    
    const params = this.formatLogData(log.params, log.method);
    const result = this.formatLogData(log.result, log.method);
    const error = log.error ? this.formatLogData(log.error, log.method) : null;

    return `
      <div class="log-entry ${successClass} ${typeClass}" data-log-id="${log.id || 'unknown'}">
        <div class="log-main">
          <div class="log-method-info">
            <span class="log-method">${this.escapeHtml(log.method || 'Unknown')}</span>
            <span class="log-type-badge ${log.type || 'unknown'}">${this.escapeHtml(log.type || 'UNKNOWN')}</span>
          </div>
          <div class="log-meta">
            <div class="log-time">${time}</div>
            ${log.duration ? `<div class="log-duration">${log.duration}ms</div>` : ''}
          </div>
        </div>
        
        <div class="log-details">
          ${params ? `
            <div class="log-detail-section">
              <div class="log-detail-title">Parameters</div>
              <div class="log-detail-content">${params}</div>
            </div>
          ` : ''}
          
          ${result ? `
            <div class="log-detail-section">
              <div class="log-detail-title">Result</div>
              <div class="log-detail-content">${result}</div>
            </div>
          ` : ''}
          
          ${error ? `
            <div class="log-detail-section log-error">
              <div class="log-detail-title">Error</div>
              <div class="log-detail-content">${error}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  createEmptyState() {
    const hasFilters = document.getElementById('type-filter').value !== 'all' ||
                     document.getElementById('status-filter').value !== 'all' ||
                     document.getElementById('search-input').value.trim() !== '';

    if (hasFilters) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">No matching logs found</div>
          <div class="empty-state-text">
            Try adjusting your filters or search terms.<br>
            <button class="btn" onclick="document.getElementById('type-filter').value='all'; document.getElementById('status-filter').value='all'; document.getElementById('search-input').value=''; window.bropLogs.filterLogs();">Clear Filters</button>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No logs yet</div>
          <div class="empty-state-text">
            Make some API calls to see them logged here.<br>
Use the extension popup to test connections.
          </div>
        </div>
      `;
    }
  }

  formatLogData(data, method = '') {
    if (!data || data === 'undefined') return null;
    
    let formattedData;
    
    if (typeof data === 'string') {
      try {
        // Try to parse and pretty-print JSON
        const parsed = JSON.parse(data);
        formattedData = JSON.stringify(parsed, null, 2);
      } catch {
        formattedData = data;
      }
    } else {
      formattedData = JSON.stringify(data, null, 2);
    }
    
    // Truncate large content for specific methods
    formattedData = this.truncateLargeContent(formattedData, method);
    
    // Always escape HTML to prevent SVG/HTML injection and URL loading
    return this.escapeHtml(formattedData);
  }

  truncateLargeContent(content, method) {
    const methodLower = method.toLowerCase();
    const maxLength = 500; // Default max length
    
    // Special handling for methods that typically return large content
    if (methodLower.includes('get_page_content') || 
        methodLower.includes('getpagecontent') ||
        methodLower.includes('page.content')) {
      
      if (content.length > maxLength) {
        const truncated = content.substring(0, maxLength);
        const lines = content.split('\n').length;
        const chars = content.length;
        return `${truncated}...\n\n[TRUNCATED: Full content has ${lines} lines, ${chars} characters]`;
      }
    }
    
    // Special handling for screenshot data
    if (methodLower.includes('get_screenshot') || 
        methodLower.includes('getscreenshot') ||
        methodLower.includes('screenshot') ||
        methodLower.includes('captureScreenshot')) {
      
      if (content.includes('data:image') || content.length > 1000) {
        // For base64 image data, show just metadata
        if (content.includes('data:image')) {
          const imageInfo = content.match(/data:image\/(\w+);base64,/);
          const format = imageInfo ? imageInfo[1] : 'unknown';
          const sizeKB = Math.round(content.length / 1024);
          return `[SCREENSHOT DATA: ${format.toUpperCase()} format, ~${sizeKB}KB base64 encoded image]`;
        } else {
          return content.substring(0, 200) + '...\n\n[TRUNCATED: Screenshot data]';
        }
      }
    }
    
    // For very long content in general, truncate
    if (content.length > 2000) {
      const lines = content.split('\n').length;
      return content.substring(0, 1500) + `...\n\n[TRUNCATED: ${lines} total lines, ${content.length} characters]`;
    }
    
    return content;
  }

  escapeHtml(text) {
    if (typeof text !== 'string') {
      text = String(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  selectLog(entry, log) {
    entry.classList.add('selected');
    this.selectedLogs.add(log.id);
  }

  toggleLogSelection(entry, log) {
    if (this.selectedLogs.has(log.id)) {
      entry.classList.remove('selected');
      this.selectedLogs.delete(log.id);
    } else {
      entry.classList.add('selected');
      this.selectedLogs.add(log.id);
    }
  }

  clearSelection() {
    document.querySelectorAll('.log-entry.selected').forEach(entry => {
      entry.classList.remove('selected');
    });
    this.selectedLogs.clear();
  }

  selectAllVisibleLogs() {
    this.clearSelection();
    document.querySelectorAll('.log-entry').forEach((entry, index) => {
      this.selectLog(entry, this.filteredLogs[index]);
    });
  }

  updateLogsCount() {
    document.getElementById('logs-count').textContent = 
      `${this.logs.length} total logs`;
  }

  updateFilteredCount() {
    document.getElementById('filtered-count').textContent = this.filteredLogs.length;
  }

  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    if (this.autoRefresh) {
      this.refreshInterval = setInterval(() => {
        this.loadLogs();
        this.updateStatus();
      }, 5000);
    }
  }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    const toggle = document.getElementById('auto-refresh-toggle');
    
    if (this.autoRefresh) {
      toggle.classList.add('active');
      this.startAutoRefresh();
    } else {
      toggle.classList.remove('active');
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    }
  }

  handleNewLogEntry(log) {
    // Add new log to the beginning of the array
    this.logs.unshift(log);
    
    // Keep only recent logs
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(0, 500);
    }

    // Update display
    this.filterLogs();
    this.updateLogsCount();
    this.updateStatus();
  }

  async exportLogs() {
    const logsToExport = this.selectedLogs.size > 0 
      ? this.logs.filter(log => this.selectedLogs.has(log.id))
      : this.filteredLogs;

    const dataStr = JSON.stringify(logsToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brop-logs-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  async copySelectedLogs() {
    const logsToCopy = this.selectedLogs.size > 0 
      ? this.logs.filter(log => this.selectedLogs.has(log.id))
      : this.filteredLogs.slice(0, 10); // Limit to 10 if none selected

    const text = logsToCopy.map(log => 
      `[${new Date(log.timestamp).toLocaleString()}] ${log.type}:${log.method} - ${log.success ? 'SUCCESS' : 'ERROR'}`
    ).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Logs copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy logs:', error);
      this.showToast('Failed to copy logs', 'error');
    }
  }

  async clearAllLogs() {
    if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      try {
        await chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' });
        this.logs = [];
        this.filteredLogs = [];
        this.displayLogs();
        this.updateLogsCount();
        this.updateFilteredCount();
        this.updateStatus();
        this.showToast('All logs cleared');
      } catch (error) {
        console.error('Failed to clear logs:', error);
        this.showToast('Failed to clear logs', 'error');
      }
    }
  }


  showToast(message, type = 'success') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'error' ? '#f44336' : '#4caf50'};
      color: white;
      border-radius: 6px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      z-index: 1000;
      font-size: 14px;
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
      style.remove();
    }, 3000);
  }

  showError(message) {
    const container = document.getElementById('logs-container');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Error</div>
        <div class="empty-state-text">${message}</div>
      </div>
    `;
  }
}

// Add CSS for selected logs
const style = document.createElement('style');
style.textContent = `
  .log-entry.selected {
    background: #e3f2fd !important;
    border-left-color: #1976d2 !important;
    box-shadow: inset 3px 0 0 #1976d2;
  }
`;
document.head.appendChild(style);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.bropLogs = new BROPLogsViewer();
});

// Make it available globally for debugging
window.BROPLogsViewer = BROPLogsViewer;