#!/usr/bin/env node
/**
 * Debug Message Routing
 * 
 * Since our events are correctly formatted (no id field), but the assertion
 * `assert(!object.id)` is still failing, the issue might be:
 * 1. Message routing in the bridge server
 * 2. Session context mismatch
 * 3. Timing issues with when events are sent
 */

const WebSocket = require('ws');

async function debugMessageRouting() {
    console.log('🔀 Debug Message Routing');
    console.log('=' + '='.repeat(50));
    
    // Connect to the bridge server's CDP port to see raw messages
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9222');
        let messageCount = 0;
        const allMessages = [];
        
        ws.on('open', () => {
            console.log('📡 Connected to bridge CDP server');
            
            // Send the exact sequence that Playwright does
            console.log('\n📤 Sending Browser.getVersion...');
            ws.send(JSON.stringify({
                id: 1,
                method: 'Browser.getVersion',
                params: {}
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                messageCount++;
                
                console.log(`\n📥 Message ${messageCount}:`);
                console.log(`   Raw: ${data.toString()}`);
                console.log(`   Parsed: ${JSON.stringify(parsed, null, 2)}`);
                
                // Validate message format
                const hasId = parsed.id !== undefined;
                const hasMethod = parsed.method !== undefined;
                const hasResult = parsed.result !== undefined;
                const hasError = parsed.error !== undefined;
                
                console.log(`   Validation:`);
                console.log(`     Has id: ${hasId} (${typeof parsed.id})`);
                console.log(`     Has method: ${hasMethod}`);
                console.log(`     Has result: ${hasResult}`);
                console.log(`     Has error: ${hasError}`);
                
                // Check if this message would pass or fail the assertion
                if (hasId) {
                    console.log(`     ⚠️  This message has id - would FAIL assert(!object.id)`);
                    if (hasMethod) {
                        console.log(`     🚨 CRITICAL: Event with id field - this is the bug!`);
                    }
                } else {
                    console.log(`     ✅ This message has no id - would PASS assert(!object.id)`);
                }
                
                allMessages.push(parsed);
                
                // Continue the sequence
                if (parsed.id === 1) {
                    console.log('\n📤 Sending Target.setAutoAttach...');
                    ws.send(JSON.stringify({
                        id: 2,
                        method: 'Target.setAutoAttach',
                        params: {
                            autoAttach: true,
                            waitForDebuggerOnStart: true,
                            flatten: true
                        }
                    }));
                } else if (parsed.id === 2) {
                    console.log('\n📤 Sending Target.createBrowserContext...');
                    ws.send(JSON.stringify({
                        id: 3,
                        method: 'Target.createBrowserContext',
                        params: {
                            disposeOnDetach: true
                        }
                    }));
                } else if (parsed.id === 3) {
                    console.log('\n📤 Sending Target.createTarget...');
                    ws.send(JSON.stringify({
                        id: 4,
                        method: 'Target.createTarget',
                        params: {
                            url: 'about:blank',
                            browserContextId: parsed.result?.browserContextId || 'default'
                        }
                    }));
                } else if (parsed.id === 4) {
                    console.log('\n✅ Target created, waiting for events...');
                    setTimeout(() => ws.close(), 2000);
                }
                
            } catch (error) {
                console.log(`❌ Parse error: ${error.message}`);
                console.log(`Raw data: ${data.toString()}`);
            }
        });
        
        ws.on('close', () => {
            console.log('\n📊 Message routing analysis complete');
            resolve(allMessages);
        });
        
        ws.on('error', (error) => {
            console.log('❌ Connection error:', error.message);
            resolve([]);
        });
    });
}

async function testBridgeServerDirectly() {
    console.log('\n🌉 Test Bridge Server Message Validation');
    console.log('=' + '='.repeat(50));
    
    // Check if the bridge server itself is corrupting messages
    console.log('Checking if bridge server validates CDP message format...');
    
    // Look at the bridge server's isValidCdpResponse function
    console.log('Bridge server should validate that:');
    console.log('1. Responses have id (number) + result/error');
    console.log('2. Events have method + params (no id)');
    console.log('3. No message should have both id and method');
}

async function main() {
    console.log('🎯 Debug Message Routing Test');
    console.log('=' + '='.repeat(60));
    console.log('Goal: Find why assert(!object.id) fails despite correct event format');
    console.log('');
    
    const messages = await debugMessageRouting();
    await testBridgeServerDirectly();
    
    console.log('\n🔍 Summary of Findings:');
    console.log(`📊 Total messages captured: ${messages.length}`);
    
    // Look for the smoking gun
    const messagesWithIdAndMethod = messages.filter(m => m.id !== undefined && m.method !== undefined);
    if (messagesWithIdAndMethod.length > 0) {
        console.log(`🚨 Found ${messagesWithIdAndMethod.length} messages with BOTH id AND method:`);
        messagesWithIdAndMethod.forEach(msg => {
            console.log(`   - id=${msg.id}, method="${msg.method}" 🚨 THIS IS THE BUG!`);
        });
    } else {
        console.log('✅ No messages found with both id and method');
    }
    
    const responsesWithoutId = messages.filter(m => m.result !== undefined && m.id === undefined);
    if (responsesWithoutId.length > 0) {
        console.log(`🚨 Found ${responsesWithoutId.length} responses without id field:`);
        responsesWithoutId.forEach(msg => {
            console.log(`   - Response missing id: ${JSON.stringify(msg)}`);
        });
    }
    
    console.log('\n💡 Root Cause:');
    console.log('If no obvious message format issues are found, the problem might be:');
    console.log('1. Session routing - event sent to wrong session');
    console.log('2. Timing - event sent before session is ready');
    console.log('3. Connection context - using wrong WebSocket connection');
}

main();