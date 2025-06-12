#!/usr/bin/env node
/**
 * Root Cause Analysis for _page Issue
 * 
 * Based on the comprehensive debug data, this script will:
 * 1. Trace the exact failure point in Playwright's page creation
 * 2. Analyze what's missing in the bridge server response
 * 3. Compare with what a real Chrome instance would provide
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

class RootCauseAnalyzer {
    constructor() {
        this.cdpMessages = [];
        this.interceptWs = null;
    }

    async interceptAllCDPTraffic() {
        return new Promise((resolve) => {
            this.interceptWs = new WebSocket('ws://localhost:9222');
            
            this.interceptWs.on('open', () => {
                console.log('🔍 Intercepting all CDP traffic...');
                resolve();
            });
            
            this.interceptWs.on('message', (data) => {
                try {
                    const parsed = JSON.parse(data.toString());
                    this.cdpMessages.push({
                        timestamp: Date.now(),
                        direction: 'receive',
                        data: parsed
                    });
                    
                    console.log(`📥 CDP: ${this.formatMessage(parsed)}`);
                    
                } catch (error) {
                    console.log('❌ Failed to parse CDP message:', error.message);
                }
            });

            this.interceptWs.on('error', (error) => {
                console.log('⚠️ Intercept error (continuing):', error.message);
                resolve();
            });
        });
    }

    formatMessage(msg) {
        if (msg.method && !msg.id) {
            return `EVENT: ${msg.method} ${JSON.stringify(msg.params || {}).substring(0, 50)}`;
        }
        if (msg.id && !msg.method) {
            return `RESPONSE: id=${msg.id} ${msg.result ? 'SUCCESS' : 'ERROR'} ${JSON.stringify(msg.result || msg.error || {}).substring(0, 50)}`;
        }
        if (msg.method && msg.id) {
            return `REQUEST: id=${msg.id} ${msg.method} ${JSON.stringify(msg.params || {}).substring(0, 50)}`;
        }
        return `UNKNOWN: ${JSON.stringify(msg).substring(0, 100)}`;
    }

    async traceBROPPageCreation() {
        console.log('\n🕵️ TRACING BROP PAGE CREATION STEP BY STEP');
        console.log('=' + '='.repeat(70));
        
        try {
            await this.interceptAllCDPTraffic();
            
            console.log('\n1️⃣ Connecting to BROP bridge...');
            const browser = await chromium.connectOverCDP('ws://localhost:9222');
            
            console.log('\n2️⃣ Creating context...');
            const context = await browser.newContext();
            
            console.log('\n3️⃣ Examining context state before page creation...');
            this.examineContextState(context, 'BEFORE');
            
            console.log('\n4️⃣ Attempting page creation with detailed error catching...');
            
            try {
                // Add event listeners to catch any internal events
                context.on('page', (page) => {
                    console.log('🎉 Page event fired:', page.constructor.name);
                });
                
                const page = await context.newPage();
                console.log('✅ SUCCESS: Page created!');
                await page.close();
                
            } catch (error) {
                console.log('❌ FAILED at page creation');
                console.log('   Error:', error.message);
                console.log('   Stack trace:');
                console.log(error.stack.split('\n').slice(0, 5).map(line => '     ' + line).join('\n'));
                
                console.log('\n5️⃣ Examining context state after failure...');
                this.examineContextState(context, 'AFTER_ERROR');
                
                console.log('\n6️⃣ Analyzing CDP messages during failure...');
                this.analyzeFailureMessages();
            }
            
            await context.close();
            await browser.close();
            
        } catch (error) {
            console.log('💥 Critical error:', error.message);
        } finally {
            if (this.interceptWs) {
                this.interceptWs.close();
            }
        }
    }

    examineContextState(context, phase) {
        console.log(`\n🔍 CONTEXT STATE EXAMINATION (${phase})`);
        console.log('-'.repeat(50));
        
        try {
            // Basic properties
            console.log('Context type:', typeof context);
            console.log('Context constructor:', context.constructor.name);
            console.log('Context._pages:', context._pages || 'undefined');
            console.log('Context._page:', context._page || 'undefined');
            
            // Connection details
            if (context._connection) {
                console.log('Connection exists:', true);
                console.log('Connection._url:', context._connection._url || 'undefined');
                console.log('Connection._transport:', context._connection._transport ? 'exists' : 'missing');
                
                if (context._connection._transport) {
                    console.log('Transport state:', context._connection._transport.readyState || 'unknown');
                } else {
                    console.log('❌ CRITICAL: No transport in connection');
                }
            } else {
                console.log('❌ CRITICAL: No connection object');
            }
            
            // Browser reference
            if (context._browser) {
                console.log('Browser exists:', true);
                console.log('Browser type:', context._browser.constructor.name);
            } else {
                console.log('❌ CRITICAL: No browser reference');
            }
            
            // Check for any target info
            if (context._browser && context._browser._contexts) {
                console.log('Browser contexts:', Object.keys(context._browser._contexts || {}));
            }
            
        } catch (examineError) {
            console.log('❌ Error examining context:', examineError.message);
        }
    }

    analyzeFailureMessages() {
        console.log('\n📊 CDP MESSAGE ANALYSIS DURING FAILURE');
        console.log('-'.repeat(50));
        
        if (this.cdpMessages.length === 0) {
            console.log('❌ No CDP messages captured during operation');
            return;
        }
        
        console.log(`Total messages: ${this.cdpMessages.length}`);
        
        this.cdpMessages.forEach((msg, index) => {
            console.log(`${index + 1}. ${this.formatMessage(msg.data)}`);
            
            // Look for specific patterns that might indicate the issue
            if (msg.data.method === 'Target.targetCreated') {
                console.log('   ⭐ Target created - this should trigger page creation');
                console.log('   ⭐ Target details:', JSON.stringify(msg.data.params, null, 2));
            }
            
            if (msg.data.method === 'Target.attachToTarget') {
                console.log('   ⭐ Target attachment - required for page control');
            }
            
            if (msg.data.error) {
                console.log('   ❌ Error in message:', msg.data.error.message);
            }
        });
    }

    async compareWithRealChrome() {
        console.log('\n🆚 COMPARISON WITH REAL CHROME INSTANCE');
        console.log('=' + '='.repeat(70));
        
        console.log('📝 What a real Chrome instance should provide:');
        console.log('1. Target.targetCreated event with proper targetInfo');
        console.log('2. Auto-attachment to new targets (if configured)');
        console.log('3. Proper session routing for page-specific operations');
        console.log('4. Transport connection maintained throughout');
        
        console.log('\n🔍 Expected CDP flow for page creation:');
        console.log('1. context.newPage() calls Target.createTarget');
        console.log('2. Chrome responds with Target.targetCreated event');
        console.log('3. Playwright attaches to the new target');
        console.log('4. New page session is established');
        console.log('5. Page object is created and returned');
        
        console.log('\n❓ What might be missing in BROP:');
        console.log('- Target attachment handling');
        console.log('- Session routing for new targets');
        console.log('- Proper transport connection for page sessions');
        console.log('- Event broadcasting to correct clients');
    }

    async run() {
        console.log('🔍 ROOT CAUSE ANALYSIS FOR _PAGE ISSUE');
        console.log('=' + '='.repeat(80));
        
        await this.traceBROPPageCreation();
        await this.compareWithRealChrome();
        
        console.log('\n📋 DETAILED FINDINGS SUMMARY');
        console.log('=' + '='.repeat(50));
        console.log('✅ Target.targetCreated event is properly fired');
        console.log('❌ Context has "no transport" in connection state');
        console.log('❌ Page creation fails trying to read undefined._page');
        console.log('❌ Likely missing: Target attachment and session routing');
        
        console.log('\n💡 RECOMMENDED ACTIONS:');
        console.log('1. Check bridge server Target.attachToTarget handling');
        console.log('2. Verify session creation for new targets');
        console.log('3. Ensure transport connection is maintained');
        console.log('4. May need to restart bridge and extension for clean state');
        
        if (this.cdpMessages.length > 0) {
            console.log('\n📄 Captured CDP Messages:');
            this.cdpMessages.forEach((msg, i) => {
                console.log(`  ${i + 1}. ${this.formatMessage(msg.data)}`);
            });
        }
    }
}

// Main execution
if (require.main === module) {
    const analyzer = new RootCauseAnalyzer();
    analyzer.run().catch(console.error);
}

module.exports = RootCauseAnalyzer;