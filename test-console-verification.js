#!/usr/bin/env node
/**
 * Console verification test - generates predictable console output
 * for manual verification in browser developer tools
 */

const WebSocket = require('ws');

async function testConsoleVerification() {
    console.log('🧪 Console Verification Test');
    console.log('============================');
    console.log('👀 Please open Chrome DevTools (F12) -> Console tab');
    console.log('📋 Watch for console output during this test');
    console.log('');

    const ws = new WebSocket('ws://localhost:9223');
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Step 1: Navigate to a simple test page
            console.log('\n📍 STEP 1: Navigating to httpbin.org (good for testing)...');
            const navCommand = {
                id: requestId++,
                command: {
                    type: 'navigate',
                    params: { url: 'https://httpbin.org/' }
                }
            };
            ws.send(JSON.stringify(navCommand));

            // Step 2: Install console capture first
            setTimeout(() => {
                console.log('\n📍 STEP 2: Installing console capture on page...');
                const captureCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 1 }
                    }
                };
                ws.send(JSON.stringify(captureCommand));
            }, 3000);

            // Step 3: Generate console output using script injection
            setTimeout(() => {
                console.log('\n📍 STEP 3: Generating console output on page...');
                console.log('🔍 EXPECT TO SEE IN BROWSER CONSOLE:');
                console.log('   - "BROP TEST: Hello from the page!"');
                console.log('   - "BROP TEST: Warning message"');
                console.log('   - "BROP TEST: Error message"');
                console.log('   - "BROP TEST: Info message"');
                console.log('   - "BROP TEST: URL is https://httpbin.org/"');
                
                const jsCommand = {
                    id: requestId++,
                    command: {
                        type: 'execute_console',
                        params: { 
                            code: `
                                console.log('BROP TEST: Hello from the page!');
                                console.warn('BROP TEST: Warning message');
                                console.error('BROP TEST: Error message');
                                console.info('BROP TEST: Info message');
                                console.log('BROP TEST: URL is', window.location.href);
                                'Console output completed'
                            `
                        }
                    }
                };
                ws.send(JSON.stringify(jsCommand));
            }, 6000);

            // Step 4: Retrieve page console logs
            setTimeout(() => {
                console.log('\n📍 STEP 4: Retrieving page console logs...');
                const pageLogsCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 20 }
                    }
                };
                ws.send(JSON.stringify(pageLogsCommand));
            }, 9000);

            // Step 5: Get plugin console logs
            setTimeout(() => {
                console.log('\n📍 STEP 5: Getting plugin console logs...');
                const pluginLogsCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_plugin_console_logs',
                        params: { limit: 10 }
                    }
                };
                ws.send(JSON.stringify(pluginLogsCommand));
            }, 12000);

            // Step 6: Get filtered logs (errors only)
            setTimeout(() => {
                console.log('\n📍 STEP 6: Getting error logs only...');
                const errorLogsCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 10, level: 'error' }
                    }
                };
                ws.send(JSON.stringify(errorLogsCommand));
            }, 15000);

            // Close
            setTimeout(() => {
                console.log('\n✅ Console verification test completed!');
                console.log('📋 Please compare browser console with captured logs above');
                ws.close();
                resolve();
            }, 18000);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📥 Response ${message.id}:`, message.success ? '✅' : '❌');
                
                if (message.success && message.result) {
                    switch (message.id) {
                        case 1:
                            console.log('   ✅ Navigation to httpbin.org completed');
                            break;
                            
                        case 2:
                            console.log('   ✅ Console capture installed on page');
                            console.log(`   📊 Initial logs: ${message.result.logs.length}`);
                            break;
                            
                        case 3:
                            console.log('   ✅ Console output generated on page');
                            console.log('   🔍 Check browser console for the "BROP TEST:" messages');
                            break;
                            
                        case 4:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} page console logs`);
                            console.log(`   📊 Source: ${message.result.source}`);
                            console.log(`   🌐 Tab: ${message.result.tab_title}`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 CAPTURED PAGE CONSOLE LOGS:');
                                console.log('   ' + '='.repeat(50));
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                                    if (log.args && log.args.length > 0) {
                                        console.log(`      Args: ${log.args.join(', ')}`);
                                    }
                                });
                                console.log('   ' + '='.repeat(50));
                            } else {
                                console.log('   ⚠️  No page console logs captured');
                            }
                            break;
                            
                        case 5:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} plugin console logs`);
                            console.log(`   📊 Source: ${message.result.source}`);
                            console.log(`   💾 Total stored: ${message.result.total_stored}`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 RECENT PLUGIN CONSOLE LOGS:');
                                console.log('   ' + '='.repeat(50));
                                message.result.logs.slice(0, 5).forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                                });
                                console.log('   ' + '='.repeat(50));
                            }
                            break;
                            
                        case 6:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} error logs`);
                            console.log(`   🔍 Filter: ${message.result.filter_level}`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 FILTERED ERROR LOGS:');
                                console.log('   ' + '='.repeat(50));
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                                });
                                console.log('   ' + '='.repeat(50));
                            } else {
                                console.log('   ℹ️  No error logs found');
                            }
                            break;
                    }
                } else if (!message.success) {
                    console.log('   ❌ Error:', message.error);
                }
            } catch (error) {
                console.log('📝 Raw response:', data.toString().substring(0, 200) + '...');
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

if (require.main === module) {
    testConsoleVerification().catch(console.error);
}