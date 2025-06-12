/**
 * BROP Stagehand Provider
 * 
 * Integrates BROP (Browser Remote Operations Protocol) with Stagehand
 * to enable AI-powered browser automation using the BROP extension.
 */

const { chromium } = require('playwright');

class BROPStagehandProvider {
    constructor(options = {}) {
        this.options = {
            cdpUrl: options.cdpUrl || 'ws://localhost:9222',
            bropUrl: options.bropUrl || 'ws://localhost:9223',
            timeout: options.timeout || 30000,
            headless: options.headless !== false, // default true
            viewport: options.viewport || { width: 1280, height: 720 },
            userAgent: options.userAgent || 'Stagehand/1.0 (BROP)',
            ...options
        };
        
        this.browser = null;
        this.context = null;
        this.activePage = null;
        this.isConnected = false;
    }

    /**
     * Connect to BROP and create browser context
     */
    async connect() {
        try {
            console.log('🔌 Connecting to BROP via CDP:', this.options.cdpUrl);
            
            // Connect to BROP's CDP server
            this.browser = await chromium.connectOverCDP(this.options.cdpUrl);
            
            // Create or get a context
            if (this.browser.contexts().length > 0) {
                this.context = this.browser.contexts()[0];
                console.log('✅ Using existing browser context');
            } else {
                this.context = await this.browser.newContext({
                    viewport: this.options.viewport,
                    userAgent: this.options.userAgent
                });
                console.log('✅ Created new browser context');
            }

            // Get or create a page
            const pages = this.context.pages();
            if (pages.length > 0) {
                this.activePage = pages[0];
                console.log('✅ Using existing page');
            } else {
                this.activePage = await this.context.newPage();
                console.log('✅ Created new page');
            }

            this.isConnected = true;
            console.log('🎉 BROP Stagehand Provider connected successfully');
            
            return {
                browser: this.browser,
                context: this.context,
                page: this.activePage
            };

        } catch (error) {
            console.error('❌ Failed to connect to BROP:', error.message);
            throw new Error(`BROP connection failed: ${error.message}`);
        }
    }

    /**
     * Disconnect from BROP
     */
    async disconnect() {
        try {
            if (this.context) {
                await this.context.close();
            }
            if (this.browser) {
                await this.browser.close();
            }
            this.isConnected = false;
            console.log('🔌 Disconnected from BROP');
        } catch (error) {
            console.error('❌ Error disconnecting from BROP:', error.message);
        }
    }

    /**
     * Get the active page for Stagehand
     */
    getPage() {
        if (!this.isConnected || !this.activePage) {
            throw new Error('BROP provider not connected. Call connect() first.');
        }
        return this.activePage;
    }

    /**
     * Get the browser context
     */
    getContext() {
        if (!this.isConnected || !this.context) {
            throw new Error('BROP provider not connected. Call connect() first.');
        }
        return this.context;
    }

    /**
     * Get the browser instance
     */
    getBrowser() {
        if (!this.isConnected || !this.browser) {
            throw new Error('BROP provider not connected. Call connect() first.');
        }
        return this.browser;
    }

    /**
     * Enhanced page actions using BROP's simplified DOM
     */
    async getSimplifiedDOM(options = {}) {
        const page = this.getPage();
        
        try {
            // Use BROP's simplified DOM feature via JavaScript evaluation
            const simplifiedDOM = await page.evaluate((options) => {
                // Check if BROP content script is available
                if (window.BROP && window.BROP.getSimplifiedDOM) {
                    return window.BROP.getSimplifiedDOM(options);
                }
                
                // Fallback: create basic DOM structure
                return {
                    root: {
                        tag: 'body',
                        role: 'generic',
                        selector: 'body',
                        text: document.body.innerText.substring(0, 200),
                        children: []
                    },
                    total_interactive_elements: document.querySelectorAll('button, a, input, textarea, select').length,
                    suggested_selectors: [],
                    page_structure_summary: `Page with ${document.querySelectorAll('*').length} elements`
                };
            }, options);

            return simplifiedDOM;

        } catch (error) {
            console.error('❌ Failed to get simplified DOM:', error.message);
            throw error;
        }
    }

    /**
     * Smart element finder using BROP's AI-optimized selectors
     */
    async findElementSmart(description, options = {}) {
        const page = this.getPage();
        const simplifiedDOM = await this.getSimplifiedDOM(options);
        
        // Use the simplified DOM to find the best matching element
        const element = this.findElementInDOM(simplifiedDOM.root, description);
        
        if (element && element.selector) {
            try {
                const playwrightElement = await page.locator(element.selector).first();
                return {
                    element: playwrightElement,
                    selector: element.selector,
                    description: element.ai_description,
                    confidence: this.calculateConfidence(description, element)
                };
            } catch (error) {
                console.warn('⚠️ Selector not found:', element.selector);
            }
        }

        return null;
    }

    /**
     * Recursively search simplified DOM for matching elements
     */
    findElementInDOM(node, description) {
        if (!node) return null;

        const lowerDesc = description.toLowerCase();
        const nodeText = (node.text || '').toLowerCase();
        const nodeDesc = (node.ai_description || '').toLowerCase();
        
        // Check if this node matches
        if (nodeText.includes(lowerDesc) || 
            nodeDesc.includes(lowerDesc) || 
            (node.role && lowerDesc.includes(node.role)) ||
            (node.type && lowerDesc.includes(node.type))) {
            return node;
        }

        // Search children
        for (const child of node.children || []) {
            const found = this.findElementInDOM(child, description);
            if (found) return found;
        }

        return null;
    }

    /**
     * Calculate confidence score for element matching
     */
    calculateConfidence(description, element) {
        const desc = description.toLowerCase();
        const elementText = (element.text || '').toLowerCase();
        const elementDesc = (element.ai_description || '').toLowerCase();
        
        let confidence = 0;
        
        // Exact text match
        if (elementText === desc) confidence += 0.9;
        else if (elementText.includes(desc)) confidence += 0.7;
        
        // AI description match
        if (elementDesc.includes(desc)) confidence += 0.6;
        
        // Role/type match
        if (element.role && desc.includes(element.role)) confidence += 0.5;
        if (element.type && desc.includes(element.type)) confidence += 0.4;
        
        // Interactive elements get bonus
        if (element.interactive) confidence += 0.2;
        
        return Math.min(confidence, 1.0);
    }

    /**
     * Enhanced act method using BROP's capabilities
     */
    async act(instruction, options = {}) {
        const page = this.getPage();
        
        try {
            // First, try to find the element using simplified DOM
            const smartResult = await this.findElementSmart(instruction, options);
            
            if (smartResult && smartResult.confidence > 0.6) {
                console.log(`🎯 Found element for "${instruction}": ${smartResult.selector} (confidence: ${smartResult.confidence.toFixed(2)})`);
                
                // Determine action type based on instruction
                const action = this.parseActionFromInstruction(instruction);
                
                switch (action.type) {
                    case 'click':
                        await smartResult.element.click();
                        break;
                    case 'type':
                        await smartResult.element.fill(action.text || '');
                        break;
                    case 'hover':
                        await smartResult.element.hover();
                        break;
                    default:
                        await smartResult.element.click(); // Default to click
                }
                
                return {
                    success: true,
                    action: action.type,
                    element: smartResult.selector,
                    confidence: smartResult.confidence
                };
            }
            
            // Fallback to standard Playwright automation
            console.log(`⚠️ Using fallback automation for: "${instruction}"`);
            return await this.fallbackAction(instruction, page);
            
        } catch (error) {
            console.error('❌ Action failed:', error.message);
            throw error;
        }
    }

    /**
     * Parse action type from natural language instruction
     */
    parseActionFromInstruction(instruction) {
        const lower = instruction.toLowerCase();
        
        if (lower.includes('click') || lower.includes('tap') || lower.includes('press')) {
            return { type: 'click' };
        }
        
        if (lower.includes('type') || lower.includes('enter') || lower.includes('input')) {
            // Extract text to type
            const match = instruction.match(/["']([^"']+)["']/);
            return { 
                type: 'type', 
                text: match ? match[1] : '' 
            };
        }
        
        if (lower.includes('hover') || lower.includes('move to')) {
            return { type: 'hover' };
        }
        
        return { type: 'click' }; // Default
    }

    /**
     * Fallback action using standard Playwright
     */
    async fallbackAction(instruction, page) {
        // This would integrate with Stagehand's standard AI-powered actions
        // For now, return a basic response
        return {
            success: false,
            reason: 'Fallback action not implemented',
            instruction
        };
    }

    /**
     * Check if BROP extension is available and working
     */
    async checkBROPStatus() {
        const page = this.getPage();
        
        try {
            const status = await page.evaluate(() => {
                return {
                    hasContentScript: typeof window.BROP !== 'undefined',
                    hasDOMSimplifier: typeof window.DOMSimplifier !== 'undefined',
                    pageUrl: window.location.href,
                    pageTitle: document.title
                };
            });

            console.log('🔍 BROP Status:', status);
            return status;

        } catch (error) {
            console.error('❌ Failed to check BROP status:', error.message);
            return { hasContentScript: false, error: error.message };
        }
    }
}

/**
 * Factory function to create BROP provider for Stagehand
 */
function createBROPProvider(options = {}) {
    return new BROPStagehandProvider(options);
}

/**
 * Integration helper for Stagehand
 */
async function createStagehandWithBROP(stagehandOptions = {}, bropOptions = {}) {
    const provider = createBROPProvider(bropOptions);
    await provider.connect();
    
    // Return browser instance for Stagehand
    const { browser, context, page } = await provider.connect();
    
    // Attach provider methods to page for enhanced functionality
    page.getSimplifiedDOM = (options) => provider.getSimplifiedDOM(options);
    page.findElementSmart = (desc, options) => provider.findElementSmart(desc, options);
    page.actSmart = (instruction, options) => provider.act(instruction, options);
    page.checkBROPStatus = () => provider.checkBROPStatus();
    
    return {
        browser,
        context, 
        page,
        provider
    };
}

module.exports = {
    BROPStagehandProvider,
    createBROPProvider,
    createStagehandWithBROP
};