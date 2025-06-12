#!/usr/bin/env node
/**
 * Test the get_console_logs BROP command
 */

const WebSocket = require('ws');

async function testConsoleLogs() {
    console.log('🌐 Testing BROP get_console_logs command');
    console.log('=========================================');

    const ws = new WebSocket('ws://localhost:9223'); // BROP port
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Test get_console_logs command
            console.log('\n📜 Test: Getting console logs...');
            const logCommand = {
                id: requestId++,
                command: {
                    type: 'get_console_logs',
                    params: { limit: 50 }
                }
            };
            ws.send(JSON.stringify(logCommand));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log('📥 Response:', message.id, message.success ? '✅' : '❌');
                
                if (message.success && message.result) {
                    const result = message.result;
                    console.log(`   ✅ Retrieved ${result.logs.length} console logs`);
                    console.log(`   📊 Source: ${result.source}`);
                    console.log(`   💾 Total stored: ${result.total_stored}`);
                    
                    if (result.logs.length > 0) {
                        console.log('\n📋 Recent console logs:');
                        console.log('-'.repeat(60));
                        result.logs.slice(0, 5).forEach((log, index) => {
                            const time = new Date(log.timestamp).toLocaleTimeString();
                            console.log(`${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                            if (log.args && log.args.length > 0) {
                                console.log(`   Args: ${log.args.join(', ')}`);
                            }
                        });
                        console.log('-'.repeat(60));
                    } else {
                        console.log('   ℹ️  No console logs captured yet');
                    }
                } else if (!message.success) {
                    console.log('   ❌ Error:', message.error);
                }

                // Close connection
                setTimeout(() => {
                    console.log('\n✅ Console logs test completed!');
                    ws.close();
                    resolve();
                }, 1000);
            } catch (error) {
                console.log('📝 Raw response:', data.toString());
                setTimeout(() => {
                    ws.close();
                    resolve();
                }, 1000);
            }
        });

        ws.on('error', (error) => {
            console.error('❌ Connection error:', error.message);
            resolve();
        });

        ws.on('close', () => {
            console.log('🔌 Disconnected from bridge');
            resolve();
        });
    });
}

// Run the test
if (require.main === module) {
    testConsoleLogs().catch(console.error);
}