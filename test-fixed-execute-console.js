#!/usr/bin/env node
/**
 * Test the fixed execute_console (no more eval!) 
 */

const WebSocket = require('ws');

async function testFixedExecuteConsole() {
    console.log('🧪 Testing Fixed execute_console (No Eval)');
    console.log('==========================================');
    console.log('👀 Please open Chrome DevTools (F12) -> Console tab');
    console.log('');

    const ws = new WebSocket('ws://localhost:9223');
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Navigate to a simple site
            console.log('\n📍 STEP 1: Navigating to a simple test site...');
            const navCommand = {
                id: requestId++,
                command: {
                    type: 'navigate',
                    params: { url: 'https://jsonplaceholder.typicode.com/' }
                }
            };
            ws.send(JSON.stringify(navCommand));

            // Install console capture first
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

            // Test the fixed execute_console
            setTimeout(() => {
                console.log('\n📍 STEP 3: Testing execute_console (should work now!)...');
                console.log('🔍 EXPECT TO SEE IN BROWSER CONSOLE:');
                console.log('   - "BROP TEST: Hello world!"');
                console.log('   - "BROP TEST: Warning message"');
                console.log('   - "BROP TEST: Error message"');
                console.log('   - "BROP TEST: Current URL is..."');
                
                const jsCommand = {
                    id: requestId++,
                    command: {
                        type: 'execute_console',
                        params: { 
                            code: `
                                console.log('BROP TEST: Hello world!');
                                console.warn('BROP TEST: Warning message');
                                console.error('BROP TEST: Error message');
                                console.log('BROP TEST: Current URL is', window.location.href);
                                return 'Execute console test completed successfully';
                            `
                        }
                    }
                };
                ws.send(JSON.stringify(jsCommand));
            }, 6000);

            // Get console logs to see what was captured
            setTimeout(() => {
                console.log('\n📍 STEP 4: Getting captured console logs...');
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
                console.log('\n✅ Fixed execute_console test completed!');
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
                            console.log('   ✅ execute_console completed successfully!');
                            console.log(`   📤 Returned: ${message.result.result}`);
                            console.log('   🎉 No more eval() errors!');
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
                                
                                // Check for our test messages
                                const bropTestMessages = message.result.logs.filter(log => 
                                    log.message && log.message.includes('BROP TEST:')
                                );
                                
                                if (bropTestMessages.length > 0) {
                                    console.log(`   🎉 SUCCESS! Found ${bropTestMessages.length} BROP TEST messages!`);
                                    console.log('   ✅ execute_console is working without eval!');
                                    console.log('   ✅ Console capture is working!');
                                } else {
                                    console.log('   ⚠️  No BROP TEST messages found');
                                }
                            } else {
                                console.log('   ℹ️  No console logs captured');
                            }
                            break;
                    }
                } else if (!message.success) {
                    console.log('   ❌ Error:', message.error);
                    
                    if (message.error && message.error.includes('eval')) {
                        console.log('   🔍 Still seeing eval errors - the fix may not be active yet');
                    }
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
    testFixedExecuteConsole().catch(console.error);
}