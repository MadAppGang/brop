#!/usr/bin/env node
/**
 * Test both get_console_logs (page) and get_plugin_console_logs (extension) BROP commands
 */

const WebSocket = require('ws');

async function testBothConsoleLogs() {
    console.log('🌐 Testing Both Console Log BROP Commands');
    console.log('==========================================');

    const ws = new WebSocket('ws://localhost:9223'); // BROP port
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', async () => {
            console.log('✅ Connected to BROP bridge');

            // Test 1: Navigate to a test page first
            console.log('\n🌐 Test 1: Navigating to Wikipedia...');
            const navCommand = {
                id: requestId++,
                command: {
                    type: 'navigate',
                    params: { url: 'https://en.wikipedia.org/wiki/JavaScript' }
                }
            };
            ws.send(JSON.stringify(navCommand));

            // Wait for navigation, then continue with tests
            setTimeout(() => {
                // Test 2: Generate some console output on the page
                console.log('\n🔍 Test 2: Generating console output on page...');
                const jsCommand = {
                    id: requestId++,
                    command: {
                        type: 'execute_console',
                        params: { 
                            code: `
                                console.log('Test log message from page');
                                console.warn('Test warning from page');
                                console.error('Test error from page');
                                console.info('Test info from page');
                                'Console output generated'
                            `
                        }
                    }
                };
                ws.send(JSON.stringify(jsCommand));
            }, 3000);

            // Test 3: Get page console logs
            setTimeout(() => {
                console.log('\n📜 Test 3: Getting page console logs...');
                const pageLogsCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 20 }
                    }
                };
                ws.send(JSON.stringify(pageLogsCommand));
            }, 6000);

            // Test 4: Get plugin console logs
            setTimeout(() => {
                console.log('\n🔧 Test 4: Getting plugin console logs...');
                const pluginLogsCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_plugin_console_logs',
                        params: { limit: 10 }
                    }
                };
                ws.send(JSON.stringify(pluginLogsCommand));
            }, 9000);

            // Test 5: Get filtered page console logs (errors only)
            setTimeout(() => {
                console.log('\n❌ Test 5: Getting page console logs (errors only)...');
                const errorLogsCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 10, level: 'error' }
                    }
                };
                ws.send(JSON.stringify(errorLogsCommand));
            }, 12000);

            // Close test
            setTimeout(() => {
                console.log('\n✅ All console log tests completed!');
                ws.close();
                resolve();
            }, 15000);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📥 Response ${message.id}:`, message.success ? '✅' : '❌');
                
                if (message.success && message.result) {
                    const result = message.result;
                    
                    switch (message.id) {
                        case 1: // Navigation
                            console.log('   ✅ Navigation completed');
                            break;
                            
                        case 2: // JavaScript execution
                            console.log('   ✅ Console output generated on page');
                            break;
                            
                        case 3: // Page console logs
                            console.log(`   ✅ Retrieved ${result.logs.length} page console logs`);
                            console.log(`   📊 Source: ${result.source}`);
                            console.log(`   🌐 Tab: ${result.tab_title}`);
                            console.log(`   📄 URL: ${result.tab_url}`);
                            
                            if (result.logs.length > 0) {
                                console.log('\n   📋 Recent page console logs:');
                                result.logs.slice(0, 3).forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                                });
                            }
                            break;
                            
                        case 4: // Plugin console logs
                            console.log(`   ✅ Retrieved ${result.logs.length} plugin console logs`);
                            console.log(`   📊 Source: ${result.source}`);
                            console.log(`   💾 Total stored: ${result.total_stored}`);
                            
                            if (result.logs.length > 0) {
                                console.log('\n   📋 Recent plugin console logs:');
                                result.logs.slice(0, 3).forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                                });
                            }
                            break;
                            
                        case 5: // Filtered page console logs
                            console.log(`   ✅ Retrieved ${result.logs.length} error logs from page`);
                            console.log(`   🔍 Filter: ${result.filter_level}`);
                            
                            if (result.logs.length > 0) {
                                console.log('\n   📋 Page error logs:');
                                result.logs.forEach((log, index) => {
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

// Run the test
if (require.main === module) {
    testBothConsoleLogs().catch(console.error);
}