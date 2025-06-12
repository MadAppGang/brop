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
    document.getElementById('clear-logs').addEventListener('click', () => {
      this.clearConsoleLogs();
    });

    document.getElementById('test-connection').addEventListener('click', () => {
      this.testConnection();
    });
  }

  startStatusUpdates() {
    // Update status every 2 seconds
    setInterval(() => {
      this.updateStatus();
      this.updateConsolePreview();
    }, 2000);
  }

  async updateStatus() {
    try {
      // Check if background script is responsive
      const response = await chrome.runtime.sendMessage({ type: 'BROP_STATUS' });
      this.setStatus(true, 'Active - Ready for connections');
    } catch (error) {
      this.setStatus(false, 'Background script not responding');
    }
  }

  setStatus(active, message) {
    const statusElement = document.getElementById('status');
    statusElement.className = active ? 'status active' : 'status inactive';
    statusElement.querySelector('span').textContent = message;
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
      // Request recent console logs from content script
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) return;

      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'BROP_EXECUTE',
        command: {
          type: 'get_console_logs',
          params: { limit: 5, level: 'all' }
        },
        id: Date.now().toString()
      });

      if (response && response.success && response.result.logs) {
        this.displayConsoleLogs(response.result.logs);
      }
    } catch (error) {
      // Content script might not be loaded or tab might not support it
      this.displayConsoleLogs([]);
    }
  }

  displayConsoleLogs(logs) {
    const previewElement = document.getElementById('console-preview');
    
    if (logs.length === 0) {
      previewElement.innerHTML = '<div class="console-entry">No recent console logs</div>';
      return;
    }

    const entries = logs.slice(-5).map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      return `<div class="console-entry ${log.level}">[${time}] ${log.level.toUpperCase()}: ${log.message}</div>`;
    }).join('');

    previewElement.innerHTML = entries;
    previewElement.scrollTop = previewElement.scrollHeight;
  }

  async clearConsoleLogs() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) return;

      // Clear console logs in content script
      await chrome.tabs.sendMessage(activeTab.id, {
        type: 'BROP_CLEAR_LOGS'
      });

      // Also clear browser console
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => console.clear()
      });

      this.updateConsolePreview();
    } catch (error) {
      console.error('Failed to clear console logs:', error);
    }
  }

  async testConnection() {
    const button = document.getElementById('test-connection');
    const originalText = button.textContent;
    
    button.textContent = 'Testing...';
    button.disabled = true;

    try {
      // Test basic functionality
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        throw new Error('No active tab found');
      }

      // Test console execution
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'BROP_EXECUTE',
        command: {
          type: 'execute_console',
          params: { code: 'console.log("BROP test successful"); "Test completed"' }
        },
        id: Date.now().toString()
      });

      if (response && response.success) {
        button.textContent = 'Success!';
        button.style.backgroundColor = '#4caf50';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.backgroundColor = '';
          button.disabled = false;
        }, 2000);
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (error) {
      button.textContent = 'Failed';
      button.style.backgroundColor = '#f44336';
      console.error('Test failed:', error);
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '';
        button.disabled = false;
      }, 2000);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BROPPopup();
});