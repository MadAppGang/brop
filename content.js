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
      
      case 'get_simplified_dom':
        return this.getSimplifiedDOM(command.params);
      
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

  getSimplifiedDOM(params) {
    // Load DOM simplifier if not already available
    if (!window.DOMSimplifier) {
      // Inject the DOM simplifier script
      this.loadDOMSimplifier();
    }
    
    if (!window.DOMSimplifier) {
      throw new Error('DOM Simplifier not available');
    }
    
    const simplifier = new window.DOMSimplifier();
    return simplifier.simplifyDOM(params);
  }

  loadDOMSimplifier() {
    // Inline DOM simplifier for content script use
    // This is a simplified version of the main DOMSimplifier class
    window.DOMSimplifier = class {
      constructor() {
        this.interactiveElements = new Set([
          'button', 'a', 'input', 'textarea', 'select', 'option',
          'form', 'label', 'summary', 'details', 'video', 'audio'
        ]);

        this.interactiveRoles = new Set([
          'button', 'link', 'textbox', 'combobox', 'listbox', 'option',
          'checkbox', 'radio', 'slider', 'spinbutton', 'searchbox',
          'tab', 'tabpanel', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
          'treeitem', 'gridcell', 'columnheader', 'rowheader'
        ]);

        this.structuralElements = new Set([
          'main', 'nav', 'header', 'footer', 'section', 'article',
          'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span'
        ]);

        this.ignoredElements = new Set([
          'script', 'style', 'meta', 'link', 'title', 'head', 
          'noscript', 'template', 'svg', 'path', 'g', 'defs'
        ]);
      }

      simplifyDOM(options = {}) {
        const config = {
          maxDepth: options.max_depth || 5,
          includeHidden: options.include_hidden || false,
          includeTextNodes: options.include_text_nodes !== false,
          includeCoordinates: options.include_coordinates !== false,
          focusSelectors: options.focus_selectors || []
        };

        let rootElement = document.body;
        if (config.focusSelectors.length > 0) {
          const focusElement = document.querySelector(config.focusSelectors[0]);
          if (focusElement) {
            rootElement = focusElement;
          }
        }

        const simplifiedTree = this.processElement(rootElement, 0, config);
        const interactiveCount = this.countInteractiveElements(simplifiedTree);
        const suggestedSelectors = this.generateSuggestedSelectors();
        const structureSummary = this.generateStructureSummary(simplifiedTree);

        return {
          root: simplifiedTree,
          total_interactive_elements: interactiveCount,
          suggested_selectors: suggestedSelectors,
          page_structure_summary: structureSummary
        };
      }

      processElement(element, depth, config) {
        if (!element || depth > config.maxDepth) {
          return null;
        }

        if (this.ignoredElements.has(element.tagName.toLowerCase())) {
          return null;
        }

        if (!config.includeHidden && !this.isElementVisible(element)) {
          return null;
        }

        const tagName = element.tagName.toLowerCase();
        const node = {
          tag: tagName,
          role: this.getElementRole(element),
          selector: this.generateSelector(element),
          text: this.getElementText(element, config.includeTextNodes),
          placeholder: element.placeholder || '',
          value: this.getElementValue(element),
          type: element.type || '',
          href: element.href || '',
          id: element.id || '',
          classes: Array.from(element.classList),
          interactive: this.isInteractive(element),
          visible: this.isElementVisible(element),
          enabled: this.isElementEnabled(element),
          position: config.includeCoordinates ? this.getElementPosition(element) : null,
          children: [],
          ai_description: this.generateAIDescription(element)
        };

        const shouldProcessChildren = this.shouldProcessChildren(element, node);
        if (shouldProcessChildren && element.children) {
          for (const child of element.children) {
            const childNode = this.processElement(child, depth + 1, config);
            if (childNode) {
              node.children.push(childNode);
            }
          }
        }

        if (depth > 2 && !node.interactive && node.children.length === 0) {
          if (!this.structuralElements.has(tagName) && !node.text.trim()) {
            return null;
          }
        }

        return node;
      }

      getElementRole(element) {
        if (element.getAttribute('role')) {
          return element.getAttribute('role');
        }

        const tag = element.tagName.toLowerCase();
        const type = element.type?.toLowerCase();

        switch (tag) {
          case 'button': return 'button';
          case 'a': return element.href ? 'link' : 'text';
          case 'input':
            switch (type) {
              case 'text':
              case 'email':
              case 'password':
              case 'search':
              case 'tel':
              case 'url':
                return 'textbox';
              case 'checkbox': return 'checkbox';
              case 'radio': return 'radio';
              case 'submit':
              case 'button': return 'button';
              case 'range': return 'slider';
              case 'number': return 'spinbutton';
              default: return 'textbox';
            }
          case 'textarea': return 'textbox';
          case 'select': return element.multiple ? 'listbox' : 'combobox';
          case 'option': return 'option';
          case 'img': return element.alt ? 'img' : 'presentation';
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6': return 'heading';
          case 'nav': return 'navigation';
          case 'main': return 'main';
          case 'form': return 'form';
          default: return 'generic';
        }
      }

      generateSelector(element) {
        if (element.id && document.querySelectorAll(`#${element.id}`).length === 1) {
          return `#${element.id}`;
        }

        const testId = element.getAttribute('data-testid') || element.getAttribute('data-test');
        if (testId) {
          return `[data-testid="${testId}"]`;
        }

        const meaningfulClasses = Array.from(element.classList).filter(cls => 
          !cls.match(/^(css-|_|sc-|jsx-)/) && cls.length > 2
        );
        
        if (meaningfulClasses.length > 0) {
          const classSelector = `.${meaningfulClasses[0]}`;
          if (document.querySelectorAll(classSelector).length <= 5) {
            return classSelector;
          }
        }

        let selector = element.tagName.toLowerCase();
        
        if (element.type) {
          selector += `[type="${element.type}"]`;
        }

        const siblings = Array.from(element.parentElement?.children || [])
          .filter(el => el.tagName === element.tagName);
        
        if (siblings.length > 1) {
          const index = siblings.indexOf(element);
          selector += `:nth-of-type(${index + 1})`;
        }

        return selector;
      }

      getElementText(element, includeTextNodes) {
        if (!includeTextNodes) return '';

        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          return element.value || element.placeholder || '';
        }

        if (element.tagName === 'IMG') {
          return element.alt || '';
        }

        let text = '';
        for (const node of element.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent.trim() + ' ';
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (!this.isInteractive(node)) {
              text += node.textContent.trim() + ' ';
            }
          }
        }

        return text.trim().substring(0, 200);
      }

      getElementValue(element) {
        const tag = element.tagName.toLowerCase();
        
        if (tag === 'input' || tag === 'textarea') {
          if (element.type === 'checkbox' || element.type === 'radio') {
            return element.checked ? 'checked' : 'unchecked';
          }
          return element.value || '';
        }
        
        if (tag === 'select') {
          return element.value || '';
        }
        
        return '';
      }

      isInteractive(element) {
        const tag = element.tagName.toLowerCase();
        const role = element.getAttribute('role');
        
        if (this.interactiveElements.has(tag)) return true;
        if (role && this.interactiveRoles.has(role)) return true;
        if (element.onclick || element.getAttribute('onclick')) return true;
        if (element.tabIndex >= 0) return true;
        
        const computed = window.getComputedStyle(element);
        if (computed.cursor === 'pointer') return true;
        
        return false;
      }

      isElementVisible(element) {
        if (!element.offsetParent && element.offsetWidth === 0 && element.offsetHeight === 0) {
          return false;
        }
        
        const computed = window.getComputedStyle(element);
        if (computed.display === 'none' || computed.visibility === 'hidden') {
          return false;
        }
        
        if (computed.opacity === '0') {
          return false;
        }
        
        return true;
      }

      isElementEnabled(element) {
        if (element.disabled) return false;
        if (element.getAttribute('aria-disabled') === 'true') return false;
        
        const form = element.closest('form');
        if (form && form.disabled) return false;
        
        return true;
      }

      getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }

      shouldProcessChildren(element, node) {
        if (this.structuralElements.has(element.tagName.toLowerCase())) {
          return true;
        }
        
        if (node.interactive && ['input', 'textarea', 'button', 'img'].includes(node.tag)) {
          return false;
        }
        
        return true;
      }

      generateAIDescription(element) {
        const tag = element.tagName.toLowerCase();
        const role = this.getElementRole(element);
        const text = this.getElementText(element, true);
        const value = this.getElementValue(element);
        
        let description = '';
        
        if (role === 'button') {
          description = 'Button';
        } else if (role === 'link') {
          description = 'Link';
        } else if (role === 'textbox') {
          description = element.type === 'password' ? 'Password field' : 'Text input';
        } else if (role === 'checkbox') {
          description = 'Checkbox';
        } else if (role === 'radio') {
          description = 'Radio button';
        } else if (role === 'combobox' || role === 'listbox') {
          description = 'Dropdown';
        } else if (role === 'heading') {
          description = `Heading level ${tag.slice(1)}`;
        } else {
          description = role.charAt(0).toUpperCase() + role.slice(1);
        }
        
        if (text) {
          description += `: "${text.substring(0, 50)}"`;
        }
        
        if (value && value !== text) {
          description += ` (current: "${value}")`;
        }
        
        if (!this.isElementEnabled(element)) {
          description += ' (disabled)';
        }
        
        if (!this.isElementVisible(element)) {
          description += ' (hidden)';
        }
        
        return description;
      }

      countInteractiveElements(node) {
        if (!node) return 0;
        
        let count = node.interactive ? 1 : 0;
        for (const child of node.children) {
          count += this.countInteractiveElements(child);
        }
        return count;
      }

      generateSuggestedSelectors() {
        const suggestions = [];
        
        const submitBtn = document.querySelector('input[type="submit"], button[type="submit"]');
        if (submitBtn) {
          suggestions.push(this.generateSelector(submitBtn) + ' // Submit button');
        }
        
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i], input[name*="search" i]');
        if (searchInput) {
          suggestions.push(this.generateSelector(searchInput) + ' // Search input');
        }
        
        const navLinks = document.querySelectorAll('nav a, header a');
        if (navLinks.length > 0) {
          suggestions.push('nav a // Navigation links');
        }
        
        return suggestions;
      }

      generateStructureSummary(rootNode) {
        const counts = this.countElementTypes(rootNode);
        const summary = [];
        
        if (counts.buttons > 0) summary.push(`${counts.buttons} buttons`);
        if (counts.links > 0) summary.push(`${counts.links} links`);
        if (counts.inputs > 0) summary.push(`${counts.inputs} input fields`);
        if (counts.headings > 0) summary.push(`${counts.headings} headings`);
        
        const pageType = this.detectPageType();
        if (pageType) summary.unshift(pageType);
        
        return summary.join(', ') || 'Basic webpage';
      }

      countElementTypes(node) {
        if (!node) return { buttons: 0, links: 0, inputs: 0, headings: 0 };
        
        const counts = { buttons: 0, links: 0, inputs: 0, headings: 0 };
        
        if (node.role === 'button') counts.buttons++;
        if (node.role === 'link') counts.links++;
        if (node.role === 'textbox' || node.tag === 'input' || node.tag === 'textarea') counts.inputs++;
        if (node.role === 'heading') counts.headings++;
        
        for (const child of node.children) {
          const childCounts = this.countElementTypes(child);
          counts.buttons += childCounts.buttons;
          counts.links += childCounts.links;
          counts.inputs += childCounts.inputs;
          counts.headings += childCounts.headings;
        }
        
        return counts;
      }

      detectPageType() {
        const pageText = document.title.toLowerCase() + ' ' + document.body.textContent.toLowerCase();
        
        if (pageText.includes('login') || pageText.includes('sign in')) {
          return 'Login page';
        }
        if (pageText.includes('register') || pageText.includes('sign up')) {
          return 'Registration page';
        }
        if (pageText.includes('search') || document.querySelector('input[type="search"]')) {
          return 'Search page';
        }
        if (pageText.includes('cart') || pageText.includes('checkout')) {
          return 'Shopping page';
        }
        if (document.querySelector('form')) {
          return 'Form page';
        }
        if (document.querySelector('article, .article, .post')) {
          return 'Article/content page';
        }
        
        return null;
      }
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