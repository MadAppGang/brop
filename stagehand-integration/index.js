/**
 * BROP Stagehand Integration
 * Main entry point for using BROP with Stagehand
 */

const { BROPStagehandProvider, createBROPProvider, createStagehandWithBROP } = require('./brop-stagehand-provider');
const { StagehandBROPAdapter, createStagehandWithBROPAdapter } = require('./stagehand-brop-adapter');

/**
 * Create a Stagehand instance using BROP as the browser backend
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.cdpUrl - BROP CDP server URL (default: ws://localhost:9222)
 * @param {string} options.bropUrl - BROP native server URL (default: ws://localhost:9223)
 * @param {boolean} options.enableAIActions - Enable AI-powered actions (default: true)
 * @param {boolean} options.enableSmartSelectors - Enable smart element selection (default: true)
 * @param {boolean} options.fallbackToPlaywright - Fallback to standard Playwright (default: true)
 * @param {boolean} options.verbose - Enable verbose logging (default: false)
 * @returns {Promise<Object>} Stagehand instance with BROP integration
 */
async function createStagehand(options = {}) {
    return await createStagehandWithBROPAdapter(options);
}

/**
 * Create a basic BROP provider for manual integration
 * 
 * @param {Object} options - Configuration options
 * @returns {BROPStagehandProvider} BROP provider instance
 */
function createProvider(options = {}) {
    return createBROPProvider(options);
}

/**
 * Check if BROP services are available
 * 
 * @param {Object} options - Connection options
 * @returns {Promise<Object>} Service availability status
 */
async function checkBROPAvailability(options = {}) {
    const { chromium } = require('playwright');
    const cdpUrl = options.cdpUrl || 'ws://localhost:9222';
    
    try {
        // Try to connect to BROP CDP server
        const browser = await chromium.connectOverCDP(cdpUrl);
        const contexts = browser.contexts();
        
        let hasContext = contexts.length > 0;
        let hasPage = false;
        
        if (hasContext) {
            const pages = contexts[0].pages();
            hasPage = pages.length > 0;
        }
        
        await browser.close();
        
        return {
            available: true,
            cdpServer: true,
            hasContext,
            hasPage,
            url: cdpUrl
        };
        
    } catch (error) {
        return {
            available: false,
            cdpServer: false,
            error: error.message,
            url: cdpUrl
        };
    }
}

/**
 * Utility function to start a BROP session for testing
 */
async function startTestSession(options = {}) {
    console.log('🧪 Starting BROP test session...');
    
    // Check availability first
    const availability = await checkBROPAvailability(options);
    if (!availability.available) {
        throw new Error(`BROP not available: ${availability.error}`);
    }
    
    console.log('✅ BROP services are available');
    
    // Create Stagehand instance
    const stagehand = await createStagehand({
        verbose: true,
        ...options
    });
    
    // Check BROP status
    const bropStatus = await stagehand.page.checkBROPStatus();
    console.log('🔍 BROP Extension Status:', bropStatus);
    
    return stagehand;
}

/**
 * Example usage patterns
 */
const examples = {
    // Basic usage
    async basic() {
        const stagehand = await createStagehand({ verbose: true });
        
        // Navigate to a page
        await stagehand.page.goto('https://example.com');
        
        // Use enhanced BROP actions
        await stagehand.page.act('click the search button');
        
        // Get simplified DOM
        const dom = await stagehand.page.getSimplifiedDOM();
        console.log('Interactive elements:', dom.total_interactive_elements);
        
        await stagehand.adapter.close();
    },
    
    // Advanced usage with observation
    async advanced() {
        const stagehand = await createStagehand({ 
            verbose: true,
            enableAIActions: true,
            enableSmartSelectors: true
        });
        
        await stagehand.page.goto('https://github.com');
        
        // Observe the page
        const observation = await stagehand.page.observe('find the search functionality');
        console.log('Observation:', observation.suggestions);
        
        // Act based on observation
        if (observation.suggestions.length > 0) {
            const suggestion = observation.suggestions[0];
            await stagehand.page.act(suggestion.suggested_action + ' ' + suggestion.element);
        }
        
        await stagehand.adapter.close();
    },
    
    // Data extraction example
    async extraction() {
        const stagehand = await createStagehand({ verbose: true });
        
        await stagehand.page.goto('https://news.ycombinator.com');
        
        // Extract data using BROP's simplified DOM
        const articles = await stagehand.page.extract({
            title: 'article title',
            link: 'article link',
            points: 'points'
        });
        
        console.log('Extracted articles:', articles);
        
        await stagehand.adapter.close();
    }
};

module.exports = {
    // Main functions
    createStagehand,
    createProvider,
    checkBROPAvailability,
    startTestSession,
    
    // Classes for advanced usage
    BROPStagehandProvider,
    StagehandBROPAdapter,
    
    // Factory functions
    createStagehandWithBROP,
    createStagehandWithBROPAdapter,
    
    // Examples
    examples
};