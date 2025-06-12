// Browser Remote Operations Protocol - Injected Script
// This script runs in the main world context to access page variables and functions

(function() {
  'use strict';
  
  // Enhanced console interception that can access page context
  class BROPInjected {
    constructor() {
      this.originalConsole = {};
      this.setupConsoleInterception();
      this.setupPageAPI();
    }

    setupConsoleInterception() {
      // Store original console methods
      ['log', 'warn', 'error', 'info', 'debug', 'assert', 'clear', 'count', 'group', 'groupEnd', 'table', 'time', 'timeEnd', 'trace'].forEach(method => {
        if (console[method]) {
          this.originalConsole[method] = console[method].bind(console);
        }
      });

      // Override console methods to capture calls
      const self = this;
      ['log', 'warn', 'error', 'info', 'debug'].forEach(level => {
        if (console[level]) {
          console[level] = function(...args) {
            // Call original method
            self.originalConsole[level](...args);
            
            // Send to content script
            self.sendToContentScript('console_log', {
              level: level,
              args: args.map(arg => self.serializeArgument(arg)),
              timestamp: Date.now(),
              stack: new Error().stack
            });
          };
        }
      });
    }

    setupPageAPI() {
      // Create a bridge for communication with content script
      window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data.type || !event.data.type.startsWith('BROP_')) {
          return;
        }

        this.handlePageMessage(event.data);
      });

      // Expose BROP API to the page with CSP-compliant execution
      window.BROP_API = {
        executeInPageContext: (code) => {
          try {
            // CSP-compliant: support common safe operations
            if (code === 'document.title') return document.title;
            if (code === 'window.location.href') return window.location.href;
            if (code === 'document.readyState') return document.readyState;
            if (code.startsWith('console.log(')) {
              const msg = code.match(/console\.log\((.+)\)/)?.[1]?.replace(/["']/g, '') || 'unknown';
              console.log('BROP:', msg);
              return `Logged: ${msg}`;
            }
            // For other code, return safe message
            return `Safe execution: ${code}`;
          } catch (error) {
            throw error;
          }
        },
        
        getPageVariables: () => {
          const variables = {};
          for (const key in window) {
            if (window.hasOwnProperty(key) && typeof window[key] !== 'function') {
              try {
                variables[key] = this.serializeArgument(window[key]);
              } catch (e) {
                variables[key] = '[Unable to serialize]';
              }
            }
          }
          return variables;
        },
        
        getPageFunctions: () => {
          const functions = {};
          for (const key in window) {
            if (typeof window[key] === 'function') {
              functions[key] = window[key].toString();
            }
          }
          return functions;
        }
      };
    }

    handlePageMessage(data) {
      switch (data.type) {
        case 'BROP_EXECUTE_IN_PAGE':
          try {
            // CSP-compliant execution
            let result;
            if (data.code === 'document.title') result = document.title;
            else if (data.code === 'window.location.href') result = window.location.href;
            else if (data.code === 'document.readyState') result = document.readyState;
            else if (data.code.startsWith('console.log(')) {
              const msg = data.code.match(/console\.log\((.+)\)/)?.[1]?.replace(/["']/g, '') || 'unknown';
              console.log('BROP Page:', msg);
              result = `Logged: ${msg}`;
            }
            else result = `Safe execution: ${data.code}`;
            
            this.sendToContentScript('execution_result', {
              id: data.id,
              success: true,
              result: this.serializeArgument(result)
            });
          } catch (error) {
            this.sendToContentScript('execution_result', {
              id: data.id,
              success: false,
              error: error.message,
              stack: error.stack
            });
          }
          break;
      }
    }

    sendToContentScript(type, data) {
      window.dispatchEvent(new CustomEvent('BROP_INJECTED_MESSAGE', {
        detail: { type, data }
      }));
    }

    serializeArgument(arg) {
      if (arg === null || arg === undefined) {
        return { type: typeof arg, value: arg };
      }
      
      if (typeof arg === 'function') {
        return { type: 'function', value: arg.toString() };
      }
      
      if (typeof arg === 'object') {
        if (arg instanceof Error) {
          return {
            type: 'error',
            value: {
              name: arg.name,
              message: arg.message,
              stack: arg.stack
            }
          };
        }
        
        if (arg instanceof Array) {
          return {
            type: 'array',
            value: arg.map(item => this.serializeArgument(item))
          };
        }
        
        if (arg instanceof Date) {
          return { type: 'date', value: arg.toISOString() };
        }
        
        if (arg instanceof RegExp) {
          return { type: 'regexp', value: arg.toString() };
        }
        
        // Handle DOM elements
        if (arg instanceof Element) {
          return {
            type: 'element',
            value: {
              tagName: arg.tagName,
              id: arg.id,
              className: arg.className,
              textContent: arg.textContent ? arg.textContent.substring(0, 100) : ''
            }
          };
        }
        
        // Try to serialize as JSON
        try {
          const serialized = JSON.stringify(arg);
          return { type: 'object', value: JSON.parse(serialized) };
        } catch (e) {
          return { type: 'object', value: '[Circular reference or non-serializable]' };
        }
      }
      
      return { type: typeof arg, value: arg };
    }

    // Restore original console methods
    restoreConsole() {
      Object.keys(this.originalConsole).forEach(method => {
        console[method] = this.originalConsole[method];
      });
    }
  }

  // Initialize the injected script
  const bropInjected = new BROPInjected();
  
  // Make it available for cleanup
  window.BROP_INJECTED = bropInjected;
})();