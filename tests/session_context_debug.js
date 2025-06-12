#!/usr/bin/env node
/**
 * Session Context Debug
 * 
 * The assertion failure happens in CRSession._onMessage, which suggests
 * it's related to session context. Let's examine what Playwright expects
 * vs what we're sending in terms of session management.
 */

const WebSocket = require('ws');

async function analyzeSessionContext() {
    console.log('🔍 Session Context Analysis');
    console.log('=' + '='.repeat(50));
    
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9222');
        let messageId = 1;
        const sessionMessages = [];
        
        ws.on('open', () => {
            console.log('✅ Connected to analyze session behavior');
            
            // Simulate the exact sequence Playwright does
            console.log('\n📤 Step 1: Browser.getVersion...');
            ws.send(JSON.stringify({
                id: messageId++,
                method: 'Browser.getVersion',
                params: {}
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                sessionMessages.push(parsed);
                
                if (parsed.id === 1) {
                    console.log('📥 Browser.getVersion response received');
                    
                    console.log('\n📤 Step 2: Target.setAutoAttach...');
                    ws.send(JSON.stringify({
                        id: messageId++,
                        method: 'Target.setAutoAttach',
                        params: {
                            autoAttach: true,
                            waitForDebuggerOnStart: true, // This is what Playwright sends
                            flatten: true
                        }
                    }));
                    
                } else if (parsed.id === 2) {
                    console.log('📥 Target.setAutoAttach response received');
                    
                    console.log('\n📤 Step 3: Target.createBrowserContext...');
                    ws.send(JSON.stringify({
                        id: messageId++,
                        method: 'Target.createBrowserContext',
                        params: {
                            disposeOnDetach: true
                        }
                    }));
                    
                } else if (parsed.id === 3) {
                    console.log('📥 Target.createBrowserContext response received');
                    console.log(`   browserContextId: ${parsed.result?.browserContextId}`);
                    
                    console.log('\n📤 Step 4: Target.createTarget...');
                    ws.send(JSON.stringify({
                        id: messageId++,
                        method: 'Target.createTarget',
                        params: {
                            url: 'about:blank',
                            browserContextId: parsed.result?.browserContextId || 'default'
                        }
                    }));
                    
                } else if (parsed.id === 4) {
                    console.log('📥 Target.createTarget response received');
                    console.log(`   targetId: ${parsed.result?.targetId}`);
                    
                    // Wait for events then analyze
                    setTimeout(() => {
                        ws.close();
                    }, 1000);
                    
                } else if (parsed.method === 'Target.attachedToTarget') {
                    console.log('\n🎯 CRITICAL: Target.attachedToTarget event received');
                    
                    const params = parsed.params;
                    console.log('📋 Event Analysis:');
                    console.log(`   sessionId: "${params?.sessionId}"`);
                    console.log(`   waitingForDebugger: ${params?.waitingForDebugger}`);
                    console.log(`   targetInfo.targetId: "${params?.targetInfo?.targetId}"`);
                    console.log(`   targetInfo.browserContextId: "${params?.targetInfo?.browserContextId}"`);
                    
                    // The key insight: Check if session ID format matches expectations
                    console.log('\n🔍 Session ID Analysis:');
                    const sessionId = params?.sessionId;
                    if (sessionId) {
                        console.log(`   Length: ${sessionId.length}`);
                        console.log(`   Format: ${sessionId.match(/^session_\d+_[a-z0-9]+$/) ? 'Custom format' : 'Unknown format'}`);
                        console.log(`   Contains timestamp: ${sessionId.includes('_')}`);
                        
                        // Check if Playwright expects a specific session ID format
                        if (!sessionId.match(/^[a-f0-9-]{36}$/) && !sessionId.match(/^[A-F0-9-]{36}$/)) {
                            console.log('   ⚠️  Session ID is not UUID format (might be the issue!)');
                        }
                    }
                    
                    // Check target/context association
                    console.log('\n🔍 Context Association Analysis:');
                    const targetInfo = params?.targetInfo;
                    if (targetInfo) {
                        console.log(`   Target context: "${targetInfo.browserContextId}"`);
                        console.log(`   Target type: "${targetInfo.type}"`);
                        console.log(`   Target attached: ${targetInfo.attached}`);
                        
                        // This could be the issue - context mismatch
                        if (targetInfo.browserContextId === 'default') {
                            console.log('   ⚠️  Using default context instead of created context');
                        }
                    }
                    
                } else if (parsed.method) {
                    console.log(`📡 Event: ${parsed.method}`);
                }
                
            } catch (error) {
                console.log('❌ Parse error:', error.message);
            }
        });
        
        ws.on('close', () => {
            console.log('\n📊 Session Analysis Complete');
            resolve(sessionMessages);
        });
        
        ws.on('error', (error) => {
            console.log('❌ Error:', error.message);
            resolve([]);
        });
    });
}

async function main() {
    console.log('🎯 Session Context Debug Test');
    console.log('=' + '='.repeat(60));
    console.log('Goal: Analyze session context issues that might cause assertion');
    console.log('');
    
    const messages = await analyzeSessionContext();
    
    console.log('\n💡 Potential Session Issues:');
    console.log('1. Session ID format - Playwright might expect UUID format');
    console.log('2. Browser context association - Events might be sent to wrong context');
    console.log('3. Session routing - Events might not be properly routed to the right session');
    console.log('4. Timing - Events might be sent before session is fully established');
    
    console.log('\n🔧 Possible Fixes:');
    console.log('1. Use UUID format for session IDs instead of custom format');
    console.log('2. Ensure events are sent with correct browserContextId');
    console.log('3. Add session validation before sending events');
    console.log('4. Delay events until session is confirmed established');
}

main();