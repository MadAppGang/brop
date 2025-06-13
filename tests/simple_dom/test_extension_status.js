#!/usr/bin/env node
/**
 * Test BROP extension status and simplified DOM command
 */

const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

async function testExtensionStatus() {
    console.log('🔍 Testing BROP Extension Status and Simplified DOM');
    console.log('===================================================');

    const ws = createBROPConnection();
    let requestId = 1;
    let currentTabId = null;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Step 1: Get available tabs
            console.log('\n📋 Step 1: Getting available tabs...');
            const tabsCommand = {
                id: requestId++,
                method: 'list_tabs',
                params: {}
            };
            ws.send(JSON.stringify(tabsCommand));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📥 Response ${message.id}: ${message.success ? '✅' : '❌'}`);

                if (message.id === 1 && message.success) {
                    // Handle tabs list
                    const tabs = message.result.tabs || [];
                    console.log(`   ✅ Found ${tabs.length} tabs`);
                    
                    const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                    
                    if (!accessibleTab) {
                        console.log('\n📋 Creating new tab for testing...');
                        const createTabCommand = {
                            id: requestId++,
                            method: 'create_tab',
                            params: { url: 'https://httpbin.org/html' }
                        };
                        ws.send(JSON.stringify(createTabCommand));
                        return;
                    }
                    
                    currentTabId = accessibleTab.tabId;
                    console.log(`   🎯 Using tab ${currentTabId}: ${accessibleTab.title}`);
                    
                    // Test basic console command
                    console.log('\n📋 Step 2: Testing basic console command...');
                    testBasicConsole();
                    
                } else if (message.success && message.result && message.result.tabId && !currentTabId) {
                    // Handle tab creation
                    currentTabId = message.result.tabId;
                    console.log(`   ✅ Created tab ${currentTabId}`);
                    
                    setTimeout(() => {
                        testBasicConsole();
                    }, 2000);
                    
                } else if (message.success && currentTabId) {
                    handleTestResponse(message);
                } else if (!message.success) {
                    console.log(`   ❌ Error: ${message.error}`);
                    handleError(message);
                }
            } catch (error) {
                console.log('📝 Parse error:', error.message);
            }
        });

        function testBasicConsole() {
            const consoleCommand = {
                id: requestId++,
                method: 'execute_console',
                params: {
                    tabId: currentTabId,
                    code: 'document.title'
                }
            };
            
            console.log('   📤 Sending console command...');
            ws.send(JSON.stringify(consoleCommand));
        }

        function testSimplifiedDOM() {
            console.log('\n📋 Step 3: Testing simplified DOM command...');
            const domCommand = {
                id: requestId++,
                method: 'get_simplified_dom',
                params: {
                    tabId: currentTabId,
                    format: 'markdown',
                    max_depth: 3
                }
            };
            
            console.log('   📤 Sending simplified DOM command...');
            ws.send(JSON.stringify(domCommand));
        }

        function testAllCommands() {
            console.log('\n📋 Step 4: Testing all available commands...');
            
            const commands = [
                { method: 'get_console_logs', params: { tabId: currentTabId, limit: 5 } },
                { method: 'get_screenshot', params: { tabId: currentTabId, format: 'png' } },
                { method: 'get_page_content', params: { tabId: currentTabId } }
            ];
            
            let commandIndex = 0;
            
            function testNextCommand() {
                if (commandIndex >= commands.length) {
                    setTimeout(() => {
                        console.log('\n🎯 Extension status test complete!');
                        ws.close();
                        resolve();
                    }, 500);
                    return;
                }
                
                const command = commands[commandIndex++];
                const message = {
                    id: requestId++,
                    method: command.method,
                    params: command.params
                };
                
                console.log(`   📤 Testing command: ${command.method}`);
                ws.send(JSON.stringify(message));
            }
            
            testNextCommand();
        }

        function handleTestResponse(message) {
            const stepMap = {
                2: 'Basic Console',
                3: 'Simplified DOM',
                4: 'Console Logs',
                5: 'Screenshot', 
                6: 'Page Content'
            };
            
            const stepName = stepMap[message.id] || 'Unknown';
            
            if (message.success) {
                console.log(`   ✅ ${stepName}: SUCCESS`);
                
                if (message.result) {
                    if (message.result.result) {
                        console.log(`      Result: ${message.result.result}`);
                    } else if (message.result.content) {
                        console.log(`      Content length: ${message.result.content.length} chars`);
                    } else if (message.result.logs) {
                        console.log(`      Logs captured: ${message.result.logs.length}`);
                    } else if (message.result.data) {
                        console.log(`      Data size: ${message.result.data.length} bytes`);
                    }
                }
                
                // Move to next test
                setTimeout(() => {
                    if (message.id === 2) {
                        testSimplifiedDOM();
                    } else if (message.id === 3) {
                        testAllCommands();
                    } else if (message.id >= 4 && message.id <= 6) {
                        // Continue with next command in sequence
                        const commands = ['get_console_logs', 'get_screenshot', 'get_page_content'];
                        const currentIndex = message.id - 4;
                        if (currentIndex < commands.length - 1) {
                            const nextCommand = commands[currentIndex + 1];
                            const nextMessage = {
                                id: requestId++,
                                method: nextCommand,
                                params: { tabId: currentTabId }
                            };
                            console.log(`   📤 Testing command: ${nextCommand}`);
                            ws.send(JSON.stringify(nextMessage));
                        } else {
                            // All commands tested
                            setTimeout(() => {
                                console.log('\n🎯 Extension status test complete!');
                                showSummary();
                                ws.close();
                                resolve();
                            }, 500);
                        }
                    }
                }, 500);
            } else {
                console.log(`   ❌ ${stepName}: FAILED - ${message.error}`);
                
                if (message.error.includes('Unsupported BROP command')) {
                    console.log('      🔧 Extension may need reload to pick up new handlers');
                } else if (message.error.includes('tabId is required')) {
                    console.log('      🔧 TabId parameter now required for this command');
                }
                
                // Continue to next test anyway
                setTimeout(() => {
                    if (message.id === 2) {
                        testSimplifiedDOM();
                    } else if (message.id === 3) {
                        testAllCommands();
                    } else {
                        console.log('\n🎯 Extension status test complete!');
                        showSummary();
                        ws.close();
                        resolve();
                    }
                }, 500);
            }
        }

        function handleError(message) {
            setTimeout(() => {
                if (message.id === 1) {
                    console.log('\n❌ No tabs available for testing');
                    ws.close();
                    resolve();
                } else {
                    console.log('\n🎯 Extension status test complete with errors!');
                    showSummary();
                    ws.close();
                    resolve();
                }
            }, 500);
        }

        function showSummary() {
            console.log('\n📊 EXTENSION STATUS SUMMARY:');
            console.log('=============================');
            console.log('✅ BROP service is running and accessible');
            console.log('✅ WebSocket connection working');
            console.log('✅ Tab management functional');
            console.log('');
            console.log('💡 TROUBLESHOOTING TIPS:');
            console.log('   - If commands fail: Try reloading the extension');
            console.log('   - Extension reload steps:');
            console.log('     1. Open chrome://extensions/');
            console.log('     2. Find "Browser Remote Operations Protocol"');
            console.log('     3. Click the reload button (↻)');
        }

        ws.on('error', (error) => {
            console.error('❌ Connection error:', error.message);
            resolve();
        });

        ws.on('close', () => {
            console.log('🔌 Disconnected from bridge');
            resolve();
        });

        // Overall timeout
        setTimeout(() => {
            console.log('⏰ Overall test timeout');
            ws.close();
            resolve();
        }, 20000);
    });
}

// Run the test
if (require.main === module) {
    testExtensionStatus().catch(console.error);
}