#!/usr/bin/env node
/**
 * Test different types of console errors to understand what we can capture
 */

const WebSocket = require('ws');

async function testConsoleErrorTypes() {
    console.log('🧪 Testing Different Console Error Types');
    console.log('=======================================');
    console.log('🎯 Goal: Understand what console errors we can capture');
    console.log('');

    const ws = new WebSocket('ws://localhost:9223');
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Navigate to a simple page first
            console.log('\n📍 STEP 1: Navigating to simple page...');
            const navCommand = {
                id: requestId++,
                command: {
                    type: 'navigate',
                    params: { url: 'https://httpbin.org/html' }
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
                        params: { limit: 5 }
                    }
                };
                ws.send(JSON.stringify(captureCommand));
            }, 3000);

            // Generate JavaScript console errors that we SHOULD be able to capture
            setTimeout(() => {
                console.log('\n📍 STEP 3: Generating JavaScript console errors...');
                console.log('🔍 EXPECT TO SEE IN BROWSER CONSOLE:');
                console.log('   - "Manual console.error test"');
                console.log('   - "Manual console.warn test"');
                console.log('   - "Manual console.log test"');
                console.log('   - JavaScript error from invalid code');
                
                const jsCommand = {
                    id: requestId++,
                    command: {
                        type: 'execute_console',
                        params: { 
                            code: `
                                // These should be captured by our console override
                                console.error('Manual console.error test');
                                console.warn('Manual console.warn test');  
                                console.log('Manual console.log test');
                                console.info('Manual console.info test');
                                
                                // Try to trigger a JavaScript error
                                try {
                                    nonExistentFunction();
                                } catch (e) {
                                    console.error('Caught JavaScript error:', e.message);
                                }
                                
                                // Return success
                                return 'Console tests completed';
                            `
                        }
                    }
                };
                ws.send(JSON.stringify(jsCommand));
            }, 6000);

            // Get console logs to see what was captured
            setTimeout(() => {
                console.log('\n📍 STEP 4: Retrieving captured console logs...');
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
                console.log('\n✅ Console error type test completed!');
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
                            console.log('   ✅ Console capture installed');
                            break;
                        case 3:
                            console.log('   ✅ JavaScript console tests executed');
                            console.log(`   📤 Result: ${message.result.result}`);
                            break;
                        case 4:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} console logs`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 CAPTURED CONSOLE LOGS:');
                                console.log('   ' + '='.repeat(80));
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                                    if (log.args && log.args.length > 0) {
                                        console.log(`      Args: ${log.args.join(', ')}`);
                                    }
                                });
                                console.log('   ' + '='.repeat(80));
                                
                                // Check for our manual test messages
                                const manualTests = message.result.logs.filter(log => 
                                    log.message.includes('Manual console')
                                );
                                
                                if (manualTests.length > 0) {
                                    console.log(`\n   🎉 SUCCESS! Captured ${manualTests.length} manual console messages!`);
                                    console.log('   ✅ Console capture is working for JavaScript-generated messages');
                                    console.log('   💡 GitHub CSP errors might be browser-native, not JavaScript console calls');
                                } else {
                                    console.log('\n   ❌ Failed to capture manual console messages');
                                    console.log('   🔍 Console capture system may not be working');
                                }
                            } else {
                                console.log('\n   ❌ NO CONSOLE LOGS CAPTURED');
                                console.log('   🚨 Console capture system is not working properly');
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
    testConsoleErrorTypes().catch(console.error);
}