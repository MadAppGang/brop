#!/usr/bin/env node
/**
 * Test if content script is properly injected and responding
 */

const WebSocket = require('ws');

async function testContentScript() {
    console.log('🔍 Testing Content Script Injection and Communication');
    console.log('=' + '='.repeat(50));
    
    // First navigate to a webpage
    console.log('📋 Step 1: Navigate to test webpage...');
    const ws1 = new WebSocket('ws://localhost:9223');
    
    await new Promise((resolve) => {
        let resolved = false;
        
        ws1.on('open', () => {
            const navMessage = {
                id: 'nav-content-test',
                command: {
                    type: 'navigate',
                    url: 'https://httpbin.org/html'  // Simple test page
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
    
    // Test if content script responds to basic commands
    console.log('\n📋 Step 2: Test content script communication...');
    
    // Try to inject a simple script that checks for BROP content script
    const ws2 = new WebSocket('ws://localhost:9223');
    
    await new Promise((resolve) => {
        let resolved = false;
        
        ws2.on('open', () => {
            const testMessage = {
                id: 'test-content-injection',
                command: {
                    type: 'execute_console',
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
            ws2.send(JSON.stringify(testMessage));
        });
        
        ws2.on('message', (data) => {
            if (resolved) return;
            resolved = true;
            
            try {
                const response = JSON.parse(data.toString());
                
                if (response.success) {
                    const result = JSON.parse(response.result.result);
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
                } else {
                    console.log(`   ❌ Content script check failed: ${response.error}`);
                }
            } catch (error) {
                console.log(`   ❌ Error parsing content script check: ${error.message}`);
            }
            
            ws2.close();
            resolve();
        });
        
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.log('   ⏰ Content script check timeout');
                ws2.close();
                resolve();
            }
        }, 5000);
    });
    
    // Now try the simplified DOM command again with better error handling
    console.log('\n📋 Step 3: Test simplified DOM with detailed error handling...');
    const ws3 = new WebSocket('ws://localhost:9223');
    
    await new Promise((resolve) => {
        let resolved = false;
        
        ws3.on('open', () => {
            const domMessage = {
                id: 'test-dom-detailed',
                command: {
                    type: 'get_simplified_dom',
                    max_depth: 2,
                    include_hidden: false
                }
            };
            
            console.log('   📤 Sending simplified DOM request...');
            ws3.send(JSON.stringify(domMessage));
        });
        
        ws3.on('message', (data) => {
            if (resolved) return;
            resolved = true;
            
            try {
                const response = JSON.parse(data.toString());
                
                if (response.success) {
                    console.log('   ✅ Simplified DOM: SUCCESS!');
                    console.log('   🎉 Content script communication working!');
                    
                    if (response.result) {
                        console.log('   📊 DOM result preview:');
                        console.log(`      Page: ${response.result.page_title || 'N/A'}`);
                        console.log(`      Elements: ${response.result.total_elements || 'N/A'}`);
                        console.log(`      Interactive: ${response.result.total_interactive_elements || 'N/A'}`);
                    }
                } else {
                    console.log(`   ❌ Simplified DOM failed: ${response.error}`);
                    
                    // Detailed error analysis
                    if (response.error.includes('Could not establish connection')) {
                        console.log('   🔧 Content script communication failure');
                        console.log('      - Content script may not be loaded');
                        console.log('      - Message listener not responding');
                        console.log('      - Extension permissions issue');
                    } else if (response.error.includes('Receiving end does not exist')) {
                        console.log('   🔧 Content script not responding');
                        console.log('      - Content script crashed or not loaded');
                        console.log('      - Page navigation interrupted content script');
                    } else if (response.error.includes('Unsupported BROP command')) {
                        console.log('   🔧 Background script handler missing');
                        console.log('      - Extension reload may not have applied changes');
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
                console.log('   ⏰ Simplified DOM test timeout');
                ws3.close();
                resolve();
            }
        }, 10000);
    });
    
    console.log('\n🎯 Diagnosis Complete!');
    console.log('📋 Check the results above to understand the issue.');
}

testContentScript();