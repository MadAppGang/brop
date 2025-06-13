#!/usr/bin/env node
/**
 * Test the simplified DOM feature specifically with proper BROP commands
 */

const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

async function testSimplifiedDOM() {
    console.log('🌳 Testing BROP Simplified DOM Feature');
    console.log('=========================================');

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
                    
                    // Test simplified DOM
                    setTimeout(() => {
                        testSimplifiedDOMCommand();
                    }, 1000);
                    
                } else if (message.success && message.result && message.result.tabId && !currentTabId) {
                    // Handle tab creation
                    currentTabId = message.result.tabId;
                    console.log(`   ✅ Created tab ${currentTabId}`);
                    
                    setTimeout(() => {
                        testSimplifiedDOMCommand();
                    }, 3000);
                    
                } else if (message.success && currentTabId && message.id === 2) {
                    // Handle simplified DOM response
                    console.log('✅ Simplified DOM command successful!');
                    
                    if (message.result) {
                        const result = message.result;
                        console.log('\n📊 SIMPLIFIED DOM RESULTS:');
                        console.log('==========================');
                        console.log(`   Format: ${result.format || 'N/A'}`);
                        console.log(`   Content length: ${result.content?.length || 0} characters`);
                        console.log(`   Source: ${result.source || 'N/A'}`);
                        console.log(`   Title: ${result.title || 'N/A'}`);
                        console.log(`   URL: ${result.url || 'N/A'}`);
                        
                        if (result.content && result.content.length > 0) {
                            console.log('\n📋 Content preview:');
                            console.log(result.content.substring(0, 200) + '...');
                        }
                        
                        console.log('\n🎉 SIMPLIFIED DOM TEST SUCCESSFUL!');
                        console.log('✅ Content extraction working');
                        console.log('✅ DOM processing functional');
                        console.log('✅ BROP simplified DOM feature operational');
                        
                    } else {
                        console.log('⚠️  No result data returned');
                    }
                    
                    setTimeout(() => {
                        console.log('\n🎯 Simplified DOM test complete!');
                        ws.close();
                        resolve();
                    }, 500);
                    
                } else if (!message.success) {
                    console.log(`   ❌ Error: ${message.error}`);
                    
                    if (message.error.includes('tabId is required')) {
                        console.log('   🔧 TabId parameter now required for DOM commands');
                    } else if (message.error.includes('Unsupported BROP command')) {
                        console.log('   🔧 Simplified DOM handler may need extension reload');
                    }
                    
                    setTimeout(() => {
                        if (message.id === 1) {
                            console.log('\n❌ No tabs available for testing');
                        } else {
                            console.log('\n🎯 Simplified DOM test completed with errors');
                        }
                        ws.close();
                        resolve();
                    }, 500);
                }
            } catch (error) {
                console.log('📝 Parse error:', error.message);
            }
        });

        function testSimplifiedDOMCommand() {
            console.log('\n📋 Step 2: Testing simplified DOM extraction...');
            const domCommand = {
                id: requestId++,
                method: 'get_simplified_dom',
                params: {
                    tabId: currentTabId,
                    format: 'markdown',
                    max_depth: 3,
                    include_hidden: false
                }
            };
            
            console.log('   📤 Sending simplified DOM request...');
            ws.send(JSON.stringify(domCommand));
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
            console.log('⏰ Test timeout');
            ws.close();
            resolve();
        }, 15000);
    });
}

// Run the test
if (require.main === module) {
    testSimplifiedDOM().catch(console.error);
}