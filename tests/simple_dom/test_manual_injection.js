#!/usr/bin/env node
/**
 * Test manual content script injection
 */

const WebSocket = require('ws');

async function testManualInjection() {
    console.log('🔧 Testing Manual Content Script Injection');
    console.log('=' + '='.repeat(45));
    
    // Navigate to a clean page first
    console.log('📋 Step 1: Navigate to test page...');
    const ws1 = new WebSocket('ws://localhost:9223');
    
    await new Promise((resolve) => {
        let resolved = false;
        
        ws1.on('open', () => {
            const navMessage = {
                id: 'nav-manual-test',
                command: {
                    type: 'navigate',
                    url: 'https://httpbin.org/html'
                }
            };
            ws1.send(JSON.stringify(navMessage));
        });
        
        ws1.on('message', (data) => {
            if (resolved) return;
            resolved = true;
            
            const response = JSON.parse(data.toString());
            console.log(`   Navigation: ${response.success ? 'SUCCESS' : `FAILED: ${response.error}`}`);
            ws1.close();
            resolve();
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
    const ws2 = new WebSocket('ws://localhost:9223');
    
    await new Promise((resolve) => {
        let resolved = false;
        
        ws2.on('open', () => {
            // Test if content script exists, if not try to inject it
            const testMessage = {
                id: 'manual-injection-test',
                command: {
                    type: 'execute_console',
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
        });
        
        ws2.on('message', (data) => {
            if (resolved) return;
            resolved = true;
            
            try {
                const response = JSON.parse(data.toString());
                
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
    const ws3 = new WebSocket('ws://localhost:9223');
    
    await new Promise((resolve) => {
        let resolved = false;
        
        ws3.on('open', () => {
            const domMessage = {
                id: 'test-dom-post-injection',
                command: {
                    type: 'get_simplified_dom',
                    max_depth: 2,
                    include_hidden: false
                }
            };
            
            console.log('   📤 Testing simplified DOM...');
            ws3.send(JSON.stringify(domMessage));
        });
        
        ws3.on('message', (data) => {
            if (resolved) return;
            resolved = true;
            
            try {
                const response = JSON.parse(data.toString());
                
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