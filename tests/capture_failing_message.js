#!/usr/bin/env node
/**
 * Capture the exact CDP message that causes the assertion failure
 * 
 * We'll intercept WebSocket messages right at the moment of failure to see
 * what message Playwright is receiving that triggers the assertion.
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

// Track CDP messages to BROP during Playwright operation
async function interceptCDPDuringPlaywright() {
    console.log('🕵️ Intercepting CDP Messages During Playwright Operation');
    console.log('=' + '='.repeat(60));
    
    const messages = [];
    let interceptWs = null;
    
    // Start intercepting CDP messages
    const interceptPromise = new Promise((resolve) => {
        interceptWs = new WebSocket('ws://localhost:9222');
        
        interceptWs.on('open', () => {
            console.log('📡 Intercept WebSocket connected');
        });
        
        interceptWs.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                const timestamp = Date.now();
                console.log(`📥 [${timestamp}] Received: ${JSON.stringify(parsed).substring(0, 150)}...`);
                messages.push({
                    timestamp,
                    direction: 'receive',
                    data: parsed
                });
            } catch (error) {
                console.log(`📥 [${Date.now()}] Raw message: ${data.toString()}`);
            }
        });
        
        interceptWs.on('close', () => {
            console.log('📡 Intercept WebSocket closed');
            resolve(messages);
        });
        
        interceptWs.on('error', (error) => {
            console.log('📡 Intercept error:', error.message);
        });
    });
    
    // Start Playwright test in parallel
    setTimeout(async () => {
        try {
            console.log('\n🎭 Starting Playwright test...');
            const browser = await chromium.connectOverCDP('ws://localhost:9222');
            console.log('✅ Browser connected');
            
            const context = await browser.newContext();
            console.log('✅ Context created');
            
            // This is where the assertion failure happens
            console.log('🎯 About to create page (assertion failure expected here)...');
            const page = await context.newPage();
            console.log('✅ Page created successfully');
            
        } catch (error) {
            console.log('\n❌ Playwright failed as expected:', error.message);
            
            // Close intercept WebSocket after capturing the failure
            setTimeout(() => {
                if (interceptWs && interceptWs.readyState === WebSocket.OPEN) {
                    interceptWs.close();
                }
            }, 1000);
        }
    }, 500);
    
    // Wait for intercept to complete
    return interceptPromise;
}

// Create a simple CDP test to compare working vs failing scenarios
async function compareWorkingVsFailingCDP() {
    console.log('\n🔍 Comparing Working vs Failing CDP Scenarios');
    console.log('=' + '='.repeat(60));
    
    // First, test what works (direct CDP)
    console.log('\n✅ Testing direct CDP (works):');
    const workingMessages = await new Promise((resolve) => {
        const messages = [];
        const ws = new WebSocket('ws://localhost:9222');
        let messageId = 1;
        
        ws.on('open', () => {
            // Send commands that we know work
            ws.send(JSON.stringify({
                id: messageId++,
                method: 'Browser.getVersion',
                params: {}
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                console.log(`📥 Direct CDP: ${JSON.stringify(parsed).substring(0, 100)}...`);
                messages.push(parsed);
                
                if (parsed.id === 1) {
                    // Send Target.createTarget after Browser.getVersion
                    ws.send(JSON.stringify({
                        id: messageId++,
                        method: 'Target.createTarget',
                        params: {
                            url: 'about:blank',
                            browserContextId: 'default'
                        }
                    }));
                } else if (parsed.id === 2) {
                    // Close after creating target
                    setTimeout(() => ws.close(), 100);
                }
            } catch (error) {
                console.log('Parse error:', error);
            }
        });
        
        ws.on('close', () => {
            resolve(messages);
        });
    });
    
    return workingMessages;
}

async function main() {
    console.log('🎯 Capture Failing CDP Message Test');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find the exact CDP message that triggers Playwright assertion');
    console.log('');
    
    try {
        // First test what works
        const workingMessages = await compareWorkingVsFailingCDP();
        
        // Then intercept during Playwright failure
        console.log('\n🎭 Now intercepting during Playwright failure...');
        const failingMessages = await interceptCDPDuringPlaywright();
        
        console.log('\n📊 Analysis Results:');
        console.log(`   - Working direct CDP messages: ${workingMessages.length}`);
        console.log(`   - Messages during Playwright failure: ${failingMessages.length}`);
        
        console.log('\n📋 Last few messages before failure:');
        failingMessages.slice(-5).forEach((msg, index) => {
            console.log(`${index + 1}. [${msg.timestamp}] ${JSON.stringify(msg.data)}`);
        });
        
        // Look for patterns in the messages that might cause assertion failure
        console.log('\n🔍 Potential Issues:');
        failingMessages.forEach((msg, index) => {
            const data = msg.data;
            
            // Check for missing fields
            if (data.id !== undefined && (!data.result && !data.error)) {
                console.log(`⚠️  Message ${index + 1}: Missing result/error field`);
            }
            
            // Check for invalid ID types
            if (data.id !== undefined && typeof data.id !== 'number') {
                console.log(`⚠️  Message ${index + 1}: Non-numeric ID: ${typeof data.id}`);
            }
            
            // Check for events vs responses
            if (data.method && !data.id) {
                console.log(`ℹ️  Message ${index + 1}: Event - ${data.method}`);
            }
        });
        
        console.log('\n💡 Recommendation:');
        console.log('The assertion error is in CRSession._onMessage at crConnection.js:134');
        console.log('This suggests Playwright is receiving a message that doesn\'t match its expectations.');
        console.log('Common causes:');
        console.log('1. Event sent without method field');
        console.log('2. Response sent without proper id/result/error structure');
        console.log('3. Message timing/ordering issues');
        console.log('4. Target/session context mismatches');
        
    } catch (error) {
        console.error('💥 Test failed:', error);
    }
}

main();