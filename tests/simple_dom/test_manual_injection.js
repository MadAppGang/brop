#!/usr/bin/env node
/**
 * Test manual content script injection
 */

const WebSocket = require('ws');
const { createNamedBROPConnection } = require('../../test-utils');

async function testManualInjection() {
    console.log('🔧 Testing Manual Content Script Injection');
    console.log('=' + '='.repeat(45));
    
    // Navigate to a clean page first
    console.log('📋 Step 1: Navigate to test page...');
    const ws1 = createNamedBROPConnection('navigation');
    
    await new Promise((resolve) => {
        let resolved = false;
        
        ws1.on('open', () => {
            // First get tabs
            const tabsMessage = {
                id: 'get-tabs-manual',
                method: 'list_tabs',
                params: {}
            };
            ws1.send(JSON.stringify(tabsMessage));
        });
        
        let currentTabId = null;
        ws1.on('message', (data) => {
            if (resolved) return;
            
            const response = JSON.parse(data.toString());
            
            if (response.id === 'get-tabs-manual' && response.success) {
                const tabs = response.result.tabs || [];
                const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                
                if (!accessibleTab) {
                    // Create a new tab
                    const createMessage = {
                        id: 'create-tab-manual',
                        method: 'create_tab',
                        params: { url: 'https://httpbin.org/html' }
                    };
                    ws1.send(JSON.stringify(createMessage));
                    return;
                }
                
                currentTabId = accessibleTab.tabId;
                // Navigate existing tab
                const navMessage = {
                    id: 'nav-manual-test',
                    method: 'navigate',
                    params: {
                        tabId: currentTabId,
                        url: 'https://httpbin.org/html'
                    }
                };
                ws1.send(JSON.stringify(navMessage));
                
            } else if (response.id === 'create-tab-manual' && response.success) {
                currentTabId = response.result.tabId;
                resolved = true;
                console.log(`   Navigation: SUCCESS (created tab ${currentTabId})`);
                ws1.close();
                resolve();
                
            } else if (response.id === 'nav-manual-test') {
                resolved = true;
                console.log(`   Navigation: ${response.success ? 'SUCCESS' : `FAILED: ${response.error}`}`);
                ws1.close();
                resolve();
            }
        });
        
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                ws1.close();
                resolve();
            }
        }, 5000);
    });
    
    // Wait for page load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to manually inject and test the content script
    console.log('\n📋 Step 2: Manual content script injection...');
    const ws2 = createNamedBROPConnection('injection');
    
    await new Promise((resolve) => {
        let resolved = false;
        
        ws2.on('open', () => {
            // First get current tab
            const tabsMessage = {
                id: 'get-tabs-inject',
                method: 'list_tabs',
                params: {}
            };
            ws2.send(JSON.stringify(tabsMessage));
        });
        
        let injectTabId = null;
        ws2.on('message', (data) => {
            if (resolved) return;
            
            const response = JSON.parse(data.toString());
            
            if (response.id === 'get-tabs-inject' && response.success) {
                const tabs = response.result.tabs || [];
                const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                
                if (accessibleTab) {
                    injectTabId = accessibleTab.tabId;
                    
                    // Test if content script exists, if not try to inject it
                    const testMessage = {
                        id: 'manual-injection-test',
                        method: 'execute_console',
                        params: {
                            tabId: injectTabId,
                            code: `
                        // Check if content script is already loaded
                        if (typeof window.BROP === 'undefined') {
                            console.log('BROP content script not found, manual injection needed');
                            
                            // Try to recreate the essential parts for testing
                            window.BROP = {
                                getSimplifiedDOM: function(params) {
                                    return {
                                        page_title: document.title,
                                        page_url: window.location.href,
                                        total_elements: document.querySelectorAll('*').length,
                                        total_interactive_elements: document.querySelectorAll('a, button, input, select, textarea').length,
                                        page_structure_summary: 'Manual injection test - basic structure',
                                        simplified_tree: {
                                            tag: 'html',
                                            children: [
                                                { tag: 'head', text: 'Head content' },
                                                { tag: 'body', text: 'Body content' }
                                            ]
                                        },
                                        suggested_selectors: [
                                            'h1', 'p', 'a'
                                        ]
                                    };
                                }
                            };
                            
                            return 'MANUAL_INJECTION_SUCCESS';
                        } else {
                            return 'CONTENT_SCRIPT_ALREADY_LOADED';
                        }
                    `
                        }
                    };
                    
                    console.log('   📤 Testing/injecting content script...');
                    ws2.send(JSON.stringify(testMessage));
                } else {
                    resolved = true;
                    console.log('   ❌ No accessible tab found for injection test');
                    ws2.close();
                    resolve();
                }
                
            } else if (response.id === 'manual-injection-test') {
                resolved = true;
                
                try {
                    if (response.success) {
                        console.log(`   📥 Injection result: ${response.result.result}`);
                        
                        if (response.result.result === 'CONTENT_SCRIPT_ALREADY_LOADED') {
                            console.log('   ✅ Content script is already loaded!');
                        } else if (response.result.result === 'MANUAL_INJECTION_SUCCESS') {
                            console.log('   🔧 Manually injected basic BROP functionality');
                        }
                    } else {
                        console.log(`   ❌ Injection test failed: ${response.error}`);
                    }
                } catch (error) {
                    console.log(`   ❌ Error parsing injection response: ${error.message}`);
                }
                
                ws2.close();
                resolve();
            }
        });
        
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.log('   ⏰ Injection test timeout');
                ws2.close();
                resolve();
            }
        }, 5000);
    });
    
    // Now test the simplified DOM again
    console.log('\n📋 Step 3: Test simplified DOM after injection...');
    const ws3 = createNamedBROPConnection('dom-test');
    
    await new Promise((resolve) => {
        let resolved = false;
        
        ws3.on('open', () => {
            // First get current tab
            const tabsMessage = {
                id: 'get-tabs-dom',
                method: 'list_tabs',
                params: {}
            };
            ws3.send(JSON.stringify(tabsMessage));
        });
        
        let domTabId = null;
        ws3.on('message', (data) => {
            if (resolved) return;
            
            const response = JSON.parse(data.toString());
            
            if (response.id === 'get-tabs-dom' && response.success) {
                const tabs = response.result.tabs || [];
                const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                
                if (accessibleTab) {
                    domTabId = accessibleTab.tabId;
                    
                    const domMessage = {
                        id: 'test-dom-post-injection',
                        method: 'get_simplified_dom',
                        params: {
                            tabId: domTabId,
                            max_depth: 2,
                            include_hidden: false
                        }
                    };
                    
                    console.log('   📤 Testing simplified DOM...');
                    ws3.send(JSON.stringify(domMessage));
                } else {
                    resolved = true;
                    console.log('   ❌ No accessible tab found for DOM test');
                    ws3.close();
                    resolve();
                }
                
            } else if (response.id === 'test-dom-post-injection') {
                resolved = true;
                
                try {
                    if (response.success) {
                        console.log('   ✅ Simplified DOM: SUCCESS!');
                        console.log('   🎉 Feature working after injection!');
                        
                        if (response.result) {
                            console.log(`      Page: ${response.result.page_title}`);
                            console.log(`      URL: ${response.result.page_url}`);
                            console.log(`      Elements: ${response.result.total_elements}`);
                            console.log(`      Interactive: ${response.result.total_interactive_elements}`);
                        }
                    } else {
                        console.log(`   ❌ Simplified DOM still failing: ${response.error}`);
                        
                        // Additional troubleshooting
                        if (response.error.includes('Could not establish connection')) {
                            console.log('   🔧 The issue is in message passing between background and content script');
                            console.log('   💡 Possible solutions:');
                            console.log('      1. Check chrome://extensions/ - ensure extension is active');
                            console.log('      2. Try refreshing the webpage after extension reload');
                            console.log('      3. Check browser console for content script errors');
                            console.log('      4. Verify the extension has permission for this website');
                        }
                    }
                } catch (error) {
                    console.log(`   ❌ Error parsing DOM response: ${error.message}`);
                }
                
                ws3.close();
                resolve();
            }
        });
        
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.log('   ⏰ DOM test timeout');
                ws3.close();
                resolve();
            }
        }, 10000);
    });
    
    console.log('\n🎯 Manual Injection Test Complete!');
    console.log('📝 Summary:');
    console.log('   - If simplified DOM worked: Content script injection is the issue');
    console.log('   - If still failing: Message passing between background/content is broken');
    console.log('   - Next step: Check browser console and extension details page');
}

testManualInjection();