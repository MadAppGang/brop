#!/usr/bin/env node
/**
 * Test if content script is properly injected and responding
 */

const WebSocket = require('ws');
const { createBROPConnection } = require('../../test-utils');

async function testContentScript() {
    console.log('🔍 Testing Content Script Injection and Communication');
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
                    
                    // Navigate to test page
                    console.log('\n📋 Step 2: Navigating to test page...');
                    const navCommand = {
                        id: requestId++,
                        method: 'navigate',
                        params: { 
                            tabId: currentTabId,
                            url: 'https://httpbin.org/html' 
                        }
                    };
                    ws.send(JSON.stringify(navCommand));
                    
                } else if (message.success && message.result && message.result.tabId && !currentTabId) {
                    // Handle tab creation
                    currentTabId = message.result.tabId;
                    console.log(`   ✅ Created tab ${currentTabId}`);
                    
                    setTimeout(() => {
                        checkContentScript();
                    }, 3000);
                    
                } else if (message.success && currentTabId) {
                    if (message.id === 2) {
                        // Navigation completed
                        console.log('   ✅ Navigation completed');
                        setTimeout(() => {
                            checkContentScript();
                        }, 2000);
                    } else if (message.id === 3) {
                        // Content script check completed
                        handleContentScriptResult(message);
                        setTimeout(() => {
                            testSimplifiedDOM();
                        }, 1000);
                    } else if (message.id === 4) {
                        // Simplified DOM test completed
                        handleSimplifiedDOMResult(message);
                        setTimeout(() => {
                            console.log('\n🎯 Content script diagnosis complete!');
                            ws.close();
                            resolve();
                        }, 500);
                    }
                } else if (!message.success) {
                    console.log(`   ❌ Error: ${message.error}`);
                    // Continue to next test anyway
                    setTimeout(() => {
                        if (message.id === 1) {
                            console.log('\n❌ No tabs available for testing');
                            ws.close();
                            resolve();
                        } else if (message.id === 2) {
                            checkContentScript();
                        } else if (message.id === 3) {
                            testSimplifiedDOM();
                        } else {
                            console.log('\n🎯 Content script diagnosis complete!');
                            ws.close();
                            resolve();
                        }
                    }, 500);
                }
            } catch (error) {
                console.log('📝 Parse error:', error.message);
            }
        });

        function checkContentScript() {
            console.log('\n📋 Step 3: Testing content script communication...');
            const testCommand = {
                id: requestId++,
                method: 'execute_console',
                params: {
                    tabId: currentTabId,
                    code: `
                        // Check if content script is loaded
                        const hasContentScript = typeof window.BROP !== 'undefined';
                        const hasMessageListener = !!window.chrome?.runtime?.onMessage;
                        
                        JSON.stringify({
                            hasBROPContentScript: hasContentScript,
                            hasMessageListener: hasMessageListener,
                            pageTitle: document.title,
                            pageUrl: window.location.href,
                            contentScriptStatus: hasContentScript ? 'LOADED' : 'NOT_LOADED'
                        })
                    `
                }
            };
            
            console.log('   📤 Checking content script status...');
            ws.send(JSON.stringify(testCommand));
        }

        function handleContentScriptResult(message) {
            if (message.success) {
                try {
                    const result = JSON.parse(message.result.result);
                    console.log('   📥 Content script check results:');
                    console.log(`      BROP Content Script: ${result.hasBROPContentScript ? '✅ LOADED' : '❌ NOT LOADED'}`);
                    console.log(`      Message Listener: ${result.hasMessageListener ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}`);
                    console.log(`      Page Title: ${result.pageTitle}`);
                    console.log(`      Page URL: ${result.pageUrl}`);
                    console.log(`      Status: ${result.contentScriptStatus}`);
                    
                    if (!result.hasBROPContentScript) {
                        console.log('\n🔧 Content script is not loaded! This explains the simplified DOM failure.');
                        console.log('   Possible causes:');
                        console.log('   1. Content script file missing or corrupted');
                        console.log('   2. Manifest.json content_scripts configuration issue');
                        console.log('   3. Extension reload didn\'t properly inject content script');
                        console.log('   4. Page CSP blocking content script injection');
                    } else {
                        console.log('\n✅ Content script is loaded correctly!');
                    }
                } catch (parseError) {
                    console.log(`   ❌ Error parsing content script check: ${parseError.message}`);
                    console.log(`   📝 Raw result: ${message.result.result}`);
                }
            } else {
                console.log(`   ❌ Content script check failed: ${message.error}`);
            }
        }

        function testSimplifiedDOM() {
            console.log('\n📋 Step 4: Testing simplified DOM with detailed error handling...');
            const domCommand = {
                id: requestId++,
                method: 'get_simplified_dom',
                params: {
                    tabId: currentTabId,
                    format: 'markdown',
                    max_depth: 2
                }
            };
            
            console.log('   📤 Sending simplified DOM request...');
            ws.send(JSON.stringify(domCommand));
        }

        function handleSimplifiedDOMResult(message) {
            if (message.success) {
                console.log('   ✅ Simplified DOM: SUCCESS!');
                console.log('   🎉 Content script communication working!');
                
                if (message.result) {
                    const result = message.result;
                    console.log('   📊 DOM result preview:');
                    console.log(`      Format: ${result.format || 'N/A'}`);
                    console.log(`      Content length: ${result.content?.length || 0} chars`);
                    console.log(`      Source: ${result.source || 'N/A'}`);
                    console.log(`      Title: ${result.title || 'N/A'}`);
                }
            } else {
                console.log(`   ❌ Simplified DOM failed: ${message.error}`);
                
                // Detailed error analysis
                if (message.error.includes('Could not establish connection')) {
                    console.log('   🔧 Content script communication failure');
                    console.log('      - Content script may not be loaded');
                    console.log('      - Message listener not responding');
                    console.log('      - Extension permissions issue');
                } else if (message.error.includes('Receiving end does not exist')) {
                    console.log('   🔧 Content script not responding');
                    console.log('      - Content script crashed or not loaded');
                    console.log('      - Page navigation interrupted content script');
                } else if (message.error.includes('Unsupported BROP command')) {
                    console.log('   🔧 Background script handler missing');
                    console.log('      - Extension reload may not have applied changes');
                } else if (message.error.includes('tabId is required')) {
                    console.log('   🔧 TabId parameter missing');
                    console.log('      - Command structure updated to require explicit tab targeting');
                }
            }
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
        }, 15000);
    });
}

// Run the test
if (require.main === module) {
    testContentScript().catch(console.error);
}