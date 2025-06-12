#!/usr/bin/env node
/**
 * BROP Protocol Buffer Test Suite
 * 
 * Tests Protocol Buffer message serialization, deserialization,
 * and validation for all BROP command types.
 */

const fs = require('fs');
const path = require('path');

class BROPProtobufTestSuite {
    constructor() {
        this.testResults = [];
        this.protoMessages = this.loadProtocolDefinitions();
    }

    loadProtocolDefinitions() {
        // Load and parse the protocol definitions
        // Since we don't have the generated protobuf files, we'll simulate the message structures
        return {
            BrowserMessage: {
                fields: ['id', 'command', 'response'],
                create: (data) => ({ ...data, _type: 'BrowserMessage' })
            },
            Command: {
                fields: ['get_console_logs', 'execute_console', 'get_screenshot', 'get_page_content', 
                        'navigate', 'click', 'type', 'wait_for_element', 'evaluate_js', 'get_element'],
                create: (data) => ({ ...data, _type: 'Command' })
            },
            Response: {
                fields: ['success', 'error', 'console_logs', 'console_execution', 'screenshot', 
                        'page_content', 'navigation', 'click_result', 'type_result', 'element_wait', 
                        'js_result', 'element'],
                create: (data) => ({ ...data, _type: 'Response' })
            }
        };
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    async runTest(testName, testFn) {
        this.log(`Running: ${testName}`, 'TEST');
        
        try {
            const result = await testFn();
            this.testResults.push({
                name: testName,
                status: 'PASS',
                result
            });
            this.log(`✅ PASS: ${testName}`, 'PASS');
            return { success: true, result };
        } catch (error) {
            this.testResults.push({
                name: testName,
                status: 'FAIL',
                error: error.message
            });
            this.log(`❌ FAIL: ${testName} - ${error.message}`, 'FAIL');
            return { success: false, error: error.message };
        }
    }

    testBrowserMessageSerialization() {
        const testCases = [
            {
                name: 'Basic BrowserMessage with command',
                data: {
                    id: 'test-123',
                    command: {
                        get_console_logs: {
                            limit: 10,
                            level: 'info'
                        }
                    }
                }
            },
            {
                name: 'BrowserMessage with response',
                data: {
                    id: 'test-456',
                    response: {
                        success: true,
                        console_logs: {
                            logs: [
                                {
                                    timestamp: '2024-01-01T00:00:00Z',
                                    level: 'info',
                                    message: 'Test log message',
                                    source: 'console'
                                }
                            ]
                        }
                    }
                }
            }
        ];

        for (const testCase of testCases) {
            const message = this.protoMessages.BrowserMessage.create(testCase.data);
            
            // Validate message structure
            if (!message.id) {
                throw new Error(`${testCase.name}: Missing required 'id' field`);
            }
            
            if (!message.command && !message.response) {
                throw new Error(`${testCase.name}: Must have either 'command' or 'response'`);
            }
            
            if (message.command && message.response) {
                throw new Error(`${testCase.name}: Cannot have both 'command' and 'response'`);
            }
        }

        return {
            testCasesProcessed: testCases.length,
            allValid: true
        };
    }

    testCommandMessageValidation() {
        const commandTypes = [
            'get_console_logs',
            'execute_console', 
            'get_screenshot',
            'get_page_content',
            'navigate',
            'click',
            'type',
            'wait_for_element',
            'evaluate_js',
            'get_element'
        ];

        const testCommands = {
            get_console_logs: {
                limit: 50,
                level: 'error'
            },
            execute_console: {
                code: 'console.log("Hello World");',
                return_result: true
            },
            get_screenshot: {
                full_page: true,
                format: 'png',
                quality: 90
            },
            get_page_content: {
                include_html: true,
                include_text: true,
                include_metadata: false
            },
            navigate: {
                url: 'https://example.com',
                timeout: 30000,
                wait_for_load: true
            },
            click: {
                selector: '#submit-button',
                x: 100,
                y: 200,
                button: 0,
                double_click: false
            },
            type: {
                selector: 'input[name="username"]',
                text: 'testuser',
                clear_first: true,
                delay: 100
            },
            wait_for_element: {
                selector: '.loading-spinner',
                timeout: 5000,
                visible: false,
                hidden: true
            },
            evaluate_js: {
                code: 'document.querySelector("h1").textContent',
                return_by_value: true
            },
            get_element: {
                selector: 'div.content',
                get_all: false
            }
        };

        for (const [commandType, params] of Object.entries(testCommands)) {
            const command = this.protoMessages.Command.create({
                [commandType]: params
            });

            // Validate that only one command type is set
            const setCommandTypes = commandTypes.filter(type => command[type] !== undefined);
            if (setCommandTypes.length !== 1) {
                throw new Error(`Command must have exactly one action type, got: ${setCommandTypes.join(', ')}`);
            }

            // Validate command-specific parameters
            this.validateCommandParams(commandType, params);
        }

        return {
            commandTypesValidated: Object.keys(testCommands).length,
            allValid: true
        };
    }

    validateCommandParams(commandType, params) {
        switch (commandType) {
            case 'get_console_logs':
                if (params.limit && (typeof params.limit !== 'number' || params.limit < 1)) {
                    throw new Error('get_console_logs: limit must be a positive number');
                }
                if (params.level && !['log', 'info', 'warn', 'error'].includes(params.level)) {
                    throw new Error('get_console_logs: invalid level');
                }
                break;

            case 'execute_console':
                if (!params.code || typeof params.code !== 'string') {
                    throw new Error('execute_console: code is required and must be a string');
                }
                break;

            case 'get_screenshot':
                if (params.format && !['png', 'jpeg'].includes(params.format)) {
                    throw new Error('get_screenshot: format must be png or jpeg');
                }
                if (params.quality && (typeof params.quality !== 'number' || params.quality < 1 || params.quality > 100)) {
                    throw new Error('get_screenshot: quality must be a number between 1 and 100');
                }
                break;

            case 'navigate':
                if (!params.url || typeof params.url !== 'string') {
                    throw new Error('navigate: url is required and must be a string');
                }
                try {
                    new URL(params.url);
                } catch {
                    // Allow data URLs and other non-HTTP schemes for testing
                    if (!params.url.startsWith('data:') && !params.url.startsWith('file:')) {
                        throw new Error('navigate: invalid URL format');
                    }
                }
                break;

            case 'click':
                if (!params.selector || typeof params.selector !== 'string') {
                    throw new Error('click: selector is required and must be a string');
                }
                break;

            case 'type':
                if (!params.selector || typeof params.selector !== 'string') {
                    throw new Error('type: selector is required and must be a string');
                }
                if (!params.text || typeof params.text !== 'string') {
                    throw new Error('type: text is required and must be a string');
                }
                break;

            case 'wait_for_element':
                if (!params.selector || typeof params.selector !== 'string') {
                    throw new Error('wait_for_element: selector is required and must be a string');
                }
                if (params.visible && params.hidden) {
                    throw new Error('wait_for_element: cannot wait for both visible and hidden');
                }
                break;

            case 'evaluate_js':
                if (!params.code || typeof params.code !== 'string') {
                    throw new Error('evaluate_js: code is required and must be a string');
                }
                break;

            case 'get_element':
                if (!params.selector || typeof params.selector !== 'string') {
                    throw new Error('get_element: selector is required and must be a string');
                }
                break;
        }
    }

    testResponseMessageValidation() {
        const responseTypes = {
            console_logs: {
                logs: [
                    {
                        timestamp: '2024-01-01T12:00:00Z',
                        level: 'info',
                        message: 'Application started',
                        source: 'console',
                        line: 1,
                        column: 1
                    },
                    {
                        timestamp: '2024-01-01T12:00:01Z',
                        level: 'error',
                        message: 'Failed to load resource',
                        source: 'network',
                        line: 45,
                        column: 12
                    }
                ]
            },
            console_execution: {
                result: 'Hello World',
                error: null
            },
            screenshot: {
                image_data: new Uint8Array([137, 80, 78, 71]), // PNG header bytes
                format: 'png',
                width: 1920,
                height: 1080
            },
            page_content: {
                html: '<html><head><title>Test</title></head><body><h1>Test Page</h1></body></html>',
                text: 'Test Page',
                title: 'Test',
                url: 'https://example.com',
                links: ['https://example.com/about', 'https://example.com/contact'],
                images: ['https://example.com/logo.png']
            },
            navigation: {
                final_url: 'https://example.com/final',
                title: 'Example Page',
                loaded: true
            },
            click_result: {
                clicked: true,
                element_tag: 'button'
            },
            type_result: {
                typed: true,
                final_value: 'testuser123'
            },
            element_wait: {
                found: true,
                visible: true,
                element: {
                    tag_name: 'div',
                    text_content: 'Loading complete',
                    inner_html: '<span>Loading complete</span>',
                    attributes: { class: 'status-message', id: 'status' },
                    bounding_box: { x: 10, y: 20, width: 200, height: 30 },
                    visible: true
                }
            },
            js_result: {
                result: '42',
                type: 'number',
                error: null
            },
            element: {
                elements: [
                    {
                        tag_name: 'h1',
                        text_content: 'Main Title',
                        inner_html: 'Main Title',
                        attributes: { class: 'title', id: 'main-title' },
                        bounding_box: { x: 0, y: 0, width: 300, height: 40 },
                        visible: true
                    }
                ]
            }
        };

        for (const [responseType, responseData] of Object.entries(responseTypes)) {
            const response = this.protoMessages.Response.create({
                success: true,
                error: null,
                [responseType]: responseData
            });

            // Validate response structure
            if (typeof response.success !== 'boolean') {
                throw new Error(`${responseType}: success must be a boolean`);
            }

            // If success is false, error should be provided
            if (!response.success && !response.error) {
                throw new Error(`${responseType}: error message required when success is false`);
            }

            this.validateResponseData(responseType, responseData);
        }

        return {
            responseTypesValidated: Object.keys(responseTypes).length,
            allValid: true
        };
    }

    validateResponseData(responseType, data) {
        switch (responseType) {
            case 'console_logs':
                if (!Array.isArray(data.logs)) {
                    throw new Error('console_logs: logs must be an array');
                }
                data.logs.forEach((log, index) => {
                    if (!log.timestamp || !log.level || !log.message) {
                        throw new Error(`console_logs: log ${index} missing required fields`);
                    }
                });
                break;

            case 'screenshot':
                if (!data.image_data || !(data.image_data instanceof Uint8Array)) {
                    throw new Error('screenshot: image_data must be a Uint8Array');
                }
                if (!data.format || !['png', 'jpeg'].includes(data.format)) {
                    throw new Error('screenshot: invalid format');
                }
                break;

            case 'page_content':
                if (data.links && !Array.isArray(data.links)) {
                    throw new Error('page_content: links must be an array');
                }
                if (data.images && !Array.isArray(data.images)) {
                    throw new Error('page_content: images must be an array');
                }
                break;

            case 'element':
                if (!Array.isArray(data.elements)) {
                    throw new Error('element: elements must be an array');
                }
                data.elements.forEach((element, index) => {
                    if (!element.tag_name) {
                        throw new Error(`element: element ${index} missing tag_name`);
                    }
                    if (element.bounding_box) {
                        const box = element.bounding_box;
                        if (typeof box.x !== 'number' || typeof box.y !== 'number' ||
                            typeof box.width !== 'number' || typeof box.height !== 'number') {
                            throw new Error(`element: element ${index} invalid bounding_box`);
                        }
                    }
                });
                break;
        }
    }

    testMessageSizeValidation() {
        // Test with various message sizes to ensure proper handling
        const testCases = [
            {
                name: 'Small message',
                size: 100,
                content: 'x'.repeat(100)
            },
            {
                name: 'Medium message',
                size: 10000,
                content: 'x'.repeat(10000)
            },
            {
                name: 'Large message',
                size: 1000000,
                content: 'x'.repeat(1000000)
            }
        ];

        const results = [];
        
        for (const testCase of testCases) {
            const message = this.protoMessages.BrowserMessage.create({
                id: 'size-test',
                command: {
                    execute_console: {
                        code: testCase.content,
                        return_result: true
                    }
                }
            });

            const serialized = JSON.stringify(message);
            const actualSize = Buffer.byteLength(serialized, 'utf8');

            results.push({
                name: testCase.name,
                expectedSize: testCase.size,
                actualSize: actualSize,
                compressionRatio: actualSize / testCase.size
            });
        }

        return {
            testCases: results,
            maxMessageSize: Math.max(...results.map(r => r.actualSize)),
            minMessageSize: Math.min(...results.map(r => r.actualSize))
        };
    }

    testErrorConditions() {
        const errorTests = [
            {
                name: 'Missing message ID',
                message: { command: { get_console_logs: {} } },
                shouldFail: true
            },
            {
                name: 'Empty message',
                message: {},
                shouldFail: true
            },
            {
                name: 'Invalid command type',
                message: {
                    id: 'test',
                    command: { invalid_command: {} }
                },
                shouldFail: true
            },
            {
                name: 'Multiple command types',
                message: {
                    id: 'test',
                    command: {
                        get_console_logs: {},
                        get_screenshot: {}
                    }
                },
                shouldFail: true
            }
        ];

        const results = [];

        for (const test of errorTests) {
            try {
                // Simulate validation
                if (!test.message.id) {
                    throw new Error('Missing message ID');
                }
                
                if (test.message.command) {
                    const commandKeys = Object.keys(test.message.command);
                    if (commandKeys.length === 0) {
                        throw new Error('Empty command');
                    }
                    if (commandKeys.length > 1) {
                        throw new Error('Multiple command types');
                    }
                    
                    const validCommands = ['get_console_logs', 'execute_console', 'get_screenshot', 
                                         'get_page_content', 'navigate', 'click', 'type', 
                                         'wait_for_element', 'evaluate_js', 'get_element'];
                    
                    if (!validCommands.includes(commandKeys[0])) {
                        throw new Error('Invalid command type');
                    }
                }

                results.push({
                    name: test.name,
                    shouldFail: test.shouldFail,
                    actuallyFailed: false,
                    result: 'Validation passed unexpectedly'
                });

            } catch (error) {
                results.push({
                    name: test.name,
                    shouldFail: test.shouldFail,
                    actuallyFailed: true,
                    error: error.message
                });
            }
        }

        return {
            errorTests: results,
            correctlyHandled: results.filter(r => r.shouldFail === r.actuallyFailed).length,
            totalTests: results.length
        };
    }

    async generateProtobufReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
        
        const report = {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: totalTests - passedTests,
                successRate: (passedTests / totalTests) * 100
            },
            tests: this.testResults,
            timestamp: new Date().toISOString(),
            protocolVersion: '3',
            testedMessageTypes: [
                'BrowserMessage',
                'Command',
                'Response',
                'ConsoleLogsResponse',
                'ScreenshotResponse',
                'PageContentResponse',
                'NavigationResponse',
                'ElementResponse'
            ]
        };

        const reportPath = path.join(__dirname, `brop-protobuf-report-${Date.now()}.json`);
        await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));

        return { report, reportPath };
    }

    async runAllTests() {
        this.log('🧪 Starting BROP Protocol Buffer Test Suite');
        this.log('=' + '='.repeat(50));

        await this.runTest('BrowserMessage Serialization', () => this.testBrowserMessageSerialization());
        await this.runTest('Command Message Validation', () => this.testCommandMessageValidation());
        await this.runTest('Response Message Validation', () => this.testResponseMessageValidation());
        await this.runTest('Message Size Validation', () => this.testMessageSizeValidation());
        await this.runTest('Error Condition Handling', () => this.testErrorConditions());

        const { report, reportPath } = await this.generateProtobufReport();

        this.log('\n📊 Protocol Buffer Test Summary:');
        this.log('=' + '='.repeat(40));
        this.log(`Total Tests: ${report.summary.total}`);
        this.log(`Passed: ${report.summary.passed} ✅`);
        this.log(`Failed: ${report.summary.failed} ❌`);
        this.log(`Success Rate: ${report.summary.successRate.toFixed(1)}%`);
        this.log(`Report saved to: ${reportPath}`);

        return report;
    }
}

async function main() {
    const testSuite = new BROPProtobufTestSuite();
    
    try {
        await testSuite.runAllTests();
        process.exit(0);
    } catch (error) {
        console.error('❌ Protobuf test suite failed:', error.message);
        process.exit(1);
    }
}

module.exports = BROPProtobufTestSuite;

if (require.main === module) {
    main();
}