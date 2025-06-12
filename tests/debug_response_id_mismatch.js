#!/usr/bin/env node
/**
 * Debug Response ID Mismatch
 * 
 * The assertion assert(!object.id) fails when:
 * 1. A response has an id that doesn't match any pending request
 * 2. Response timing is wrong (callback already removed)
 * 3. ID corruption in responses
 * 
 * Let's track request/response ID matching.
 */

const WebSocket = require('ws');

async function debugResponseIdMatching() {
    console.log('🔍 Debug Response ID Matching');
    console.log('=' + '='.repeat(60));
    console.log('Goal: Check if response IDs match request IDs exactly');
    console.log('');
    
    const requestResponseMap = new Map();
    const orphanResponses = [];
    
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9222');
        let messageId = 1;
        
        ws.on('open', () => {
            console.log('📡 Connected to track request/response matching');
            
            // Send first command
            console.log(`📤 SENDING: Browser.getVersion (id: ${messageId})`);
            requestResponseMap.set(messageId, {
                method: 'Browser.getVersion',
                sentAt: Date.now(),
                received: false
            });
            
            ws.send(JSON.stringify({
                id: messageId++,
                method: 'Browser.getVersion',
                params: {}
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                const now = Date.now();
                
                if (parsed.id !== undefined) {
                    // This is a response
                    console.log(`\n📥 RESPONSE: id=${parsed.id} (${typeof parsed.id})`);
                    
                    if (requestResponseMap.has(parsed.id)) {
                        const request = requestResponseMap.get(parsed.id);
                        request.received = true;
                        request.receivedAt = now;
                        const latency = now - request.sentAt;
                        
                        console.log(`   ✅ MATCHED: ${request.method} (${latency}ms latency)`);
                        console.log(`   Response: ${parsed.result ? 'SUCCESS' : 'ERROR'}`);
                        
                        // Send next command in sequence
                        if (parsed.id === 1) {
                            console.log(`\n📤 SENDING: Target.setAutoAttach (id: ${messageId})`);
                            requestResponseMap.set(messageId, {
                                method: 'Target.setAutoAttach',
                                sentAt: Date.now(),
                                received: false
                            });
                            
                            ws.send(JSON.stringify({
                                id: messageId++,
                                method: 'Target.setAutoAttach',
                                params: {
                                    autoAttach: true,
                                    waitForDebuggerOnStart: true,
                                    flatten: true
                                }
                            }));
                        } else if (parsed.id === 2) {
                            console.log(`\n📤 SENDING: Target.createTarget (id: ${messageId})`);
                            requestResponseMap.set(messageId, {
                                method: 'Target.createTarget',
                                sentAt: Date.now(),
                                received: false
                            });
                            
                            ws.send(JSON.stringify({
                                id: messageId++,
                                method: 'Target.createTarget',
                                params: {
                                    url: 'about:blank',
                                    browserContextId: 'default'
                                }
                            }));
                        } else if (parsed.id === 3) {
                            console.log(`\n✅ All commands sent, waiting for events...`);
                            setTimeout(() => ws.close(), 2000);
                        }
                        
                    } else {
                        console.log(`   🚨 ORPHAN RESPONSE: No matching request for id=${parsed.id}`);
                        console.log(`   This would cause assert(!object.id) to fail!`);
                        
                        orphanResponses.push({
                            id: parsed.id,
                            data: parsed,
                            receivedAt: now
                        });
                    }
                    
                } else if (parsed.method) {
                    // This is an event
                    console.log(`\n📡 EVENT: ${parsed.method}`);
                    console.log(`   ✅ Correctly has no id field`);
                    
                } else {
                    console.log(`\n❓ UNKNOWN MESSAGE: ${JSON.stringify(parsed)}`);
                }
                
            } catch (error) {
                console.log(`❌ Parse error: ${error.message}`);
            }
        });
        
        ws.on('close', () => {
            console.log('\n📊 Analysis Complete');
            resolve({ requestResponseMap, orphanResponses });
        });
        
        ws.on('error', (error) => {
            console.log(`❌ Connection error: ${error.message}`);
            resolve({ requestResponseMap: new Map(), orphanResponses: [] });
        });
    });
}

function analyzeResults(requestResponseMap, orphanResponses) {
    console.log('\n🔍 Request/Response Analysis');
    console.log('=' + '='.repeat(60));
    
    console.log(`📊 Sent ${requestResponseMap.size} requests`);
    
    // Check for unmatched requests
    const unmatchedRequests = [];
    for (const [id, request] of requestResponseMap) {
        if (!request.received) {
            unmatchedRequests.push({ id, request });
        }
    }
    
    if (unmatchedRequests.length > 0) {
        console.log(`🚨 ${unmatchedRequests.length} requests without responses:`);
        unmatchedRequests.forEach(({ id, request }) => {
            console.log(`   - id=${id}: ${request.method} (sent ${Date.now() - request.sentAt}ms ago)`);
        });
    } else {
        console.log(`✅ All requests received matching responses`);
    }
    
    // Check orphan responses
    if (orphanResponses.length > 0) {
        console.log(`\n🚨 ${orphanResponses.length} orphan responses (THIS IS THE BUG!):`);
        orphanResponses.forEach((response, index) => {
            console.log(`\n${index + 1}. Orphan Response:`);
            console.log(`   ID: ${response.id} (${typeof response.id})`);
            console.log(`   Data: ${JSON.stringify(response.data, null, 2)}`);
            console.log(`   🎯 This response causes assert(!object.id) to fail!`);
        });
        
        console.log('\n💡 Root Cause:');
        console.log('Orphan responses have id fields but no matching pending requests.');
        console.log('Playwright falls back to event handling and asserts !object.id.');
        
    } else {
        console.log(`\n✅ No orphan responses found`);
    }
}

async function main() {
    console.log('🎯 Debug Response ID Mismatch Test');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find responses with IDs that don\'t match pending requests');
    console.log('');
    
    const { requestResponseMap, orphanResponses } = await debugResponseIdMatching();
    analyzeResults(requestResponseMap, orphanResponses);
    
    if (orphanResponses.length > 0) {
        console.log('\n🔧 FIX REQUIRED:');
        console.log('1. Ensure response IDs exactly match request IDs');
        console.log('2. Check for timing issues in bridge server');
        console.log('3. Verify ID preservation through the message pipeline');
    } else {
        console.log('\n🤔 If no ID mismatches found, the issue might be:');
        console.log('1. Response timing (callbacks cleared before response arrives)');
        console.log('2. Message corruption during transmission');
        console.log('3. Different assertion condition than expected');
    }
}

main();