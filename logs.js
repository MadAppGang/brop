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
    await this.loadLogs();
    await this.updateStatus();
    this.filterLogs();
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
      const response = await chrome.runtime.sendMessage({ 
        type: 'GET_LOGS', 
        limit: 500 
      });
      
      if (response && response.logs) {
        this.logs = response.logs;
        this.filterLogs();
        this.updateLogsCount();
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      this.showError('Failed to load logs. Make sure the BROP extension is active.');
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
    const typeFilter = document.getElementById('type-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const searchFilter = document.getElementById('search-input').value.toLowerCase();

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

    this.displayLogs();
    this.updateFilteredCount();
  }

  displayLogs() {
    const container = document.getElementById('logs-container');
    
    if (this.filteredLogs.length === 0) {
      container.innerHTML = this.createEmptyState();
      return;
    }

    const logsHtml = this.filteredLogs.map(log => this.createLogEntryHtml(log)).join('');
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
    const typeClass = log.type.toLowerCase();
    
    const params = this.formatLogData(log.params);
    const result = this.formatLogData(log.result);
    const error = log.error ? this.formatLogData(log.error) : null;

    return `
      <div class="log-entry ${successClass} ${typeClass}" data-log-id="${log.id}">
        <div class="log-main">
          <div class="log-method-info">
            <span class="log-method">${log.method}</span>
            <span class="log-type-badge ${log.type}">${log.type}</span>
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

  formatLogData(data) {
    if (!data || data === 'undefined') return null;
    
    if (typeof data === 'string') {
      try {
        // Try to parse and pretty-print JSON
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return data;
      }
    }
    
    return JSON.stringify(data, null, 2);
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