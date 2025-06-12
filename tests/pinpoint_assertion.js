#!/usr/bin/env node
/**
 * Pinpoint the exact assertion that's failing
 * 
 * This test intercepts all CDP messages at the exact moment of failure
 * and analyzes each field to identify which assertion is failing.
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

// Intercept and analyze every message right before the assertion failure
async function interceptAssertionFailure() {
    console.log('🎯 Pinpointing Assertion Failure');
    console.log('=' + '='.repeat(60));
    
    let messageCount = 0;
    const allMessages = [];
    
    // Start message interception
    const interceptPromise = new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9222');
        
        ws.on('open', () => {
            console.log('📡 Intercept WebSocket connected');
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                messageCount++;
                
                console.log(`\n📥 Message ${messageCount}: ${parsed.method || `Response ID ${parsed.id}`}`);
                
                // Deep analysis of each message
                if (parsed.method) {
                    // This is an event
                    console.log(`   Type: EVENT`);
                    console.log(`   Method: "${parsed.method}"`);
                    console.log(`   Has id: ${parsed.id !== undefined} (${typeof parsed.id})`);
                    console.log(`   Has params: ${parsed.params !== undefined}`);
                    
                    if (parsed.method === 'Target.attachedToTarget') {
                        console.log(`   🎯 TARGET ATTACHED EVENT ANALYSIS:`);
                        console.log(`      sessionId: ${parsed.params?.sessionId} (${typeof parsed.params?.sessionId})`);
                        console.log(`      waitingForDebugger: ${parsed.params?.waitingForDebugger} (${typeof parsed.params?.waitingForDebugger})`);
                        console.log(`      targetInfo present: ${!!parsed.params?.targetInfo}`);
                        
                        if (parsed.params?.targetInfo) {
                            console.log(`      targetInfo.targetId: ${parsed.params.targetInfo.targetId}`);
                            console.log(`      targetInfo.type: ${parsed.params.targetInfo.type}`);
                            console.log(`      targetInfo.attached: ${parsed.params.targetInfo.attached}`);
                        }
                        
                        // Check for potential assertion issues
                        if (parsed.params?.waitingForDebugger === true) {
                            console.log(`      ❌ POTENTIAL ISSUE: waitingForDebugger is true`);
                        }
                        if (typeof parsed.params?.sessionId !== 'string') {
                            console.log(`      ❌ POTENTIAL ISSUE: sessionId is not a string`);
                        }
                        if (!parsed.params?.targetInfo) {
                            console.log(`      ❌ POTENTIAL ISSUE: missing targetInfo`);
                        }
                    }
                } else {
                    // This is a response
                    console.log(`   Type: RESPONSE`);
                    console.log(`   ID: ${parsed.id} (${typeof parsed.id})`);
                    console.log(`   Has result: ${parsed.result !== undefined}`);
                    console.log(`   Has error: ${parsed.error !== undefined}`);
                    
                    // Check response structure
                    if (typeof parsed.id !== 'number') {
                        console.log(`   ❌ POTENTIAL ISSUE: ID is not a number`);
                    }
                    if (!parsed.result && !parsed.error) {
                        console.log(`   ❌ POTENTIAL ISSUE: Missing both result and error`);
                    }
                }
                
                // Store for later analysis
                allMessages.push({
                    timestamp: Date.now(),
                    messageNumber: messageCount,
                    data: parsed
                });
                
            } catch (error) {
                console.log(`❌ Parse error on message ${messageCount}:`, error.message);
                console.log(`Raw data: ${data.toString()}`);
            }
        });
        
        ws.on('close', () => {
            console.log('\n📡 Intercept connection closed');
            resolve(allMessages);
        });
        
        ws.on('error', (error) => {
            console.log('\n❌ Intercept error:', error.message);
            resolve(allMessages);
        });
    });
    
    // Start Playwright test that will fail
    setTimeout(async () => {
        try {
            console.log('\n🎭 Starting Playwright test (will fail)...');
            const browser = await chromium.connectOverCDP('ws://localhost:9222');
            console.log('✅ Browser connected');
            
            const context = await browser.newContext();
            console.log('✅ Context created');
            
            // This should trigger the assertion error
            console.log('🎯 Creating page (assertion expected here)...');
            const page = await context.newPage();
            console.log('✅ Page created (unexpected success!)');
            
        } catch (error) {
            console.log('\n💥 ASSERTION ERROR CAUGHT!');
            console.log(`Error: ${error.message}`);
            
            // Give a moment for all messages to be captured
            setTimeout(() => {
                if (interceptPromise) {
                    // Force close intercept connection
                    // This will resolve the promise and let us analyze
                }
            }, 1000);
        }
    }, 1000);
    
    return interceptPromise;
}

function analyzeAssertionCause(messages) {
    console.log('\n🔍 ASSERTION FAILURE ANALYSIS');
    console.log('=' + '='.repeat(60));
    
    console.log(`📊 Total messages captured: ${messages.length}`);
    
    // Find the last few messages before failure
    const lastMessages = messages.slice(-5);
    
    console.log('\n📋 Last 5 messages before assertion:');
    lastMessages.forEach((msg, index) => {
        const data = msg.data;
        const type = data.method ? 'EVENT' : 'RESPONSE';
        const identifier = data.method || `id:${data.id}`;
        console.log(`${index + 1}. ${type} - ${identifier}`);
    });
    
    // Look for specific patterns that could cause assertions
    console.log('\n🔍 Potential assertion triggers:');
    
    const targetAttachedEvents = messages.filter(m => m.data.method === 'Target.attachedToTarget');
    console.log(`\n📡 Found ${targetAttachedEvents.length} Target.attachedToTarget events:`);
    
    targetAttachedEvents.forEach((msg, index) => {
        const params = msg.data.params;
        console.log(`\nEvent ${index + 1}:`);
        console.log(`   sessionId: "${params?.sessionId}" (${typeof params?.sessionId})`);
        console.log(`   waitingForDebugger: ${params?.waitingForDebugger} (${typeof params?.waitingForDebugger})`);
        console.log(`   targetInfo.targetId: "${params?.targetInfo?.targetId}"`);
        console.log(`   targetInfo.attached: ${params?.targetInfo?.attached}`);
        
        // Check for common assertion failures
        if (params?.waitingForDebugger === true) {
            console.log(`   🚨 ASSERTION TRIGGER: waitingForDebugger === true`);
        }
        if (typeof params?.sessionId !== 'string' || !params?.sessionId) {
            console.log(`   🚨 ASSERTION TRIGGER: invalid sessionId`);
        }
        if (!params?.targetInfo) {
            console.log(`   🚨 ASSERTION TRIGGER: missing targetInfo`);
        }
    });
    
    // Check for malformed responses
    const responses = messages.filter(m => m.data.id !== undefined);
    console.log(`\n📥 Found ${responses.length} responses:`);
    
    responses.forEach((msg, index) => {
        const data = msg.data;
        if (typeof data.id !== 'number') {
            console.log(`   🚨 Response ${index + 1}: ID is not a number (${typeof data.id})`);
        }
        if (!data.result && !data.error) {
            console.log(`   🚨 Response ${index + 1}: Missing result and error`);
        }
    });
    
    console.log('\n💡 Most likely assertion failure:');
    console.log('Based on Playwright CDP implementation, the assertion at crConnection.js:134');
    console.log('is most likely checking one of these conditions:');
    console.log('1. Event has proper sessionId (string, non-empty)');
    console.log('2. waitingForDebugger field matches expected value');
    console.log('3. Message routing or session context validation');
    console.log('4. Event ordering or timing constraints');
}

async function main() {
    console.log('🎯 Assertion Failure Pinpoint Test');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Identify the exact assertion that fails in crConnection.js:134');
    console.log('');
    
    try {
        const messages = await interceptAssertionFailure();
        analyzeAssertionCause(messages);
        
        console.log('\n🎯 NEXT STEPS:');
        console.log('1. Check if extension was reloaded with latest code');
        console.log('2. Verify waitingForDebugger is actually false in events');
        console.log('3. If still true, there may be another code path setting it');
        console.log('4. Consider session context or timing issues');
        
    } catch (error) {
        console.error('💥 Test failed:', error);
    }
}

main();