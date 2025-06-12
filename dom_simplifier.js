/**
 * DOM Simplifier for AI Interaction
 * 
 * Extracts and simplifies the DOM tree to create an AI-friendly representation
 * that focuses on interactive elements and semantic structure.
 */

class DOMSimplifier {
    constructor() {
        // Interactive element types that AI typically needs to interact with
        this.interactiveElements = new Set([
            'button', 'a', 'input', 'textarea', 'select', 'option',
            'form', 'label', 'summary', 'details', 'video', 'audio'
        ]);

        // Interactive roles
        this.interactiveRoles = new Set([
            'button', 'link', 'textbox', 'combobox', 'listbox', 'option',
            'checkbox', 'radio', 'slider', 'spinbutton', 'searchbox',
            'tab', 'tabpanel', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
            'treeitem', 'gridcell', 'columnheader', 'rowheader'
        ]);

        // Elements that provide important structure
        this.structuralElements = new Set([
            'main', 'nav', 'header', 'footer', 'section', 'article',
            'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span'
        ]);

        // Elements to typically ignore
        this.ignoredElements = new Set([
            'script', 'style', 'meta', 'link', 'title', 'head', 
            'noscript', 'template', 'svg', 'path', 'g', 'defs'
        ]);
    }

    /**
     * Simplify the entire DOM tree
     */
    simplifyDOM(options = {}) {
        const config = {
            maxDepth: options.max_depth || 5,
            includeHidden: options.include_hidden || false,
            includeTextNodes: options.include_text_nodes !== false,
            includeCoordinates: options.include_coordinates !== false,
            focusSelectors: options.focus_selectors || []
        };

        const startTime = performance.now();
        
        // Start from document.body or a focused area
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

        const endTime = performance.now();
        
        console.log(`DOM simplification completed in ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`Found ${interactiveCount} interactive elements`);

        return {
            root: simplifiedTree,
            total_interactive_elements: interactiveCount,
            suggested_selectors: suggestedSelectors,
            page_structure_summary: structureSummary
        };
    }

    /**
     * Process a single DOM element recursively
     */
    processElement(element, depth, config) {
        if (!element || depth > config.maxDepth) {
            return null;
        }

        // Skip ignored elements
        if (this.ignoredElements.has(element.tagName.toLowerCase())) {
            return null;
        }

        // Skip hidden elements unless explicitly requested
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

        // Process children
        const shouldProcessChildren = this.shouldProcessChildren(element, node);
        if (shouldProcessChildren && element.children) {
            for (const child of element.children) {
                const childNode = this.processElement(child, depth + 1, config);
                if (childNode) {
                    node.children.push(childNode);
                }
            }
        }

        // Skip non-interactive elements with no interactive children at deep levels
        if (depth > 2 && !node.interactive && node.children.length === 0) {
            if (!this.structuralElements.has(tagName) && !node.text.trim()) {
                return null;
            }
        }

        return node;
    }

    /**
     * Determine the semantic role of an element
     */
    getElementRole(element) {
        // Explicit ARIA role
        if (element.getAttribute('role')) {
            return element.getAttribute('role');
        }

        // Implicit roles based on element type
        const tag = element.tagName.toLowerCase();
        const type = element.type?.toLowerCase();

        switch (tag) {
            case 'button':
                return 'button';
            case 'a':
                return element.href ? 'link' : 'text';
            case 'input':
                switch (type) {
                    case 'text':
                    case 'email':
                    case 'password':
                    case 'search':
                    case 'tel':
                    case 'url':
                        return 'textbox';
                    case 'checkbox':
                        return 'checkbox';
                    case 'radio':
                        return 'radio';
                    case 'submit':
                    case 'button':
                        return 'button';
                    case 'range':
                        return 'slider';
                    case 'number':
                        return 'spinbutton';
                    default:
                        return 'textbox';
                }
            case 'textarea':
                return 'textbox';
            case 'select':
                return element.multiple ? 'listbox' : 'combobox';
            case 'option':
                return 'option';
            case 'img':
                return element.alt ? 'img' : 'presentation';
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                return 'heading';
            case 'nav':
                return 'navigation';
            case 'main':
                return 'main';
            case 'form':
                return 'form';
            case 'table':
                return 'table';
            case 'ul':
            case 'ol':
                return 'list';
            case 'li':
                return 'listitem';
            default:
                return 'generic';
        }
    }

    /**
     * Generate a CSS selector for the element
     */
    generateSelector(element) {
        // Prefer ID if available and unique
        if (element.id && document.querySelectorAll(`#${element.id}`).length === 1) {
            return `#${element.id}`;
        }

        // Try data attributes that might be useful
        const testId = element.getAttribute('data-testid') || element.getAttribute('data-test');
        if (testId) {
            return `[data-testid="${testId}"]`;
        }

        // Use class names if they seem semantic
        const meaningfulClasses = Array.from(element.classList).filter(cls => 
            !cls.match(/^(css-|_|sc-|jsx-)/) && cls.length > 2
        );
        
        if (meaningfulClasses.length > 0) {
            const classSelector = `.${meaningfulClasses[0]}`;
            if (document.querySelectorAll(classSelector).length <= 5) {
                return classSelector;
            }
        }

        // Generate based on hierarchy and position
        let selector = element.tagName.toLowerCase();
        
        // Add type for inputs
        if (element.type) {
            selector += `[type="${element.type}"]`;
        }

        // Add position among siblings if needed
        const siblings = Array.from(element.parentElement?.children || [])
            .filter(el => el.tagName === element.tagName);
        
        if (siblings.length > 1) {
            const index = siblings.indexOf(element);
            selector += `:nth-of-type(${index + 1})`;
        }

        return selector;
    }

    /**
     * Extract meaningful text content
     */
    getElementText(element, includeTextNodes) {
        if (!includeTextNodes) {
            return '';
        }

        // For inputs, return the value or placeholder
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            return element.value || element.placeholder || '';
        }

        // For images, return alt text
        if (element.tagName === 'IMG') {
            return element.alt || '';
        }

        // Get direct text content, excluding nested interactive elements
        let text = '';
        for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent.trim() + ' ';
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Include text from non-interactive children
                if (!this.isInteractive(node)) {
                    text += node.textContent.trim() + ' ';
                }
            }
        }

        return text.trim().substring(0, 200); // Limit text length
    }

    /**
     * Get the current value of form elements
     */
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

    /**
     * Check if element is interactive
     */
    isInteractive(element) {
        const tag = element.tagName.toLowerCase();
        const role = element.getAttribute('role');
        
        // Check by tag name
        if (this.interactiveElements.has(tag)) {
            return true;
        }
        
        // Check by role
        if (role && this.interactiveRoles.has(role)) {
            return true;
        }
        
        // Check for click handlers
        if (element.onclick || element.getAttribute('onclick')) {
            return true;
        }
        
        // Check for cursor pointer (often indicates clickable)
        const computed = window.getComputedStyle(element);
        if (computed.cursor === 'pointer') {
            return true;
        }
        
        // Check for tabindex (keyboard accessible)
        if (element.tabIndex >= 0) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if element is visible
     */
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

    /**
     * Check if element is enabled
     */
    isElementEnabled(element) {
        if (element.disabled) {
            return false;
        }
        
        if (element.getAttribute('aria-disabled') === 'true') {
            return false;
        }
        
        // Check if parent form is disabled
        const form = element.closest('form');
        if (form && form.disabled) {
            return false;
        }
        
        return true;
    }

    /**
     * Get element position and size
     */
    getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    }

    /**
     * Should we process children of this element?
     */
    shouldProcessChildren(element, node) {
        // Always process structural elements
        if (this.structuralElements.has(element.tagName.toLowerCase())) {
            return true;
        }
        
        // Don't process children of leaf interactive elements like inputs
        if (node.interactive && ['input', 'textarea', 'button', 'img'].includes(node.tag)) {
            return false;
        }
        
        return true;
    }

    /**
     * Generate AI-friendly description
     */
    generateAIDescription(element) {
        const tag = element.tagName.toLowerCase();
        const role = this.getElementRole(element);
        const text = this.getElementText(element, true);
        const value = this.getElementValue(element);
        
        let description = '';
        
        // Start with role/type
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
        
        // Add text content
        if (text) {
            description += `: "${text.substring(0, 50)}"`;
        }
        
        // Add current value for form elements
        if (value && value !== text) {
            description += ` (current: "${value}")`;
        }
        
        // Add state information
        if (!this.isElementEnabled(element)) {
            description += ' (disabled)';
        }
        
        if (!this.isElementVisible(element)) {
            description += ' (hidden)';
        }
        
        return description;
    }

    /**
     * Count interactive elements in the tree
     */
    countInteractiveElements(node) {
        if (!node) return 0;
        
        let count = node.interactive ? 1 : 0;
        for (const child of node.children) {
            count += this.countInteractiveElements(child);
        }
        return count;
    }

    /**
     * Generate suggested selectors for common actions
     */
    generateSuggestedSelectors() {
        const suggestions = [];
        
        // Common form elements
        const submitBtn = document.querySelector('input[type="submit"], button[type="submit"], button:contains("Submit")');
        if (submitBtn) {
            suggestions.push(this.generateSelector(submitBtn) + ' // Submit button');
        }
        
        // Search inputs
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i], input[name*="search" i]');
        if (searchInput) {
            suggestions.push(this.generateSelector(searchInput) + ' // Search input');
        }
        
        // Login/signup forms
        const loginBtn = document.querySelector('button:contains("Login"), a:contains("Login"), input[value*="login" i]');
        if (loginBtn) {
            suggestions.push(this.generateSelector(loginBtn) + ' // Login button');
        }
        
        // Navigation links
        const navLinks = document.querySelectorAll('nav a, header a');
        if (navLinks.length > 0) {
            suggestions.push('nav a // Navigation links');
        }
        
        return suggestions;
    }

    /**
     * Generate a brief summary of page structure
     */
    generateStructureSummary(rootNode) {
        const summary = [];
        
        // Count different types of elements
        const counts = this.countElementTypes(rootNode);
        
        if (counts.buttons > 0) {
            summary.push(`${counts.buttons} buttons`);
        }
        if (counts.links > 0) {
            summary.push(`${counts.links} links`);
        }
        if (counts.inputs > 0) {
            summary.push(`${counts.inputs} input fields`);
        }
        if (counts.headings > 0) {
            summary.push(`${counts.headings} headings`);
        }
        
        // Detect page type
        const pageType = this.detectPageType(rootNode);
        if (pageType) {
            summary.unshift(pageType);
        }
        
        return summary.join(', ') || 'Basic webpage';
    }

    /**
     * Count different types of elements
     */
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

    /**
     * Detect the type of page based on content
     */
    detectPageType(rootNode) {
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
}

// Export for use in both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMSimplifier;
} else if (typeof window !== 'undefined') {
    window.DOMSimplifier = DOMSimplifier;
}