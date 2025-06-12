#!/usr/bin/env node
/**
 * Simple test to demonstrate session cleanup and tab close notifications
 */

const WebSocket = require('ws');

async function testSessionCleanup() {
    console.log('🧪 Session Cleanup & Tab Close Notification Test');
    console.log('===================================================');

    // Connect to bridge server WebSocket
    const ws = new WebSocket('ws://localhost:9222');
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', async () => {
            console.log('✅ Connected to BROP bridge server');

            // Set up event listeners for session notifications
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    
                    if (message.type === 'event') {
                        switch (message.method) {
                            case 'Target.targetDestroyed':
                                console.log('📡 🗑️ Target destroyed:', message.params.targetId);
                                break;
                            case 'Target.detachedFromTarget':
                                console.log('📡 🔌 Target detached:', message.params.targetId, 'session:', message.params.sessionId);
                                break;
                            case 'Page.frameNavigated':
                                console.log('📡 🧭 Page navigated:', message.params.frame.url);
                                break;
                        }
                    } else if (message.type === 'session_event') {
                        console.log(`📡 🎯 BROP Session Event: ${message.event_type}`);
                        console.log(`   Tab ID: ${message.tabId}`);
                        console.log(`   Target ID: ${message.targetId}`);
                        if (message.sessionId) {
                            console.log(`   Session ID: ${message.sessionId}`);
                        }
                        if (message.reason) {
                            console.log(`   Reason: ${message.reason}`);
                        }
                    }
                } catch (error) {
                    console.log('📝 Raw message:', data.toString());
                }
            });

            // Test 1: Create a new target
            console.log('\n📄 Test 1: Creating a new tab...');
            const createTargetMsg = {
                id: requestId++,
                method: 'Target.createTarget',
                params: { url: 'https://httpbin.org/html' }
            };
            ws.send(JSON.stringify(createTargetMsg));

            // Wait 3 seconds
            setTimeout(() => {
                console.log('\n🗑️ Test 2: Closing the tab programmatically...');
                // This should trigger notifications
                const closeTargetMsg = {
                    id: requestId++,
                    method: 'Target.closeTarget',
                    params: { targetId: 'tab_654754720' } // Use an existing tab ID
                };
                ws.send(JSON.stringify(closeTargetMsg));

                // Wait another 3 seconds for notifications
                setTimeout(() => {
                    console.log('\n✅ Session cleanup test completed!');
                    console.log('📝 Check the bridge server logs to see detailed session notifications');
                    console.log('🎯 You can also manually close tabs in your browser to see notifications');
                    
                    ws.close();
                    resolve();
                }, 3000);
            }, 3000);
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            resolve();
        });

        ws.on('close', () => {
            console.log('🔌 Disconnected from bridge server');
            resolve();
        });
    });
}

// Run the test
if (require.main === module) {
    testSessionCleanup().catch(console.error);
}

module.exports = { testSessionCleanup };