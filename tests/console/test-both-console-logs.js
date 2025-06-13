#!/usr/bin/env node
/**
 * Test console logs BROP commands with proper tabId handling
 */

const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

async function testBothConsoleLogs() {
    console.log('🌐 Testing Console Log BROP Commands');
    console.log('=====================================');

    const ws = createBROPConnection();
    let requestId = 1;
    let currentTabId = null;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Step 1: Get available tabs or create one
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
                console.log(`📥 Response ${message.id}:`, message.success ? '✅' : '❌');
                
                if (message.id === 1 && message.success) {
                    // Handle tabs list response
                    const tabs = message.result.tabs || [];
                    console.log(`   ✅ Found ${tabs.length} tabs`);
                    
                    const accessibleTab = tabs.find(tab => tab.accessible && tab.url !== 'about:blank');
                    
                    if (!accessibleTab) {
                        console.log('\n🔧 Creating new tab for testing...');
                        const createTabCommand = {
                            id: requestId++,
                            method: 'create_tab',
                            params: { url: 'https://en.wikipedia.org/wiki/JavaScript' }
                        };
                        ws.send(JSON.stringify(createTabCommand));
                        return;
                    }
                    
                    currentTabId = accessibleTab.tabId;
                    console.log(`   🎯 Using tab ${currentTabId}: ${accessibleTab.title}`);
                    
                    // Navigate to test page
                    console.log('\n🌐 Step 2: Navigating to Wikipedia...');
                    const navCommand = {
                        id: requestId++,
                        method: 'navigate',
                        params: { 
                            tabId: currentTabId,
                            url: 'https://en.wikipedia.org/wiki/JavaScript' 
                        }
                    };
                    ws.send(JSON.stringify(navCommand));
                    
                } else if (message.success && message.result && message.result.tabId) {
                    // Handle tab creation response
                    currentTabId = message.result.tabId;
                    console.log(`   ✅ Created new tab ${currentTabId}`);
                    
                    // No need to navigate since create_tab already navigated
                    // Generate console output
                    setTimeout(() => {
                        console.log('\n🔍 Step 3: Generating console output...');
                        const jsCommand = {
                            id: requestId++,
                            method: 'execute_console',
                            params: { 
                                tabId: currentTabId,
                                code: `
                                    console.log('Test log message from page');
                                    console.warn('Test warning from page');
                                    console.error('Test error from page');
                                    console.info('Test info from page');
                                    'Console output generated'
                                `
                            }
                        };
                        ws.send(JSON.stringify(jsCommand));
                    }, 2000);
                    
                } else if (message.success && message.id >= 2) {
                    // Handle subsequent responses
                    if (message.id === 2 || (message.result && !message.result.logs)) {
                        // Navigation or JS execution completed
                        if (!message.result.logs) {
                            console.log('   ✅ Operation completed');
                            
                            // Get console logs after a short delay
                            setTimeout(() => {
                                console.log('\n📜 Step 4: Getting console logs...');
                                const logsCommand = {
                                    id: requestId++,
                                    method: 'get_console_logs',
                                    params: { 
                                        tabId: currentTabId,
                                        limit: 20 
                                    }
                                };
                                ws.send(JSON.stringify(logsCommand));
                            }, 2000);
                        }
                    } else if (message.result && message.result.logs) {
                        // Handle console logs response
                        const result = message.result;
                        console.log(`   ✅ Retrieved ${result.logs.length} console logs`);
                        console.log(`   📊 Source: ${result.source || 'extension'}`);
                        
                        if (result.logs.length > 0) {
                            console.log('\n   📋 Recent console logs:');
                            result.logs.slice(0, 5).forEach((log, index) => {
                                const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A';
                                const level = (log.level || 'info').toUpperCase();
                                const msg = log.message || log.text || 'No message';
                                console.log(`   ${index + 1}. [${time}] ${level}: ${msg}`);
                            });
                        } else {
                            console.log('   ℹ️  No console logs captured');
                        }
                        
                        // Test completed
                        setTimeout(() => {
                            console.log('\n✅ All console log tests completed!');
                            ws.close();
                            resolve();
                        }, 1000);
                    }
                } else if (!message.success) {
                    console.log('   ❌ Error:', message.error);
                    
                    // Continue to next step or close on critical error
                    if (message.error.includes('Unsupported BROP command')) {
                        console.log('   ⚠️  Command not supported, continuing...');
                        
                        setTimeout(() => {
                            console.log('\n📜 Getting console logs...');
                            const logsCommand = {
                                id: requestId++,
                                method: 'get_console_logs',
                                params: { 
                                    tabId: currentTabId,
                                    limit: 20 
                                }
                            };
                            ws.send(JSON.stringify(logsCommand));
                        }, 1000);
                    } else {
                        setTimeout(() => {
                            console.log('\n❌ Test failed!');
                            ws.close();
                            resolve();
                        }, 1000);
                    }
                }

            } catch (error) {
                console.log('📝 Raw response:', data.toString().substring(0, 200) + '...');
                console.log('❌ Parse error:', error.message);
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