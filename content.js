// Browser Remote Operations Protocol - Content Script
// This script runs in the context of web pages and provides the interface
// for executing commands that require page-level access

class BROPContentScript {
  constructor() {
    this.setupMessageListener();
    this.setupConsoleInterception();
    this.consoleLogs = [];
    this.maxConsoleHistory = 1000;
  }

  setupMessageListener() {
    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'BROP_EXECUTE') {
        this.handleCommand(message.command, message.id)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
      }
    });
  }

  setupConsoleInterception() {
    // Intercept console methods to capture logs
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    };

    const interceptConsole = (level) => {
      const original = originalConsole[level];
      console[level] = (...args) => {
        // Call original console method
        original.apply(console, args);
        
        // Store the log entry
        this.addConsoleLog(level, args);
      };
    };

    ['log', 'warn', 'error', 'info', 'debug'].forEach(interceptConsole);

    // Also capture unhandled errors
    window.addEventListener('error', (event) => {
      this.addConsoleLog('error', [event.message], {
        source: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.addConsoleLog('error', [event.reason]);
    });
  }

  addConsoleLog(level, args, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' '),
      source: metadata.source || window.location.href,
      line: metadata.line || 0,
      column: metadata.column || 0
    };

    this.consoleLogs.push(logEntry);
    
    // Keep only the most recent logs
    if (this.consoleLogs.length > this.maxConsoleHistory) {
      this.consoleLogs = this.consoleLogs.slice(-this.maxConsoleHistory);
    }
  }

  async handleCommand(command, commandId) {
    switch (command.type) {
      case 'get_console_logs':
        return this.getConsoleLogs(command.params);
      
      case 'execute_console':
        return this.executeConsole(command.params);
      
      case 'get_page_content':
        return this.getPageContent(command.params);
      
      case 'click':
        return this.clickElement(command.params);
      
      case 'type':
        return this.typeText(command.params);
      
      case 'wait_for_element':
        return this.waitForElement(command.params);
      
      case 'evaluate_js':
        return this.evaluateJavaScript(command.params);
      
      case 'get_element':
        return this.getElement(command.params);
      
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }

  getConsoleLogs(params) {
    let logs = [...this.consoleLogs];
    
    // Filter by level if specified
    if (params.level && params.level !== 'all') {
      logs = logs.filter(log => log.level === params.level);
    }
    
    // Limit number of logs
    if (params.limit && params.limit > 0) {
      logs = logs.slice(-params.limit);
    }
    
    return { logs };
  }

  executeConsole(params) {
    try {
      const result = eval(params.code);
      return {
        result: this.serializeResult(result),
        error: null
      };
    } catch (error) {
      return {
        result: null,
        error: error.message
      };
    }
  }

  getPageContent(params) {
    const result = {};
    
    if (params.include_html) {
      result.html = document.documentElement.outerHTML;
    }
    
    if (params.include_text) {
      result.text = document.body.innerText || document.body.textContent;
    }
    
    if (params.include_metadata) {
      result.title = document.title;
      result.url = window.location.href;
      result.links = Array.from(document.links).map(link => link.href);
      result.images = Array.from(document.images).map(img => img.src);
    }
    
    return result;
  }

  clickElement(params) {
    const element = this.findElement(params.selector);
    if (!element) {
      throw new Error(`Element not found: ${params.selector}`);
    }

    // Check if element is visible and clickable
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      throw new Error('Element is not visible');
    }

    // Create click event
    const clickEvent = new MouseEvent(params.double_click ? 'dblclick' : 'click', {
      view: window,
      bubbles: true,
      cancelable: true,
      button: params.button || 0,
      clientX: params.x !== undefined ? params.x : rect.left + rect.width / 2,
      clientY: params.y !== undefined ? params.y : rect.top + rect.height / 2
    });

    element.dispatchEvent(clickEvent);
    
    return {
      clicked: true,
      element_tag: element.tagName.toLowerCase()
    };
  }

  typeText(params) {
    const element = this.findElement(params.selector);
    if (!element) {
      throw new Error(`Element not found: ${params.selector}`);
    }

    // Clear existing text if requested
    if (params.clear_first) {
      element.value = '';
    }

    // Focus the element
    element.focus();

    // Type text with delay if specified
    if (params.delay && params.delay > 0) {
      return this.typeWithDelay(element, params.text, params.delay);
    } else {
      // Set value directly for faster typing
      element.value = (element.value || '') + params.text;
      
      // Trigger input events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      return {
        typed: true,
        final_value: element.value
      };
    }
  }

  async typeWithDelay(element, text, delay) {
    for (const char of text) {
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    return {
      typed: true,
      final_value: element.value
    };
  }

  async waitForElement(params) {
    const startTime = Date.now();
    const timeout = params.timeout || 30000;
    
    return new Promise((resolve, reject) => {
      const checkElement = () => {
        const element = this.findElement(params.selector);
        
        if (element) {
          const isVisible = this.isElementVisible(element);
          
          if (params.visible && !isVisible) {
            // Continue waiting for visibility
          } else if (params.hidden && isVisible) {
            // Continue waiting for element to be hidden
          } else {
            // Element found and meets visibility requirements
            resolve({
              found: true,
              visible: isVisible,
              element: this.getElementInfo(element)
            });
            return;
          }
        }
        
        // Check timeout
        if (Date.now() - startTime > timeout) {
          resolve({
            found: false,
            visible: false,
            element: null
          });
          return;
        }
        
        // Continue checking
        setTimeout(checkElement, 100);
      };
      
      checkElement();
    });
  }

  evaluateJavaScript(params) {
    try {
      const result = eval(params.code);
      return {
        result: this.serializeResult(result),
        type: typeof result,
        error: null
      };
    } catch (error) {
      return {
        result: null,
        type: 'error',
        error: error.message
      };
    }
  }

  getElement(params) {
    if (params.get_all) {
      const elements = document.querySelectorAll(params.selector);
      return {
        elements: Array.from(elements).map(el => this.getElementInfo(el))
      };
    } else {
      const element = this.findElement(params.selector);
      if (!element) {
        return { elements: [] };
      }
      return {
        elements: [this.getElementInfo(element)]
      };
    }
  }

  findElement(selector) {
    try {
      return document.querySelector(selector);
    } catch (error) {
      throw new Error(`Invalid selector: ${selector}`);
    }
  }

  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  }

  getElementInfo(element) {
    const rect = element.getBoundingClientRect();
    const attributes = {};
    
    // Get all attributes
    for (const attr of element.attributes) {
      attributes[attr.name] = attr.value;
    }
    
    return {
      tag_name: element.tagName.toLowerCase(),
      text_content: element.textContent || '',
      inner_html: element.innerHTML,
      attributes: attributes,
      bounding_box: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      visible: this.isElementVisible(element)
    };
  }

  serializeResult(result) {
    if (result === null || result === undefined) {
      return String(result);
    }
    
    if (typeof result === 'object') {
      try {
        return JSON.stringify(result, null, 2);
      } catch (error) {
        return String(result);
      }
    }
    
    return String(result);
  }
}

// Initialize the content script
const bropContent = new BROPContentScript();

// Make it available globally for debugging
window.BROP = bropContent;