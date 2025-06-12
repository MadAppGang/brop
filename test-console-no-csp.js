#!/usr/bin/env node
/**
 * Test console logs on a page without strict CSP
 */

const WebSocket = require('ws');

async function testConsoleNoCSP() {
    console.log('🧪 Console Test (No CSP restrictions)');
    console.log('=====================================');
    console.log('👀 Please open Chrome DevTools (F12) -> Console tab');
    console.log('');

    const ws = new WebSocket('ws://localhost:9223');
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Use a local file or data URL to avoid CSP
            console.log('\n📍 STEP 1: Creating a test page without CSP restrictions...');
            const navCommand = {
                id: requestId++,
                command: {
                    type: 'navigate',
                    params: { 
                        url: 'data:text/html,<html><head><title>BROP Test Page</title></head><body><h1>BROP Console Test</h1><p>This page allows console output.</p></body></html>'
                    }
                }
            };
            ws.send(JSON.stringify(navCommand));

            // Install console capture
            setTimeout(() => {
                console.log('\n📍 STEP 2: Installing console capture...');
                const captureCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 1 }
                    }
                };
                ws.send(JSON.stringify(captureCommand));
            }, 3000);

            // Generate console output
            setTimeout(() => {
                console.log('\n📍 STEP 3: Generating console output...');
                console.log('🔍 EXPECT TO SEE IN BROWSER CONSOLE:');
                console.log('   - "BROP TEST: Hello from test page!"');
                console.log('   - "BROP TEST: Warning message"');
                console.log('   - "BROP TEST: Error message"');
                console.log('   - "BROP TEST: Info message"');
                
                const jsCommand = {
                    id: requestId++,
                    command: {
                        type: 'execute_console',
                        params: { 
                            code: `
                                console.log('BROP TEST: Hello from test page!');
                                console.warn('BROP TEST: Warning message');
                                console.error('BROP TEST: Error message');
                                console.info('BROP TEST: Info message');
                                'Console output completed'
                            `
                        }
                    }
                };
                ws.send(JSON.stringify(jsCommand));
            }, 6000);

            // Get console logs
            setTimeout(() => {
                console.log('\n📍 STEP 4: Retrieving all console logs...');
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
                console.log('\n✅ Test completed!');
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
                            console.log('   ✅ Navigation to test page completed');
                            break;
                        case 2:
                            console.log(`   ✅ Console capture installed (${message.result.logs.length} initial logs)`);
                            break;
                        case 3:
                            console.log('   ✅ Console output generated');
                            break;
                        case 4:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} console logs`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 CAPTURED CONSOLE LOGS:');
                                console.log('   ' + '='.repeat(60));
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                                    if (log.args && log.args.length > 0) {
                                        console.log(`      Args: ${log.args.join(', ')}`);
                                    }
                                });
                                console.log('   ' + '='.repeat(60));
                                
                                // Check if we got the expected messages
                                const hasTestMessages = message.result.logs.some(log => 
                                    log.message && log.message.includes('BROP TEST:')
                                );
                                
                                if (hasTestMessages) {
                                    console.log('   ✅ SUCCESS: Found BROP TEST messages in captured logs!');
                                    console.log('   🎉 Console capture is working correctly!');
                                } else {
                                    console.log('   ⚠️  No BROP TEST messages found in captured logs');
                                    console.log('   💡 Check if CSP or timing issues occurred');
                                }
                            } else {
                                console.log('   ⚠️  No console logs captured');
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
    testConsoleNoCSP().catch(console.error);
}