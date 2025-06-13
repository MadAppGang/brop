#!/usr/bin/env node
/**
 * Test the get_console_logs BROP command with proper tabId handling
 */

const WebSocket = require('ws');
const { createBROPConnection } = require('../../test-utils');

async function testConsoleLogs() {
    console.log('🌐 Testing BROP get_console_logs command');
    console.log('=========================================');

    const ws = createBROPConnection(); // BROP port
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
                console.log('📥 Response:', message.id, message.success ? '✅' : '❌');
                
                if (message.id === 1 && message.success) {
                    // Handle tabs list response
                    const tabs = message.result.tabs || [];
                    console.log(`   ✅ Found ${tabs.length} tabs`);
                    
                    // Find an accessible tab (not chrome://)
                    const accessibleTab = tabs.find(tab => tab.accessible && tab.url !== 'about:blank');
                    
                    if (!accessibleTab) {
                        console.log('\n🔧 No accessible tabs found, creating a new tab...');
                        const createTabCommand = {
                            id: requestId++,
                            method: 'create_tab',
                            params: { url: 'https://example.com' }
                        };
                        ws.send(JSON.stringify(createTabCommand));
                        return;
                    }
                    
                    // Use the accessible tab
                    currentTabId = accessibleTab.tabId;
                    console.log(`   🎯 Using tab ${currentTabId}: ${accessibleTab.title}`);
                    
                    // Step 2: Test get_console_logs with tabId
                    console.log('\n📜 Step 2: Getting console logs...');
                    const logCommand = {
                        id: requestId++,
                        method: 'get_console_logs',
                        params: { 
                            tabId: currentTabId,
                            limit: 50 
                        }
                    };
                    ws.send(JSON.stringify(logCommand));
                    
                } else if (message.success && message.result && message.result.tabId) {
                    // Handle tab creation response
                    currentTabId = message.result.tabId;
                    console.log(`   ✅ Created new tab ${currentTabId}`);
                    
                    // Now test console logs
                    console.log('\n📜 Step 2: Getting console logs...');
                    const logCommand = {
                        id: requestId++,
                        method: 'get_console_logs',
                        params: { 
                            tabId: currentTabId,
                            limit: 50 
                        }
                    };
                    ws.send(JSON.stringify(logCommand));
                    
                } else if (message.success && message.result && message.result.logs) {
                    // Handle console logs response
                    const result = message.result;
                    console.log(`   ✅ Retrieved ${result.logs.length} console logs`);
                    console.log(`   📊 Source: ${result.source || 'extension'}`);
                    console.log(`   💾 Total stored: ${result.total_stored || result.logs.length}`);
                    
                    if (result.logs.length > 0) {
                        console.log('\n📋 Recent console logs:');
                        console.log('-'.repeat(60));
                        result.logs.slice(0, 5).forEach((log, index) => {
                            const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A';
                            const level = (log.level || 'info').toUpperCase();
                            const message = log.message || log.text || 'No message';
                            console.log(`${index + 1}. [${time}] ${level}: ${message}`);
                            if (log.args && log.args.length > 0) {
                                console.log(`   Args: ${log.args.join(', ')}`);
                            }
                        });
                        console.log('-'.repeat(60));
                    } else {
                        console.log('   ℹ️  No console logs captured yet');
                    }
                    
                    // Test completed successfully
                    setTimeout(() => {
                        console.log('\n✅ Console logs test completed successfully!');
                        ws.close();
                        resolve();
                    }, 1000);
                    
                } else if (!message.success) {
                    console.log('   ❌ Error:', message.error);
                    
                    // Close on error
                    setTimeout(() => {
                        console.log('\n❌ Console logs test failed!');
                        ws.close();
                        resolve();
                    }, 1000);
                }

            } catch (error) {
                console.log('📝 Raw response:', data.toString());
                console.log('❌ Parse error:', error.message);
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