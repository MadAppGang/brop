#!/usr/bin/env node
/**
 * Test page console logs without using eval (to avoid CSP issues)
 */

const WebSocket = require('ws');

async function testConsoleLogsNoEval() {
    console.log('🌐 Testing Page Console Logs (No Eval)');
    console.log('=====================================');

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

            // Wait for page load and install console capture
            setTimeout(() => {
                console.log('\n🔧 Installing console capture on page...');
                const installCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 5 }
                    }
                };
                ws.send(JSON.stringify(installCommand));
            }, 3000);

            // Generate console output using script injection (not eval)
            setTimeout(() => {
                console.log('\n🔍 Generating console output via script injection...');
                const jsCommand = {
                    id: requestId++,
                    command: {
                        type: 'execute_console',
                        params: { 
                            code: `
                                // Use direct console calls (not eval)
                                console.log('Direct log message from page');
                                console.warn('Direct warning from page');
                                console.error('Direct error from page');
                                'Console output generated via direct calls'
                            `
                        }
                    }
                };
                ws.send(JSON.stringify(jsCommand));
            }, 6000);

            // Get page console logs after generation
            setTimeout(() => {
                console.log('\n📜 Getting page console logs after generation...');
                const logsCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 20 }
                    }
                };
                ws.send(JSON.stringify(logsCommand));
            }, 9000);

            // Close
            setTimeout(() => {
                console.log('\n✅ Console logs test completed!');
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
                            console.log(`   ✅ Console capture installed (${message.result.logs.length} initial logs)`);
                            break;
                        case 3:
                            console.log('   ✅ Console output generated');
                            break;
                        case 4:
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
                            } else {
                                console.log('   ℹ️  No console logs captured');
                                console.log('   💡 This may be due to CSP restrictions or timing');
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
    testConsoleLogsNoEval().catch(console.error);
}