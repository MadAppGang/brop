/**
 * Stagehand BROP Adapter
 * 
 * Provides a native Stagehand integration that uses BROP as the browser backend.
 * This adapter makes BROP appear as a native Stagehand browser provider.
 */

const { createBROPProvider } = require('./brop-stagehand-provider');

class StagehandBROPAdapter {
    constructor(options = {}) {
        this.bropProvider = null;
        this.options = {
            // BROP connection options
            cdpUrl: options.cdpUrl || 'ws://localhost:9222',
            bropUrl: options.bropUrl || 'ws://localhost:9223',
            
            // Stagehand compatibility options
            enableAIActions: options.enableAIActions !== false,
            enableSmartSelectors: options.enableSmartSelectors !== false,
            fallbackToPlaywright: options.fallbackToPlaywright !== false,
            
            // Logging options
            verbose: options.verbose || false,
            
            ...options
        };
    }

    /**
     * Initialize the BROP adapter for Stagehand
     */
    async init() {
        this.log('🚀 Initializing Stagehand BROP Adapter...');
        
        this.bropProvider = createBROPProvider(this.options);
        const connection = await this.bropProvider.connect();
        
        // Check BROP status
        const status = await this.bropProvider.checkBROPStatus();
        if (!status.hasContentScript) {
            console.warn('⚠️ BROP content script not detected. Some features may not work.');
        }
        
        this.log('✅ BROP Adapter initialized successfully');
        return connection;
    }

    /**
     * Create a Stagehand-compatible browser instance
     */
    async getBrowser() {
        if (!this.bropProvider) {
            await this.init();
        }
        
        const browser = this.bropProvider.getBrowser();
        
        // Enhance browser with BROP-specific methods
        browser.getBROPProvider = () => this.bropProvider;
        browser.getSimplifiedDOM = async (options) => {
            const page = this.bropProvider.getPage();
            return this.bropProvider.getSimplifiedDOM(options);
        };
        
        return browser;
    }

    /**
     * Create a Stagehand-compatible context
     */
    async getContext() {
        if (!this.bropProvider) {
            await this.init();
        }
        
        const context = this.bropProvider.getContext();
        
        // Enhance context with BROP-specific methods
        context.getBROPProvider = () => this.bropProvider;
        
        return context;
    }

    /**
     * Create an enhanced Stagehand page with BROP capabilities
     */
    async getPage() {
        if (!this.bropProvider) {
            await this.init();
        }
        
        const page = this.bropProvider.getPage();
        
        // Enhance page with BROP-specific methods
        return this.enhancePage(page);
    }

    /**
     * Enhance a Playwright page with BROP capabilities
     */
    enhancePage(page) {
        // Store original methods
        const originalAct = page.act?.bind(page);
        const originalObserve = page.observe?.bind(page);
        const originalExtract = page.extract?.bind(page);

        // Enhanced act method using BROP's simplified DOM
        page.act = async (instruction, options = {}) => {
            this.log(`🎭 Acting: "${instruction}"`);
            
            try {
                // Use BROP's smart action if enabled
                if (this.options.enableAIActions) {
                    const result = await this.bropProvider.act(instruction, options);
                    if (result.success) {
                        this.log(`✅ BROP action successful: ${result.action} on ${result.element}`);
                        return result;
                    }
                }
                
                // Fallback to original Stagehand act method
                if (originalAct && this.options.fallbackToPlaywright) {
                    this.log('⚠️ Falling back to original Stagehand act method');
                    return await originalAct(instruction, options);
                }
                
                throw new Error('Action failed and no fallback available');
                
            } catch (error) {
                this.log(`❌ Act failed: ${error.message}`);
                throw error;
            }
        };

        // Enhanced observe method using BROP's simplified DOM
        page.observe = async (instruction, options = {}) => {
            this.log(`👁️ Observing: "${instruction}"`);
            
            try {
                // Get simplified DOM for better observation
                const simplifiedDOM = await this.bropProvider.getSimplifiedDOM(options);
                
                // Find relevant elements
                const relevantElements = this.findRelevantElements(simplifiedDOM, instruction);
                
                const observation = {
                    instruction,
                    simplified_dom: simplifiedDOM,
                    relevant_elements: relevantElements,
                    suggestions: this.generateActionSuggestions(relevantElements, instruction),
                    page_summary: simplifiedDOM.page_structure_summary
                };
                
                // Fallback to original observe if available
                if (originalObserve && this.options.fallbackToPlaywright) {
                    try {
                        const originalResult = await originalObserve(instruction, options);
                        observation.stagehand_result = originalResult;
                    } catch (e) {
                        this.log('⚠️ Original observe method failed, using BROP only');
                    }
                }
                
                return observation;
                
            } catch (error) {
                this.log(`❌ Observe failed: ${error.message}`);
                throw error;
            }
        };

        // Enhanced extract method using BROP's simplified DOM
        page.extract = async (schema, options = {}) => {
            this.log(`🔍 Extracting data with schema`);
            
            try {
                // Get simplified DOM for extraction
                const simplifiedDOM = await this.bropProvider.getSimplifiedDOM(options);
                
                // Extract data using simplified DOM
                const extractedData = this.extractFromSimplifiedDOM(simplifiedDOM, schema);
                
                // Fallback to original extract if available
                if (originalExtract && this.options.fallbackToPlaywright) {
                    try {
                        const originalResult = await originalExtract(schema, options);
                        return {
                            brop_extracted: extractedData,
                            stagehand_extracted: originalResult
                        };
                    } catch (e) {
                        this.log('⚠️ Original extract method failed, using BROP only');
                    }
                }
                
                return extractedData;
                
            } catch (error) {
                this.log(`❌ Extract failed: ${error.message}`);
                throw error;
            }
        };

        // Add BROP-specific methods
        page.getSimplifiedDOM = (options) => this.bropProvider.getSimplifiedDOM(options);
        page.findElementSmart = (desc, options) => this.bropProvider.findElementSmart(desc, options);
        page.checkBROPStatus = () => this.bropProvider.checkBROPStatus();
        page.getBROPProvider = () => this.bropProvider;

        return page;
    }

    /**
     * Find relevant elements in simplified DOM based on instruction
     */
    findRelevantElements(simplifiedDOM, instruction) {
        const relevant = [];
        const searchTerms = instruction.toLowerCase().split(' ');
        
        const searchNode = (node, depth = 0) => {
            if (!node || depth > 5) return;
            
            const nodeText = (node.text || '').toLowerCase();
            const nodeDesc = (node.ai_description || '').toLowerCase();
            
            // Check if node is relevant to instruction
            const relevance = searchTerms.some(term => 
                nodeText.includes(term) || 
                nodeDesc.includes(term) ||
                (node.role && node.role.includes(term))
            );
            
            if (relevance && node.interactive) {
                relevant.push({
                    selector: node.selector,
                    description: node.ai_description,
                    role: node.role,
                    text: node.text,
                    relevance_score: this.calculateRelevanceScore(node, searchTerms)
                });
            }
            
            // Search children
            for (const child of node.children || []) {
                searchNode(child, depth + 1);
            }
        };
        
        searchNode(simplifiedDOM.root);
        
        // Sort by relevance score
        return relevant.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, 5);
    }

    /**
     * Calculate relevance score for an element
     */
    calculateRelevanceScore(node, searchTerms) {
        let score = 0;
        const nodeText = (node.text || '').toLowerCase();
        const nodeDesc = (node.ai_description || '').toLowerCase();
        
        searchTerms.forEach(term => {
            if (nodeText.includes(term)) score += 2;
            if (nodeDesc.includes(term)) score += 1;
            if (node.role && node.role.includes(term)) score += 1;
        });
        
        // Boost interactive elements
        if (node.interactive) score += 1;
        
        // Boost visible and enabled elements
        if (node.visible) score += 0.5;
        if (node.enabled) score += 0.5;
        
        return score;
    }

    /**
     * Generate action suggestions based on relevant elements
     */
    generateActionSuggestions(relevantElements, instruction) {
        return relevantElements.map(element => {
            const action = this.suggestActionForElement(element, instruction);
            return {
                element: element.selector,
                suggested_action: action,
                description: element.description,
                confidence: element.relevance_score / 10 // Normalize to 0-1
            };
        });
    }

    /**
     * Suggest an action for an element based on instruction
     */
    suggestActionForElement(element, instruction) {
        const lower = instruction.toLowerCase();
        
        if (element.role === 'button' || element.role === 'link') {
            return 'click';
        }
        
        if (element.role === 'textbox') {
            if (lower.includes('type') || lower.includes('enter') || lower.includes('input')) {
                return 'type';
            }
            return 'focus';
        }
        
        if (element.role === 'checkbox' || element.role === 'radio') {
            return 'check';
        }
        
        if (element.role === 'combobox' || element.role === 'listbox') {
            return 'select';
        }
        
        return 'click'; // Default action
    }

    /**
     * Extract data from simplified DOM using schema
     */
    extractFromSimplifiedDOM(simplifiedDOM, schema) {
        const extracted = {};
        
        // Simple extraction based on schema properties
        Object.keys(schema).forEach(key => {
            const schemaItem = schema[key];
            extracted[key] = this.extractSchemaItem(simplifiedDOM, schemaItem);
        });
        
        return extracted;
    }

    /**
     * Extract a single schema item from simplified DOM
     */
    extractSchemaItem(simplifiedDOM, schemaItem) {
        // This is a simplified implementation
        // In a full implementation, this would support complex schema patterns
        
        if (typeof schemaItem === 'string') {
            // Simple text extraction
            return this.extractTextByPattern(simplifiedDOM, schemaItem);
        }
        
        if (schemaItem.selector) {
            // Extract by selector
            return this.extractBySelector(simplifiedDOM, schemaItem.selector);
        }
        
        return null;
    }

    /**
     * Extract text by pattern from simplified DOM
     */
    extractTextByPattern(simplifiedDOM, pattern) {
        const searchNode = (node) => {
            if (!node) return null;
            
            const nodeText = node.text || '';
            if (nodeText.toLowerCase().includes(pattern.toLowerCase())) {
                return nodeText;
            }
            
            for (const child of node.children || []) {
                const result = searchNode(child);
                if (result) return result;
            }
            
            return null;
        };
        
        return searchNode(simplifiedDOM.root);
    }

    /**
     * Extract by selector from simplified DOM
     */
    extractBySelector(simplifiedDOM, selector) {
        const searchNode = (node) => {
            if (!node) return null;
            
            if (node.selector === selector) {
                return {
                    text: node.text,
                    value: node.value,
                    href: node.href,
                    type: node.type
                };
            }
            
            for (const child of node.children || []) {
                const result = searchNode(child);
                if (result) return result;
            }
            
            return null;
        };
        
        return searchNode(simplifiedDOM.root);
    }

    /**
     * Cleanup resources
     */
    async close() {
        if (this.bropProvider) {
            await this.bropProvider.disconnect();
        }
    }

    /**
     * Log message if verbose mode is enabled
     */
    log(message) {
        if (this.options.verbose) {
            console.log(`[BROP-Stagehand] ${message}`);
        }
    }
}

/**
 * Factory function to create Stagehand with BROP adapter
 */
async function createStagehandWithBROPAdapter(options = {}) {
    const adapter = new StagehandBROPAdapter(options);
    const connection = await adapter.init();
    
    // Return Stagehand-compatible interface
    return {
        browser: connection.browser,
        context: connection.context,
        page: adapter.enhancePage(connection.page),
        adapter: adapter
    };
}

module.exports = {
    StagehandBROPAdapter,
    createStagehandWithBROPAdapter
};