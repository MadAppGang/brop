// Browser Remote Operations Protocol - Popup Script

class BROPPopup {
  constructor() {
    this.initializePopup();
    this.setupEventListeners();
    this.startStatusUpdates();
  }

  async initializePopup() {
    await this.updateStatus();
    await this.updateActiveTab();
    await this.updateConsolePreview();
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-link').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = e.target.dataset.tab;
        this.switchTab(targetTab);
      });
    });

    // Handle optional buttons that might not exist
    const clearLogsBtn = document.getElementById('clear-logs');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', () => {
        this.clearConsoleLogs();
      });
    }

    const testConnectionBtn = document.getElementById('test-connection');
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener('click', () => {
        this.testConnection();
      });
    }

    const refreshLogsBtn = document.getElementById('refresh-logs');
    if (refreshLogsBtn) {
      refreshLogsBtn.addEventListener('click', () => {
        this.updateStatus();
      });
    }

    // Full screen logs button
    const fullScreenBtn = document.getElementById('open-fullscreen');
    if (fullScreenBtn) {
      fullScreenBtn.addEventListener('click', () => {
        this.openFullScreenLogs();
      });
    }

    // Clear all logs button
    const clearAllLogsBtn = document.getElementById('clear-all-logs');
    if (clearAllLogsBtn) {
      clearAllLogsBtn.addEventListener('click', () => {
        this.clearConsoleLogs();
      });
    }

    // Service toggle switch
    const serviceToggle = document.getElementById('service-toggle');
    if (serviceToggle) {
      serviceToggle.addEventListener('click', () => {
        this.toggleService();
      });
    }
  }

  async toggleService() {
    try {
      // Get current status first
      const currentStatus = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      
      // Toggle the service
      const newEnabled = !currentStatus.enabled;
      const response = await chrome.runtime.sendMessage({ 
        type: 'SET_ENABLED', 
        enabled: newEnabled 
      });
      
      console.log('Service toggle response:', response);
      
      // Update UI immediately
      await this.updateStatus();
      
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  }

  switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab-link').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Show target tab content
    const targetContent = document.getElementById(tabName);
    if (targetContent) {
      targetContent.classList.add('active');
    }
    
    // Add active class to clicked tab
    const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetTab) {
      targetTab.classList.add('active');
    }
  }

  startStatusUpdates() {
    // Update status every 5 seconds (less frequent to avoid interrupting user)
    setInterval(() => {
      this.updateStatus();
      // Only update logs if user is not actively viewing them
      if (document.querySelector('.tab-link[data-tab="call-logs"]').classList.contains('active')) {
        // Don't auto-refresh logs when user is viewing them
        return;
      }
      this.updateConsolePreview();
    }, 5000);
  }

  async updateStatus() {
    try {
      // Check if background script is responsive
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      
      if (response) {
        const statusMessage = response.connected ? 
          `Connected - ${response.controlledTabs} tabs controlled` : 
          `Disconnected - Attempting to reconnect (${response.reconnectAttempts} attempts)`;
        
        this.setStatus(response.connected, statusMessage);
        
        // Update additional status info
        this.updateConnectionDetails(response);
      } else {
        this.setStatus(false, 'Background script not responding');
      }
    } catch (error) {
      this.setStatus(false, 'Background script not responding');
    }
  }

  setStatus(active, message) {
    const statusElement = document.getElementById('connection-status');
    const textElement = document.getElementById('connection-text');
    
    if (statusElement && textElement) {
      statusElement.className = active ? 'status-banner' : 'status-banner inactive';
      textElement.textContent = message;
    }
  }
  
  updateConnectionDetails(status) {
    // Update stats
    const totalCallsElement = document.getElementById('total-calls');
    if (totalCallsElement) {
      totalCallsElement.textContent = status.totalLogs || 0;
    }
    
    const activeSessionsElement = document.getElementById('active-sessions');
    if (activeSessionsElement) {
      activeSessionsElement.textContent = status.activeSessions || 0;
    }
    
    // Update debugger status
    const debuggerStatusElement = document.getElementById('debugger-status');
    if (debuggerStatusElement) {
      debuggerStatusElement.textContent = status.debuggerAttached ? 'Yes' : 'No';
    }
    
    const controlledTabsElement = document.getElementById('controlled-tabs');
    if (controlledTabsElement) {
      controlledTabsElement.textContent = status.controlledTabs || 0;
    }
    
    const browserControlStatusElement = document.getElementById('browser-control-status');
    if (browserControlStatusElement) {
      browserControlStatusElement.textContent = status.connected ? 'Active' : 'Inactive';
    }
    
    // Update service status
    const serviceStatusElement = document.getElementById('service-status');
    if (serviceStatusElement) {
      serviceStatusElement.textContent = status.enabled ? 'Enabled' : 'Disabled';
    }
    
    const serviceTextElement = document.getElementById('service-text');
    if (serviceTextElement) {
      serviceTextElement.textContent = status.enabled ? 'Enabled' : 'Disabled';
    }

    // Update toggle switch visual state
    const serviceToggle = document.getElementById('service-toggle');
    if (serviceToggle) {
      if (status.enabled) {
        serviceToggle.classList.add('active');
      } else {
        serviceToggle.classList.remove('active');
      }
    }
    
    // Update connection method statuses
    const nativeStatusElement = document.getElementById('native-status');
    if (nativeStatusElement) {
      nativeStatusElement.textContent = status.connected ? '✅ Connected' : '❌ Disconnected';
    }
    
    const cdpStatusElement = document.getElementById('cdp-status');
    if (cdpStatusElement) {
      cdpStatusElement.textContent = status.connected ? '✅ Available' : '❌ Unavailable';
    }
    
    const settingsDebuggerStatusElement = document.getElementById('settings-debugger-status');
    if (settingsDebuggerStatusElement) {
      settingsDebuggerStatusElement.textContent = status.debuggerAttached ? '✅ Attached' : '❌ Not Attached';
    }
    
    const logCountElement = document.getElementById('log-count');
    if (logCountElement) {
      logCountElement.textContent = status.totalLogs || 0;
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

  async updateConsolePreview() {
    try {
      // Get call logs from background script
      const response = await chrome.runtime.sendMessage({ type: 'GET_LOGS', limit: 20 });
      
      if (response && response.logs) {
        this.displayConsoleLogs(response.logs);
      } else {
        this.displayConsoleLogs([]);
      }
    } catch (error) {
      console.error('Error getting logs:', error);
      this.displayConsoleLogs([]);
    }
  }

  displayConsoleLogs(logs) {
    const logsContainer = document.getElementById('logs-container');
    
    if (!logsContainer) {
      console.warn('logs-container element not found');
      return;
    }
    
    if (logs.length === 0) {
      logsContainer.innerHTML = '<div class="empty-logs">No call logs yet. Make some API calls to see them here.</div>';
      return;
    }

    const entries = logs.slice(-10).map((log, index) => {
      const time = new Date(log.timestamp || Date.now()).toLocaleTimeString();
      const status = log.error ? 'error' : 'success';
      const statusText = log.error ? 'Error' : 'Success';
      const checkIcon = `<svg class="icon-check-small" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
      </svg>`;
      
      return `<div class="log-item ${status}" data-log-index="${index}" data-log-id="${log.id || index}">
        <div class="checkbox-container">
          <div class="custom-checkbox">
            ${checkIcon}
          </div>
        </div>
        <span class="type">${log.method || 'Unknown'}</span>
        <span class="status">${statusText}</span>
        <span class="badge">${log.type || 'BROP'}</span>
        <span class="time">${time}</span>
      </div>`;
    }).join('');
    
    // Remember current scroll position
    const currentScrollTop = logsContainer.scrollTop;
    const wasAtBottom = logsContainer.scrollTop >= (logsContainer.scrollHeight - logsContainer.clientHeight - 5);
    
    logsContainer.innerHTML = entries;
    
    // Add click event listeners to log entries
    logsContainer.querySelectorAll('.log-item').forEach((entry, index) => {
      entry.addEventListener('click', () => {
        const logData = logs[logs.length - 10 + index]; // Get the actual log data
        this.openLogDetailView(logData);
      });
    });
    
    // Only auto-scroll to bottom if user was already at the bottom
    if (wasAtBottom) {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    } else {
      // Try to maintain the scroll position, or close to it
      logsContainer.scrollTop = currentScrollTop;
    }
  }

  openLogDetailView(logData) {
    // Create a new window to show detailed log information
    const detailWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    
    if (!detailWindow) {
      // Fallback: log to console if popup blocking
      console.log('Detailed log data:', logData);
      alert('Log details logged to console (F12)');
      return;
    }

    const timestamp = new Date(logData.timestamp || Date.now()).toLocaleString();
    const duration = logData.duration ? `${logData.duration}ms` : 'N/A';
    const status = logData.error ? 'ERROR' : 'SUCCESS';
    
    detailWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>BROP Log Details - ${logData.method || 'Unknown'}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 20px; 
            background: #f5f5f5;
          }
          .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0 0 10px 0;
            color: #1976d2;
            font-size: 24px;
          }
          .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-weight: bold;
            color: white;
            font-size: 12px;
          }
          .status.success { background: #4caf50; }
          .status.error { background: #f44336; }
          .section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          .section h2 {
            margin: 0 0 15px 0;
            color: #333;
            font-size: 18px;
            border-bottom: 2px solid #eee;
            padding-bottom: 8px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 10px;
            margin-bottom: 15px;
          }
          .info-label {
            font-weight: bold;
            color: #666;
          }
          .info-value {
            color: #333;
            word-break: break-all;
          }
          pre {
            background: #f8f8f8;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #1976d2;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.4;
          }
          .error-pre {
            border-left-color: #f44336;
            background: #fff5f5;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${logData.method || 'Unknown Method'}</h1>
          <span class="status ${logData.error ? 'error' : 'success'}">${status}</span>
        </div>

        <div class="section">
          <h2>Request Information</h2>
          <div class="info-grid">
            <div class="info-label">Method:</div>
            <div class="info-value">${logData.method || 'N/A'}</div>
            
            <div class="info-label">Type:</div>
            <div class="info-value">${logData.type || 'N/A'}</div>
            
            <div class="info-label">Timestamp:</div>
            <div class="info-value">${timestamp}</div>
            
            <div class="info-label">Duration:</div>
            <div class="info-value">${duration}</div>
            
            <div class="info-label">Success:</div>
            <div class="info-value">${logData.success !== undefined ? logData.success : 'N/A'}</div>
          </div>
        </div>

        ${logData.params ? `
        <div class="section">
          <h2>Parameters</h2>
          <pre>${JSON.stringify(logData.params, null, 2)}</pre>
        </div>
        ` : ''}

        ${logData.result ? `
        <div class="section">
          <h2>Result</h2>
          <pre>${JSON.stringify(logData.result, null, 2)}</pre>
        </div>
        ` : ''}

        ${logData.error ? `
        <div class="section">
          <h2>Error Details</h2>
          <pre class="error-pre">${logData.error}</pre>
        </div>
        ` : ''}

        <div class="section">
          <h2>Raw Log Data</h2>
          <pre>${JSON.stringify(logData, null, 2)}</pre>
        </div>
      </body>
      </html>
    `);
    
    detailWindow.document.close();
    
    // Focus the window without inline scripts
    setTimeout(() => {
      detailWindow.focus();
    }, 50);
  }

  async openFullScreenLogs() {
    try {
      // Get all logs from background script
      const response = await chrome.runtime.sendMessage({ type: 'GET_LOGS', limit: 1000 });
      const logs = response?.logs || [];

      // Create a simple full-screen log viewer window
      const fullScreenWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
      
      if (!fullScreenWindow) {
        alert('Please allow popups to view full-screen logs');
        return;
      }

      // Create the HTML structure without any inline scripts or onclick handlers
      fullScreenWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>BROP Full Screen Logs</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              margin: 0; 
              padding: 20px;
              background: #f5f5f5;
            }
            .header {
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              color: #1976d2;
              font-size: 24px;
            }
            .stats {
              color: #666;
              font-size: 14px;
              margin-top: 10px;
            }
            .logs-container {
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              max-height: 600px;
              overflow-y: auto;
            }
            .log-entry {
              padding: 15px 20px;
              border-bottom: 1px solid #eee;
              cursor: pointer;
              transition: all 0.3s ease;
            }
            .log-entry:hover {
              background-color: #f8f9fa;
            }
            .log-entry.success {
              border-left: 4px solid #4caf50;
            }
            .log-entry.error {
              border-left: 4px solid #f44336;
            }
            .log-entry.expanded {
              background-color: #f9f9f9;
            }
            .log-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            }
            .log-method {
              font-weight: 600;
              color: #1976d2;
              font-size: 16px;
            }
            .log-meta {
              display: flex;
              gap: 15px;
              align-items: center;
              font-size: 12px;
              color: #666;
            }
            .log-type {
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              color: white;
            }
            .log-type.CDP { background: #9c27b0; }
            .log-type.BROP { background: #4caf50; }
            .log-type.SYSTEM { background: #ff9800; }
            .log-details {
              color: #666;
              font-size: 14px;
              max-height: 50px;
              overflow: hidden;
              text-overflow: ellipsis;
              word-break: break-word;
            }
            .log-full-details {
              margin-top: 15px;
              padding: 15px;
              background: #f8f8f8;
              border-radius: 4px;
              border-left: 3px solid #1976d2;
              display: none;
            }
            .log-full-details.show {
              display: block;
            }
            .detail-section {
              margin-bottom: 15px;
            }
            .detail-section:last-child {
              margin-bottom: 0;
            }
            .detail-label {
              font-weight: bold;
              color: #333;
              margin-bottom: 5px;
            }
            .detail-content {
              background: white;
              padding: 10px;
              border-radius: 4px;
              font-family: 'Monaco', 'Menlo', monospace;
              font-size: 12px;
              max-height: 200px;
              overflow-y: auto;
              white-space: pre-wrap;
              word-break: break-all;
            }
            .expand-indicator {
              margin-left: 10px;
              font-size: 12px;
              color: #1976d2;
              font-weight: normal;
            }
            .empty-logs {
              text-align: center;
              padding: 60px 20px;
              color: #666;
              font-style: italic;
            }
            .controls {
              position: fixed;
              bottom: 20px;
              right: 20px;
              display: flex;
              gap: 10px;
            }
            .btn {
              padding: 10px 20px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              background: #f5f5f5;
              color: #333;
              border: 1px solid #ddd;
            }
            .btn:hover {
              background: #e0e0e0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BROP Call Logs</h1>
            <div class="stats">Total: ${logs.length} entries</div>
          </div>

          <div class="logs-container" id="logs-container">
            ${this.generateSimpleLogEntriesNoInline(logs)}
          </div>

          <div class="controls">
            <button class="btn" id="print-btn">📄 Print</button>
            <button class="btn" id="close-btn">❌ Close</button>
          </div>
        </body>
        </html>
      `);

      fullScreenWindow.document.close();
      
      // After the document is ready, add event listeners using DOM manipulation
      setTimeout(() => {
        // Add print functionality
        const printBtn = fullScreenWindow.document.getElementById('print-btn');
        if (printBtn) {
          printBtn.addEventListener('click', () => {
            fullScreenWindow.print();
          });
        }
        
        // Add close functionality
        const closeBtn = fullScreenWindow.document.getElementById('close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            fullScreenWindow.close();
          });
        }
        
        // Add click listeners to all log entries
        const logEntries = fullScreenWindow.document.querySelectorAll('.log-entry');
        logEntries.forEach((entry, index) => {
          entry.addEventListener('click', () => {
            const detailsDiv = fullScreenWindow.document.getElementById('details-' + index);
            const indicator = entry.querySelector('.expand-indicator');
            
            if (detailsDiv.classList.contains('show')) {
              detailsDiv.classList.remove('show');
              entry.classList.remove('expanded');
              indicator.textContent = '(click to expand)';
            } else {
              detailsDiv.classList.add('show');
              entry.classList.add('expanded');
              indicator.textContent = '(click to collapse)';
            }
          });
        });
        
        fullScreenWindow.focus();
      }, 100);
      
    } catch (error) {
      console.error('Error opening full-screen logs:', error);
      alert('Error opening full-screen logs. Check console for details.');
    }
  }

  generateSimpleLogEntriesNoInline(logs) {
    if (logs.length === 0) {
      return '<div class="empty-logs">No call logs yet. Make some API calls to see them here.</div>';
    }

    return logs.map((log, index) => {
      const time = new Date(log.timestamp || Date.now()).toLocaleString();
      const duration = log.duration ? `${log.duration}ms` : '';
      const status = log.error ? 'error' : 'success';
      const statusIcon = log.error ? '❌' : '✅';
      const method = this.escapeHtml(log.method || 'Unknown');
      const type = this.escapeHtml(log.type || 'BROP');
      
      // Safely handle error preview with proper escaping
      let errorPreview = '';
      if (log.error) {
        const errorText = String(log.error).substring(0, 100);
        errorPreview = this.escapeHtml(errorText) + (log.error.length > 100 ? '...' : '');
      }
      
      // Generate full details sections
      const fullDetails = this.generateLogFullDetails(log);
      
      return `
        <div class="log-entry ${status}" data-index="${index}">
          <div class="log-header">
            <span class="log-method">${method}<span class="expand-indicator">(click to expand)</span></span>
            <div class="log-meta">
              <span class="log-type ${type}">${type}</span>
              <span class="log-time">${time}</span>
              ${duration ? `<span class="log-duration">${duration}</span>` : ''}
              <span class="log-status">${statusIcon}</span>
            </div>
          </div>
          ${errorPreview ? `<div class="log-details">Error: ${errorPreview}</div>` : ''}
          <div class="log-full-details" id="details-${index}">
            ${fullDetails}
          </div>
        </div>
      `;
    }).join('');
  }

  generateSimpleLogEntries(logs) {
    if (logs.length === 0) {
      return '<div class="empty-logs">No call logs yet. Make some API calls to see them here.</div>';
    }

    return logs.map((log, index) => {
      const time = new Date(log.timestamp || Date.now()).toLocaleString();
      const duration = log.duration ? `${log.duration}ms` : '';
      const status = log.error ? 'error' : 'success';
      const statusIcon = log.error ? '❌' : '✅';
      const method = this.escapeHtml(log.method || 'Unknown');
      const type = this.escapeHtml(log.type || 'BROP');
      
      // Safely handle error preview with proper escaping
      let errorPreview = '';
      if (log.error) {
        const errorText = String(log.error).substring(0, 100);
        errorPreview = this.escapeHtml(errorText) + (log.error.length > 100 ? '...' : '');
      }
      
      return `
        <div class="log-entry ${status}">
          <div class="log-header">
            <span class="log-method">${method}</span>
            <div class="log-meta">
              <span class="log-type ${type}">${type}</span>
              <span class="log-time">${time}</span>
              ${duration ? `<span class="log-duration">${duration}</span>` : ''}
              <span class="log-status">${statusIcon}</span>
            </div>
          </div>
          ${errorPreview ? `<div class="log-details">Error: ${errorPreview}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  generateLogFullDetails(log) {
    const sections = [];
    
    // Basic Information
    sections.push(`
      <div class="detail-section">
        <div class="detail-label">Basic Information</div>
        <div class="detail-content">Method: ${this.escapeHtml(log.method || 'N/A')}
Type: ${this.escapeHtml(log.type || 'N/A')}
Timestamp: ${new Date(log.timestamp || Date.now()).toLocaleString()}
Duration: ${log.duration ? log.duration + 'ms' : 'N/A'}
Success: ${log.success !== undefined ? log.success : (log.error ? 'false' : 'true')}
ID: ${this.escapeHtml(log.id || 'N/A')}</div>
      </div>
    `);
    
    // Parameters
    if (log.params) {
      let paramsText;
      try {
        // Handle both string and object params
        if (typeof log.params === 'string') {
          const parsed = JSON.parse(log.params);
          paramsText = JSON.stringify(parsed, null, 2);
        } else {
          paramsText = JSON.stringify(log.params, null, 2);
        }
      } catch (e) {
        paramsText = String(log.params);
      }
      
      sections.push(`
        <div class="detail-section">
          <div class="detail-label">Parameters</div>
          <div class="detail-content">${this.escapeHtml(paramsText)}</div>
        </div>
      `);
    }
    
    // Result
    if (log.result) {
      let resultText;
      try {
        // Handle both string and object results
        if (typeof log.result === 'string') {
          const parsed = JSON.parse(log.result);
          resultText = JSON.stringify(parsed, null, 2);
        } else {
          resultText = JSON.stringify(log.result, null, 2);
        }
      } catch (e) {
        resultText = String(log.result);
      }
      
      sections.push(`
        <div class="detail-section">
          <div class="detail-label">Result</div>
          <div class="detail-content">${this.escapeHtml(resultText)}</div>
        </div>
      `);
    }
    
    // Error Details (full error, not truncated)
    if (log.error) {
      sections.push(`
        <div class="detail-section">
          <div class="detail-label">Error Details</div>
          <div class="detail-content">${this.escapeHtml(String(log.error))}</div>
        </div>
      `);
    }
    
    // Raw Log Data
    sections.push(`
      <div class="detail-section">
        <div class="detail-label">Raw Log Data</div>
        <div class="detail-content">${this.escapeHtml(JSON.stringify(log, null, 2))}</div>
      </div>
    `);
    
    return sections.join('');
  }

  escapeHtml(text) {
    if (typeof text !== 'string') {
      text = String(text);
    }
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }



  async clearConsoleLogs() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' });
      if (response && response.success) {
        // Refresh the logs display
        await this.updateConsolePreview();
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BROPPopup();
});