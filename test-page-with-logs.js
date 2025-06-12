#!/usr/bin/env node
/**
 * Test page console logs with a page that generates console output
 */

const WebSocket = require('ws');

async function testPageWithLogs() {
    console.log('🌐 Testing Page Console Logs with Generated Output');
    console.log('================================================');

    const ws = new WebSocket('ws://localhost:9223');
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Navigate to a test page
            console.log('\n🌐 Navigating to a test page...');
            const navCommand = {
                id: requestId++,
                command: {
                    type: 'navigate',
                    params: { url: 'https://example.com' }
                }
            };
            ws.send(JSON.stringify(navCommand));

            // Generate console output
            setTimeout(() => {
                console.log('\n🔍 Generating console output on page...');
                const jsCommand = {
                    id: requestId++,
                    command: {
                        type: 'execute_console',
                        params: { 
                            code: `
                                console.log('BROP Test: Page loaded successfully');
                                console.warn('BROP Test: This is a warning message');
                                console.error('BROP Test: This is an error message');
                                console.info('BROP Test: Page info message');
                                console.log('BROP Test: Current URL is', window.location.href);
                                'Console output generated successfully'
                            `
                        }
                    }
                };
                ws.send(JSON.stringify(jsCommand));
            }, 3000);

            // Get page console logs
            setTimeout(() => {
                console.log('\n📜 Getting page console logs...');
                const logsCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 20 }
                    }
                };
                ws.send(JSON.stringify(logsCommand));
            }, 6000);

            // Get only error logs
            setTimeout(() => {
                console.log('\n❌ Getting error logs only...');
                const errorCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 10, level: 'error' }
                    }
                };
                ws.send(JSON.stringify(errorCommand));
            }, 9000);

            // Close
            setTimeout(() => {
                console.log('\n✅ Page console logs test completed!');
                ws.close();
                resolve();
            }, 12000);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📥 Response ${message.id}:`, message.success ? '✅' : '❌');
                
                if (message.success && message.result) {
                    switch (message.id) {
                        case 1:
                            console.log('   ✅ Navigation completed');
                            break;
                        case 2:
                            console.log('   ✅ Console output generated on page');
                            break;
                        case 3:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} page console logs`);
                            console.log(`   📊 Source: ${message.result.source}`);
                            console.log(`   🌐 Tab: ${message.result.tab_title}`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 Page console logs:');
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                                    if (log.args && log.args.length > 0) {
                                        console.log(`      Args: ${log.args.join(', ')}`);
                                    }
                                });
                            }
                            break;
                        case 4:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} error logs`);
                            console.log(`   🔍 Filter: ${message.result.filter_level}`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 Error logs:');
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                                });
                            }
                            break;
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
    testPageWithLogs().catch(console.error);
}