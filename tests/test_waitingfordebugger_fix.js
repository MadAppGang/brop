#!/usr/bin/env node
/**
 * Test the waitingForDebugger fix
 * 
 * This test verifies that events are sent with waitingForDebugger: false
 * to prevent the Playwright assertion error.
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

async function testWaitingForDebuggerFix() {
    console.log('🔧 Testing waitingForDebugger Fix');
    console.log('=' + '='.repeat(50));
    
    // First, verify that direct CDP events have the correct field
    console.log('📡 Step 1: Check direct CDP events...');
    const events = await new Promise((resolve) => {
        const capturedEvents = [];
        const ws = new WebSocket('ws://localhost:9222');
        let messageId = 1;
        
        ws.on('open', () => {
            // Send Target.setAutoAttach with waitForDebuggerOnStart: true (like Playwright does)
            ws.send(JSON.stringify({
                id: messageId++,
                method: 'Target.setAutoAttach',
                params: {
                    autoAttach: true,
                    waitForDebuggerOnStart: true,
                    flatten: true
                }
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                
                if (parsed.method === 'Target.attachedToTarget') {
                    console.log('📥 Found Target.attachedToTarget event:');
                    console.log(`   waitingForDebugger: ${parsed.params?.waitingForDebugger}`);
                    capturedEvents.push(parsed);
                } else if (parsed.id === 1) {
                    // After Target.setAutoAttach response, create a target
                    ws.send(JSON.stringify({
                        id: messageId++,
                        method: 'Target.createTarget',
                        params: {
                            url: 'about:blank',
                            browserContextId: 'default'
                        }
                    }));
                } else if (parsed.id === 2) {
                    // After target creation, close
                    setTimeout(() => ws.close(), 500);
                }
            } catch (error) {
                console.log('Parse error:', error);
            }
        });
        
        ws.on('close', () => {
            resolve(capturedEvents);
        });
    });
    
    console.log(`✅ Captured ${events.length} Target.attachedToTarget events`);
    
    // Check if any events have waitingForDebugger: true
    const badEvents = events.filter(e => e.params?.waitingForDebugger === true);
    if (badEvents.length > 0) {
        console.log(`❌ Found ${badEvents.length} events with waitingForDebugger: true`);
        console.log('This will cause Playwright assertion error!');
        return false;
    } else {
        console.log('✅ All events have waitingForDebugger: false');
    }
    
    // Now test Playwright to see if the assertion error is gone
    console.log('\n🎭 Step 2: Test Playwright with the fix...');
    try {
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        const page = await context.newPage();
        console.log('🎉 Page created successfully! (No assertion error)');
        
        const title = await page.title();
        console.log(`✅ Page title: "${title}"`);
        
        await page.close();
        await context.close();
        await browser.close();
        
        console.log('🎉 Test completed successfully!');
        return true;
        
    } catch (error) {
        if (error.message.includes('Assertion error')) {
            console.log('❌ Assertion error still occurs:', error.message);
            return false;
        } else {
            console.log('❌ Different error occurred:', error.message);
            return false;
        }
    }
}

async function main() {
    console.log('🎯 waitingForDebugger Fix Test');
    console.log('=' + '='.repeat(60));
    console.log('Goal: Verify that waitingForDebugger: false prevents assertion error');
    console.log('');
    
    const success = await testWaitingForDebuggerFix();
    
    if (success) {
        console.log('\n🎉 SUCCESS: The waitingForDebugger fix works!');
        console.log('Playwright can now create pages without assertion errors.');
    } else {
        console.log('\n❌ FAILED: The assertion error still occurs.');
        console.log('Need to investigate further or try a different approach.');
    }
}

main();