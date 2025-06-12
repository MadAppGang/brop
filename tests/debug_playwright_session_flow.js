#!/usr/bin/env node
/**
 * Debug Playwright Session Flow
 * 
 * Since basic CDP works but Playwright fails, the issue is likely in
 * the more complex session management that Playwright uses.
 * 
 * Let's trace exactly what happens during context.newPage()
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

async function tracePlaywrightSessionFlow() {
    console.log('🔍 Trace Playwright Session Flow');
    console.log('=' + '='.repeat(60));
    
    // Intercept all CDP messages during Playwright operations
    const messageLog = [];
    let interceptWs = null;
    
    const interceptPromise = new Promise((resolve) => {
        interceptWs = new WebSocket('ws://localhost:9222');
        
        interceptWs.on('open', () => {
            console.log('📡 Intercept connection established');
        });
        
        interceptWs.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                const timestamp = Date.now();
                
                messageLog.push({
                    timestamp,
                    direction: 'receive',
                    data: parsed
                });
                
                const hasId = parsed.id !== undefined;
                const hasMethod = parsed.method !== undefined;
                
                if (hasId && !hasMethod) {
                    console.log(`📥 RESPONSE: id=${parsed.id} ${parsed.result ? 'SUCCESS' : 'ERROR'}`);
                } else if (hasMethod && !hasId) {
                    console.log(`📡 EVENT: ${parsed.method}`);
                } else if (hasId && hasMethod) {
                    console.log(`🚨 INVALID: Both id=${parsed.id} and method=${parsed.method}`);
                } else {
                    console.log(`❓ UNKNOWN: ${JSON.stringify(parsed).substring(0, 100)}...`);
                }
                
            } catch (error) {
                console.log(`❌ Parse error: ${error.message}`);
            }
        });
        
        interceptWs.on('close', () => {
            resolve(messageLog);
        });
        
        interceptWs.on('error', (error) => {
            console.log(`❌ Intercept error: ${error.message}`);
            resolve(messageLog);
        });
    });
    
    // Run Playwright operations that fail
    setTimeout(async () => {
        try {
            console.log('\n🎭 Starting Playwright operations...');
            
            const browser = await chromium.connectOverCDP('ws://localhost:9222');
            console.log('✅ Browser connected');
            
            const context = await browser.newContext();
            console.log('✅ Context created');
            
            console.log('🎯 Creating page (assertion failure expected here)...');
            const page = await context.newPage();
            console.log('🎉 Page created successfully!');
            
            await page.close();
            await context.close();
            await browser.close();
            
        } catch (error) {
            console.log(`\n💥 Playwright failed: ${error.message}`);
            
            if (error.message.includes('Assertion error')) {
                console.log('🎯 Confirmed: This is the assertion error we\'re debugging');
            }
            
            // Close intercept connection after capturing failure
            setTimeout(() => {
                if (interceptWs && interceptWs.readyState === WebSocket.OPEN) {
                    interceptWs.close();
                }
            }, 1000);
        }
    }, 1000);
    
    return interceptPromise;
}

function analyzeSessionFlow(messageLog) {
    console.log('\n🔍 Session Flow Analysis');
    console.log('=' + '='.repeat(60));
    
    console.log(`📊 Captured ${messageLog.length} messages`);
    
    // Look for patterns that might cause the assertion error
    let requestCount = 0;
    let responseCount = 0;
    let eventCount = 0;
    const pendingRequests = new Map();
    const orphanResponses = [];
    
    messageLog.forEach((msg, index) => {
        const data = msg.data;
        const hasId = data.id !== undefined;
        const hasMethod = data.method !== undefined;
        
        if (!hasId && hasMethod) {
            // Event
            eventCount++;
        } else if (hasId && !hasMethod) {
            // Response
            responseCount++;
            
            // Check if this response has a matching request
            if (pendingRequests.has(data.id)) {
                pendingRequests.delete(data.id);
                console.log(`   ✅ Response ${data.id} matched`);
            } else {
                console.log(`   🚨 Orphan response ${data.id} - NO MATCHING REQUEST!`);
                orphanResponses.push({ index, data });
            }
        } else if (hasId && hasMethod) {
            // Invalid: both id and method
            console.log(`   🚨 INVALID MESSAGE: id=${data.id}, method=${data.method}`);
        }
    });
    
    console.log(`\n📊 Message Summary:`);
    console.log(`   Responses: ${responseCount}`);
    console.log(`   Events: ${eventCount}`);
    console.log(`   Orphan responses: ${orphanResponses.length}`);
    
    if (orphanResponses.length > 0) {
        console.log(`\n🚨 FOUND THE BUG! Orphan responses:`);
        orphanResponses.forEach((orphan, index) => {
            console.log(`\n${index + 1}. Orphan Response (causes assertion error):`);
            console.log(`   Message ${orphan.index + 1}: id=${orphan.data.id}`);
            console.log(`   Data: ${JSON.stringify(orphan.data, null, 2)}`);
            console.log(`   🎯 This response has no matching request in Playwright's callback map`);
            console.log(`   🎯 Playwright falls back to event handler and asserts !object.id`);
        });
        
        console.log(`\n💡 Root Cause:`);
        console.log(`The bridge server is sending responses for requests that Playwright`);
        console.log(`either never sent, or has already processed and removed from callbacks.`);
        
    } else {
        console.log(`\n✅ No orphan responses detected in message flow`);
        console.log(`The assertion error might be caused by:`);
        console.log(`1. Timing issues (response after callback timeout)`);
        console.log(`2. Session routing problems`);
        console.log(`3. Message corruption`);
    }
    
    // Look for session-related commands
    console.log(`\n🔍 Session-related Commands:`);
    const sessionCommands = messageLog.filter(msg => 
        msg.data.method && msg.data.method.includes('Target.attach') ||
        msg.data.method && msg.data.method.includes('Session') ||
        msg.data.method && msg.data.method.includes('Target.create')
    );
    
    sessionCommands.forEach(msg => {
        console.log(`   📋 ${msg.data.method}: ${JSON.stringify(msg.data.params)}`);
    });
}

async function main() {
    console.log('🎯 Debug Playwright Session Flow Test');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find what causes assert(!object.id) during Playwright operations');
    console.log('');
    
    const messageLog = await tracePlaywrightSessionFlow();
    analyzeSessionFlow(messageLog);
    
    console.log('\n🔧 Next Steps Based on Analysis:');
    console.log('1. If orphan responses found: Fix bridge server ID handling');
    console.log('2. If no orphans: Investigate session routing and timing');
    console.log('3. Focus on Target.attachToTarget and session creation');
}

main();