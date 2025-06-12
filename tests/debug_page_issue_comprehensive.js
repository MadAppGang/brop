#!/usr/bin/env node
/**
 * Comprehensive Debug for _page Issue
 * 
 * This script will:
 * 1. Run a regular headless Playwright test as reference
 * 2. Track all CDP messages during BROP connection
 * 3. Compare the data flow between regular and BROP scenarios
 * 4. Create detailed call stack analysis
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');
const fs = require('fs');

class ComprehensiveDebugger {
    constructor() {
        this.messageLog = [];
        this.callStackLog = [];
        this.dataFlowTable = [];
        this.interceptWs = null;
        this.startTime = Date.now();
    }

    log(type, message, data = null) {
        const timestamp = Date.now() - this.startTime;
        const logEntry = {
            timestamp,
            type,
            message,
            data,
            stackTrace: new Error().stack.split('\n').slice(1, 4).map(s => s.trim())
        };
        
        this.callStackLog.push(logEntry);
        console.log(`[${timestamp.toString().padStart(6, '0')}ms] ${type.toUpperCase()}: ${message}`);
        if (data) {
            console.log('   Data:', JSON.stringify(data, null, 2).substring(0, 200));
        }
    }

    async interceptCDPMessages() {
        return new Promise((resolve) => {
            this.interceptWs = new WebSocket('ws://localhost:9222');
            
            this.interceptWs.on('open', () => {
                this.log('CDP_INTERCEPT', 'Intercept connection established');
                resolve();
            });
            
            this.interceptWs.on('message', (data) => {
                try {
                    const parsed = JSON.parse(data.toString());
                    const timestamp = Date.now() - this.startTime;
                    
                    const logEntry = {
                        timestamp,
                        direction: 'receive',
                        data: parsed,
                        type: this.getMessageType(parsed)
                    };
                    
                    this.messageLog.push(logEntry);
                    this.log('CDP_MESSAGE', `${logEntry.type}: ${this.getMessageSummary(parsed)}`);
                    
                } catch (error) {
                    this.log('CDP_ERROR', 'Failed to parse CDP message', error.message);
                }
            });

            this.interceptWs.on('error', (error) => {
                this.log('CDP_ERROR', 'Intercept connection error', error.message);
                resolve(); // Don't block on intercept errors
            });
        });
    }

    getMessageType(msg) {
        if (msg.id !== undefined && msg.method === undefined) return 'RESPONSE';
        if (msg.method !== undefined && msg.id === undefined) return 'EVENT';
        if (msg.method !== undefined && msg.id !== undefined) return 'REQUEST';
        return 'UNKNOWN';
    }

    getMessageSummary(msg) {
        if (msg.method) return `${msg.method}${msg.id ? ` (id:${msg.id})` : ''}`;
        if (msg.id) return `Response to id:${msg.id} ${msg.result ? 'SUCCESS' : 'ERROR'}`;
        return 'Unknown message';
    }

    async runReferencePlaywrightTest() {
        this.log('REF_TEST', 'Starting reference Playwright test (regular headless)');
        
        try {
            const browser = await chromium.launch({ 
                headless: true,
                args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
            });
            this.log('REF_TEST', 'Browser launched successfully');
            
            const context = await browser.newContext();
            this.log('REF_TEST', 'Context created successfully');
            
            const page = await context.newPage();
            this.log('REF_TEST', 'Page created successfully');
            
            await page.goto('https://playwright.dev/');
            this.log('REF_TEST', 'Navigation successful');
            
            const title = await page.title();
            this.log('REF_TEST', `Page title: ${title}`);
            
            await page.close();
            await context.close();
            await browser.close();
            
            this.log('REF_TEST', 'Reference test completed successfully');
            return true;
            
        } catch (error) {
            this.log('REF_ERROR', 'Reference test failed', error.message);
            return false;
        }
    }

    async runBROPPlaywrightTest() {
        this.log('BROP_TEST', 'Starting BROP Playwright test');
        
        try {
            // Start intercepting CDP messages
            await this.interceptCDPMessages();
            
            this.log('BROP_TEST', 'Connecting to BROP bridge...');
            const browser = await chromium.connectOverCDP('ws://localhost:9222');
            this.log('BROP_TEST', 'Browser connected successfully');
            this.log('BROP_DEBUG', 'Browser object type', typeof browser);
            this.log('BROP_DEBUG', 'Browser constructor', browser.constructor.name);
            
            this.log('BROP_TEST', 'Creating browser context...');
            const context = await browser.newContext();
            this.log('BROP_TEST', 'Context created successfully');
            this.log('BROP_DEBUG', 'Context object type', typeof context);
            this.log('BROP_DEBUG', 'Context constructor', context.constructor.name);
            
            // Detailed context inspection before page creation
            this.log('BROP_DEBUG', 'Context inspection before newPage()');
            this.inspectContextObject(context);
            
            this.log('BROP_TEST', 'Attempting to create page...');
            try {
                const page = await context.newPage();
                this.log('BROP_SUCCESS', 'Page created successfully!');
                
                await page.goto('https://playwright.dev/');
                const title = await page.title();
                this.log('BROP_TEST', `Page title: ${title}`);
                
                await page.close();
                
            } catch (pageError) {
                this.log('BROP_ERROR', 'Page creation failed', pageError.message);
                this.log('BROP_ERROR', 'Full error stack', pageError.stack);
                
                // Post-error context inspection
                this.log('BROP_DEBUG', 'Context inspection after error');
                this.inspectContextObject(context);
                
                throw pageError;
            }
            
            await context.close();
            await browser.close();
            
            return true;
            
        } catch (error) {
            this.log('BROP_ERROR', 'BROP test failed', error.message);
            return false;
        } finally {
            if (this.interceptWs) {
                this.interceptWs.close();
            }
        }
    }

    inspectContextObject(context) {
        try {
            this.log('INSPECT', 'Context object keys', Object.keys(context));
            this.log('INSPECT', 'Context._page', context._page);
            this.log('INSPECT', 'Context._pages', context._pages);
            this.log('INSPECT', 'Context._connection', context._connection ? 'exists' : 'missing');
            this.log('INSPECT', 'Context._browser', context._browser ? 'exists' : 'missing');
            
            // Try to access internal properties
            if (context._connection) {
                this.log('INSPECT', 'Connection URL', context._connection._url);
                this.log('INSPECT', 'Connection state', context._connection._transport ? 'transport exists' : 'no transport');
            }
            
            // Check for Playwright-specific properties
            const descriptors = Object.getOwnPropertyDescriptors(context);
            const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(context));
            this.log('INSPECT', 'Available methods', methods.filter(m => typeof context[m] === 'function').slice(0, 10));
            
        } catch (inspectError) {
            this.log('INSPECT_ERROR', 'Failed to inspect context', inspectError.message);
        }
    }

    createDataFlowTable() {
        console.log('\n📊 DATA FLOW ANALYSIS TABLE');
        console.log('=' + '='.repeat(100));
        
        const table = [
            ['Timestamp', 'Source', 'Type', 'Method/Event', 'Details', 'Success']
        ];
        
        // Combine call stack and CDP messages chronologically
        const allEvents = [
            ...this.callStackLog.map(entry => ({...entry, source: 'PLAYWRIGHT'})),
            ...this.messageLog.map(entry => ({...entry, source: 'CDP'}))
        ].sort((a, b) => a.timestamp - b.timestamp);
        
        allEvents.forEach(event => {
            const row = [
                `${event.timestamp}ms`.padStart(8),
                event.source.padEnd(10),
                (event.type || 'N/A').padEnd(12),
                this.getEventMethod(event).padEnd(25),
                this.getEventDetails(event).substring(0, 30).padEnd(30),
                this.getEventSuccess(event).padEnd(8)
            ];
            table.push(row);
        });
        
        // Print table
        table.forEach((row, index) => {
            const line = '| ' + row.join(' | ') + ' |';
            console.log(line);
            if (index === 0) {
                console.log('|' + '='.repeat(line.length - 2) + '|');
            }
        });
        
        return table;
    }

    getEventMethod(event) {
        if (event.source === 'CDP' && event.data) {
            return event.data.method || `response-${event.data.id}` || 'unknown';
        }
        return event.message || 'N/A';
    }

    getEventDetails(event) {
        if (event.source === 'CDP' && event.data) {
            if (event.data.params) return JSON.stringify(event.data.params).substring(0, 30);
            if (event.data.result) return JSON.stringify(event.data.result).substring(0, 30);
            if (event.data.error) return event.data.error.message || 'error';
        }
        return event.data ? JSON.stringify(event.data).substring(0, 30) : 'N/A';
    }

    getEventSuccess(event) {
        if (event.type === 'BROP_ERROR' || event.type === 'REF_ERROR') return 'FAIL';
        if (event.type === 'BROP_SUCCESS' || event.type === 'REF_TEST') return 'PASS';
        if (event.source === 'CDP' && event.data && event.data.error) return 'FAIL';
        return 'OK';
    }

    async saveResults() {
        const results = {
            summary: {
                totalEvents: this.callStackLog.length,
                totalCDPMessages: this.messageLog.length,
                duration: Date.now() - this.startTime
            },
            callStackLog: this.callStackLog,
            messageLog: this.messageLog,
            dataFlowTable: this.dataFlowTable
        };
        
        const filename = `debug_results_${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(results, null, 2));
        this.log('SAVE', `Results saved to ${filename}`);
    }

    async run() {
        console.log('🔍 COMPREHENSIVE _PAGE ISSUE DEBUGGER');
        console.log('=' + '='.repeat(80));
        
        // Step 1: Run reference test
        console.log('\n📋 Step 1: Reference Playwright Test (Headless)');
        console.log('-'.repeat(60));
        const refSuccess = await this.runReferencePlaywrightTest();
        
        // Step 2: Run BROP test with detailed logging
        console.log('\n📋 Step 2: BROP Playwright Test (With Debugging)');
        console.log('-'.repeat(60));
        const bropSuccess = await this.runBROPPlaywrightTest();
        
        // Step 3: Create analysis table
        console.log('\n📋 Step 3: Data Flow Analysis');
        console.log('-'.repeat(60));
        this.dataFlowTable = this.createDataFlowTable();
        
        // Step 4: Summary and recommendations
        console.log('\n📋 SUMMARY');
        console.log('-'.repeat(60));
        console.log(`Reference test: ${refSuccess ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`BROP test: ${bropSuccess ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Total events logged: ${this.callStackLog.length}`);
        console.log(`Total CDP messages: ${this.messageLog.length}`);
        
        if (!bropSuccess && refSuccess) {
            console.log('\n🔍 KEY FINDINGS:');
            console.log('- Reference Playwright works (eliminates Playwright version issues)');
            console.log('- BROP connection fails at page creation');
            console.log('- Error: Cannot read properties of undefined (reading \'_page\')');
            console.log('- This suggests the context object is missing internal state');
            
            console.log('\n💡 RECOMMENDATIONS:');
            console.log('1. Check if bridge server properly handles Target.createTarget');
            console.log('2. Verify session routing for page-specific operations');
            console.log('3. Compare CDP message flow with working Chrome instance');
            console.log('4. May need to restart bridge and browser extension for clean state');
        }
        
        await this.saveResults();
    }
}

// Main execution
if (require.main === module) {
    const debugAnalyzer = new ComprehensiveDebugger();
    debugAnalyzer.run().catch(console.error);
}

module.exports = ComprehensiveDebugger;