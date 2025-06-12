/**
 * Native BROP Implementation of Stagehand Interface
 * 
 * This reimplements Stagehand's core functionality using pure BROP calls,
 * avoiding Playwright dependency issues while providing the same API.
 */

const WebSocket = require('ws');

class BROPStagehand {
    constructor(options = {}) {
        this.options = {
            bropUrl: options.bropUrl || 'ws://localhost:9223',
            cdpUrl: options.cdpUrl || 'ws://localhost:9222',
            apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
            model: options.model || 'claude-3-sonnet-20240229',
            verbose: options.verbose || false,
            ...options
        };
        
        this.ws = null;
        this.messageId = 0;
        this.pendingRequests = new Map();
        this.isConnected = false;
        this.currentPage = {
            url: 'about:blank',
            title: ''
        };
        
        // Screenshots storage
        this.screenshots = new Map();
        this.consoleLogs = [];
    }

    /**
     * Initialize BROP Stagehand
     */
    async init() {
        this.log('🚀 Initializing BROP Stagehand...');
        
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.options.bropUrl);
            
            this.ws.on('open', () => {
                this.isConnected = true;
                this.log('✅ Connected to BROP bridge');
                resolve(this);
            });
            
            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });
            
            this.ws.on('error', (error) => {
                this.log(`❌ BROP connection error: ${error.message}`);
                reject(error);
            });
            
            this.ws.on('close', () => {
                this.isConnected = false;
                this.log('🔌 BROP connection closed');
            });
        });
    }

    /**
     * Navigate to a URL (stagehand_navigate equivalent)
     */
    async navigate(url) {
        this.log(`🌐 Navigating to: ${url}`);
        
        const response = await this.sendBROPCommand({
            type: 'navigate',
            url: url
        });
        
        if (response.success) {
            this.currentPage.url = url;
            // Get page title after navigation
            const pageContent = await this.sendBROPCommand({
                type: 'get_page_content',
                include_html: false,
                include_text: false,
                include_metadata: true
            });
            
            if (pageContent.success) {
                this.currentPage.title = pageContent.result.title || '';
            }
            
            this.log(`✅ Navigation successful: ${this.currentPage.title}`);
            return { success: true, url: url };
        } else {
            throw new Error(`Navigation failed: ${response.error}`);
        }
    }

    /**
     * Perform an action on the web page (stagehand_act equivalent)
     */
    async act(actionDescription, variables = {}) {
        this.log(`🎭 Performing action: ${actionDescription}`);
        
        try {
            // First, get simplified DOM for context
            const domResponse = await this.sendBROPCommand({
                type: 'get_simplified_dom',
                max_depth: 4,
                include_coordinates: true,
                include_text_nodes: true
            });
            
            if (!domResponse.success) {
                throw new Error(`Failed to get DOM context: ${domResponse.error}`);
            }
            
            // Use AI to understand the action and find the right element
            const aiAnalysis = await this.analyzeActionWithAI(
                actionDescription,
                domResponse.result,
                variables
            );
            
            if (!aiAnalysis.success) {
                throw new Error(`AI analysis failed: ${aiAnalysis.error}`);
            }
            
            // Execute the action based on AI analysis
            const actionResult = await this.executeAction(aiAnalysis.action);
            
            this.log(`✅ Action completed: ${actionDescription}`);
            return {
                success: true,
                action: actionDescription,
                result: actionResult,
                element: aiAnalysis.element
            };
            
        } catch (error) {
            this.log(`❌ Action failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract data from the web page (stagehand_extract equivalent)
     */
    async extract(instruction, schema) {
        this.log(`📊 Extracting data: ${instruction}`);
        
        try {
            // Get page content and simplified DOM
            const [pageContent, simplifiedDOM] = await Promise.all([
                this.sendBROPCommand({
                    type: 'get_page_content',
                    include_html: true,
                    include_text: true,
                    include_metadata: true
                }),
                this.sendBROPCommand({
                    type: 'get_simplified_dom',
                    max_depth: 5,
                    include_text_nodes: true
                })
            ]);
            
            if (!pageContent.success || !simplifiedDOM.success) {
                throw new Error('Failed to get page data for extraction');
            }
            
            // Use AI to extract data according to schema
            const extractedData = await this.extractDataWithAI(
                instruction,
                schema,
                pageContent.result,
                simplifiedDOM.result
            );
            
            this.log(`✅ Data extraction completed`);
            return {
                success: true,
                instruction: instruction,
                data: extractedData,
                schema: schema
            };
            
        } catch (error) {
            this.log(`❌ Data extraction failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Observe actionable elements on the page (stagehand_observe equivalent)
     */
    async observe(instruction = "Find all interactive elements") {
        this.log(`👁️ Observing page: ${instruction}`);
        
        try {
            // Get comprehensive page analysis
            const simplifiedDOM = await this.sendBROPCommand({
                type: 'get_simplified_dom',
                max_depth: 4,
                include_coordinates: true,
                include_text_nodes: true,
                include_hidden: false
            });
            
            if (!simplifiedDOM.success) {
                throw new Error(`Failed to get DOM for observation: ${simplifiedDOM.error}`);
            }
            
            // Use AI to analyze and identify actionable elements
            const observations = await this.analyzePageWithAI(
                instruction,
                simplifiedDOM.result
            );
            
            this.log(`✅ Page observation completed: ${observations.length} elements found`);
            return observations;
            
        } catch (error) {
            this.log(`❌ Page observation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Take a screenshot and store it
     */
    async screenshot(name = `screenshot_${Date.now()}`) {
        this.log(`📸 Taking screenshot: ${name}`);
        
        const response = await this.sendBROPCommand({
            type: 'get_screenshot',
            format: 'png',
            full_page: false
        });
        
        if (response.success) {
            // Store screenshot in memory (in real implementation, might save to disk)
            this.screenshots.set(name, response.result.image_data);
            this.log(`✅ Screenshot saved: ${name}`);
            return {
                success: true,
                name: name,
                data: response.result.image_data
            };
        } else {
            throw new Error(`Screenshot failed: ${response.error}`);
        }
    }

    /**
     * Get console logs
     */
    async getConsoleLogs() {
        const response = await this.sendBROPCommand({
            type: 'get_console_logs'
        });
        
        if (response.success) {
            this.consoleLogs = response.result.logs || [];
            return this.consoleLogs;
        } else {
            throw new Error(`Failed to get console logs: ${response.error}`);
        }
    }

    /**
     * Get current page information
     */
    getCurrentPage() {
        return {
            url: this.currentPage.url,
            title: this.currentPage.title
        };
    }

    /**
     * Close the connection
     */
    async close() {
        if (this.ws) {
            this.ws.close();
            this.isConnected = false;
            this.log('🔚 BROP Stagehand closed');
        }
    }

    // ===============================
    // Internal Helper Methods
    // ===============================

    async sendBROPCommand(command) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('Not connected to BROP'));
                return;
            }
            
            const id = `brop_${++this.messageId}`;
            const message = {
                id: id,
                command: command
            };
            
            // Store pending request
            this.pendingRequests.set(id, { resolve, reject });
            
            // Send message
            this.ws.send(JSON.stringify(message));
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('BROP command timeout'));
                }
            }, 30000);
        });
    }

    handleMessage(data) {
        try {
            const response = JSON.parse(data.toString());
            
            if (this.pendingRequests.has(response.id)) {
                const { resolve } = this.pendingRequests.get(response.id);
                this.pendingRequests.delete(response.id);
                resolve(response);
            }
        } catch (error) {
            this.log(`Error parsing BROP response: ${error.message}`);
        }
    }

    async analyzeActionWithAI(actionDescription, domData, variables) {
        if (!this.options.apiKey) {
            throw new Error('AI analysis requires API key');
        }
        
        try {
            const Anthropic = require('@anthropic-ai/sdk');
            const anthropic = new Anthropic({
                apiKey: this.options.apiKey,
            });
            
            const prompt = `Analyze this action request and identify the target element:

Action: "${actionDescription}"
Variables: ${JSON.stringify(variables)}

Page Context:
- Title: ${domData.page_title || 'Unknown'}
- Structure: ${domData.page_structure_summary || 'Unknown'}
- Interactive elements: ${domData.total_interactive_elements || 0}
- Suggested selectors: ${(domData.suggested_selectors || []).join(', ')}

DOM Tree: ${JSON.stringify(domData.simplified_tree, null, 2)}

Return ONLY a valid JSON response with this exact format:
{
  "success": true,
  "action": {
    "type": "click|type|wait|scroll",
    "selector": "CSS selector or XPath",
    "value": "text to type (if applicable)",
    "element_description": "description of target element"
  },
  "element": {
    "text": "element text",
    "role": "element role",
    "coordinates": [x, y]
  }
}`;

            const response = await anthropic.messages.create({
                model: this.options.model,
                max_tokens: 500,
                messages: [{
                    role: "user",
                    content: prompt
                }]
            });
            
            // Clean AI response - remove markdown formatting and any explanatory text
            let responseText = response.content[0].text.trim();
            responseText = this.cleanAIResponse(responseText);
            
            const aiResponse = JSON.parse(responseText);
            return aiResponse;
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async extractDataWithAI(instruction, schema, pageContent, domData) {
        if (!this.options.apiKey) {
            throw new Error('AI extraction requires API key');
        }
        
        try {
            const Anthropic = require('@anthropic-ai/sdk');
            const anthropic = new Anthropic({
                apiKey: this.options.apiKey,
            });
            
            const prompt = `Extract data from this web page according to the instruction and schema:

Instruction: ${instruction}
Schema: ${JSON.stringify(schema, null, 2)}

Page Data:
- Title: ${pageContent.title || 'Unknown'}
- URL: ${pageContent.url || 'Unknown'}
- Text Content: ${(pageContent.text || '').substring(0, 2000)}...
- DOM Structure: ${domData.page_structure_summary || 'Unknown'}

Return ONLY valid JSON data that conforms to the provided schema.`;

            const response = await anthropic.messages.create({
                model: this.options.model,
                max_tokens: 1000,
                messages: [{
                    role: "user",
                    content: prompt
                }]
            });
            
            // Clean AI response - remove markdown formatting and any explanatory text
            let responseText = response.content[0].text.trim();
            responseText = this.cleanAIResponse(responseText);
            
            return JSON.parse(responseText);
            
        } catch (error) {
            throw new Error(`AI extraction failed: ${error.message}`);
        }
    }

    async analyzePageWithAI(instruction, domData) {
        if (!this.options.apiKey) {
            throw new Error('AI observation requires API key');
        }
        
        try {
            const Anthropic = require('@anthropic-ai/sdk');
            const anthropic = new Anthropic({
                apiKey: this.options.apiKey,
            });
            
            const prompt = `Analyze this web page and identify actionable elements:

Instruction: ${instruction}

Page Context:
- Title: ${domData.page_title || 'Unknown'}
- Structure: ${domData.page_structure_summary || 'Unknown'}
- Interactive elements: ${domData.total_interactive_elements || 0}
- Suggested selectors: ${(domData.suggested_selectors || []).join(', ')}

DOM Tree: ${JSON.stringify(domData.simplified_tree, null, 2)}

Return ONLY a valid JSON array of actionable elements in this format:
[
  {
    "description": "element description",
    "action_type": "click|type|select",
    "selector": "CSS selector",
    "text": "visible text",
    "role": "button|link|input|etc",
    "coordinates": [x, y]
  }
]`;

            const response = await anthropic.messages.create({
                model: this.options.model,
                max_tokens: 1000,
                messages: [{
                    role: "user",
                    content: prompt
                }]
            });
            
            // Clean AI response - remove markdown formatting and any explanatory text
            let responseText = response.content[0].text.trim();
            responseText = this.cleanAIResponse(responseText);
            
            return JSON.parse(responseText);
            
        } catch (error) {
            this.log(`AI observation error: ${error.message}`);
            return [];
        }
    }

    async executeAction(action) {
        // For now, return a simulation - in full implementation, 
        // this would trigger actual browser actions through BROP
        this.log(`🎯 Executing action: ${action.type} on ${action.selector}`);
        
        // Simulate action execution
        return {
            executed: true,
            action_type: action.type,
            selector: action.selector,
            element_description: action.element_description
        };
    }

    /**
     * Clean AI response to extract valid JSON
     */
    cleanAIResponse(responseText) {
        // Remove markdown code blocks
        if (responseText.startsWith('```json')) {
            responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (responseText.startsWith('```')) {
            responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Find the first JSON array or object
        const jsonArrayMatch = responseText.match(/\[[\s\S]*\]/);
        const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (jsonArrayMatch) {
            return jsonArrayMatch[0];
        } else if (jsonObjectMatch) {
            return jsonObjectMatch[0];
        }
        
        // If no JSON found, try to extract everything between first { or [ and last } or ]
        let startIdx = Math.min(
            responseText.indexOf('[') !== -1 ? responseText.indexOf('[') : Infinity,
            responseText.indexOf('{') !== -1 ? responseText.indexOf('{') : Infinity
        );
        
        if (startIdx === Infinity) {
            throw new Error('No JSON found in AI response');
        }
        
        let endIdx = Math.max(
            responseText.lastIndexOf(']'),
            responseText.lastIndexOf('}')
        );
        
        if (endIdx === -1 || endIdx <= startIdx) {
            throw new Error('Malformed JSON in AI response');
        }
        
        return responseText.substring(startIdx, endIdx + 1);
    }

    log(message) {
        if (this.options.verbose) {
            console.log(`[BROP-Stagehand] ${message}`);
        }
    }
}

module.exports = { BROPStagehand };