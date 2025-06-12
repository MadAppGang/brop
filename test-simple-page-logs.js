#!/usr/bin/env node
/**
 * Simple test for page console logs only
 */

const WebSocket = require('ws');

async function testPageLogs() {
    console.log('🌐 Testing Page Console Logs Only');
    console.log('=================================');

    const ws = new WebSocket('ws://localhost:9223');
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Navigate to a simple page
            console.log('\n🌐 Navigating to example.com...');
            const navCommand = {
                id: requestId++,
                command: {
                    type: 'navigate',
                    params: { url: 'https://example.com' }
                }
            };
            ws.send(JSON.stringify(navCommand));

            // Wait then get console logs
            setTimeout(() => {
                console.log('\n📜 Getting page console logs...');
                const logsCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 5 }
                    }
                };
                ws.send(JSON.stringify(logsCommand));
            }, 3000);

            // Close
            setTimeout(() => {
                ws.close();
                resolve();
            }, 6000);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📥 Response ${message.id}:`, message.success ? '✅' : '❌');
                
                if (message.success && message.result) {
                    if (message.id === 1) {
                        console.log('   ✅ Navigation completed');
                    } else if (message.id === 2) {
                        console.log(`   ✅ Retrieved ${message.result.logs.length} console logs`);
                        console.log(`   📊 Source: ${message.result.source}`);
                    }
                } else if (!message.success) {
                    console.log('   ❌ Error:', message.error);
                }
            } catch (error) {
                console.log('📝 Raw response:', data.toString());
            }
        });

        ws.on('error', (error) => {
            console.error('❌ Error:', error.message);
            resolve();
        });

        ws.on('close', () => {
            console.log('🔌 Disconnected');
            resolve();
        });
    });
}

if (require.main === module) {
    testPageLogs().catch(console.error);
}