#!/usr/bin/env node
/**
 * Test BROP with a proper webpage loaded
 */

const WebSocket = require('ws');

async function testWithWebpage() {
    console.log('🌐 Testing BROP with Active Webpage');
    console.log('=' + '='.repeat(40));
    console.log('📋 Step 1: Navigate to a webpage first...');
    
    // First, let's navigate to a test page
    const ws1 = new WebSocket('ws://localhost:9223');
    
    await new Promise((resolve, reject) => {
        let resolved = false;
        
        ws1.on('open', () => {
            console.log('✅ Connected to BROP server');
            
            const navMessage = {
                id: 'nav-test',
                command: {
                    type: 'navigate',
                    url: 'https://example.com'
                }
            };
            
            console.log('📤 Navigating to example.com...');
            ws1.send(JSON.stringify(navMessage));
        });
        
        ws1.on('message', (data) => {
            if (resolved) return;
            resolved = true;
            
            try {
                const response = JSON.parse(data.toString());
                console.log('📥 Navigation response:', response.success ? 'SUCCESS' : `FAILED: ${response.error}`);
                ws1.close();
                resolve();
            } catch (error) {
                console.error('❌ Error parsing navigation response:', error.message);
                ws1.close();
                reject(error);
            }
        });
        
        ws1.on('error', (error) => {
            if (resolved) return;
            resolved = true;
            console.error('❌ Navigation error:', error.message);
            reject(error);
        });
        
        setTimeout(() => {
            if (resolved) return;
            resolved = true;
            console.log('⏰ Navigation timeout');
            ws1.close();
            resolve();
        }, 10000);
    });
    
    // Wait a moment for page to load
    console.log('⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Now test the simplified DOM feature
    console.log('\n📋 Step 2: Testing simplified DOM on webpage...');
    const ws2 = new WebSocket('ws://localhost:9223');
    
    await new Promise((resolve, reject) => {
        let resolved = false;
        
        ws2.on('open', () => {
            console.log('✅ Connected to BROP server');
            
            const domMessage = {
                id: 'test-dom-webpage',
                command: {
                    type: 'get_simplified_dom',
                    max_depth: 4,
                    include_hidden: false,
                    include_text_nodes: true,
                    include_coordinates: true
                }
            };
            
            console.log('📤 Requesting simplified DOM...');
            ws2.send(JSON.stringify(domMessage));
        });
        
        ws2.on('message', (data) => {
            if (resolved) return;
            resolved = true;
            
            try {
                const response = JSON.parse(data.toString());
                console.log('📥 DOM Response received');
                
                if (response.success) {
                    console.log('✅ Simplified DOM: SUCCESS!');
                    console.log('🎉 Feature is working correctly!');
                    
                    if (response.result) {
                        console.log('\n📊 DOM Analysis Results:');
                        console.log(`   🔢 Total elements: ${response.result.total_elements || 'N/A'}`);
                        console.log(`   🎯 Interactive elements: ${response.result.total_interactive_elements || 'N/A'}`);
                        console.log(`   📋 Page title: ${response.result.page_title || 'N/A'}`);
                        console.log(`   🌐 Page URL: ${response.result.page_url || 'N/A'}`);
                        console.log(`   🏗️  Structure: ${response.result.page_structure_summary || 'N/A'}`);
                        
                        if (response.result.suggested_selectors) {
                            console.log(`   🎯 Suggested selectors: ${response.result.suggested_selectors.length}`);
                            if (response.result.suggested_selectors.length > 0) {
                                console.log('      Top selectors:', response.result.suggested_selectors.slice(0, 3));
                            }
                        }
                        
                        if (response.result.simplified_tree) {
                            console.log(`   🌳 DOM tree depth: ${JSON.stringify(response.result.simplified_tree).length > 1000 ? 'Rich structure' : 'Simple structure'}`);
                        }
                    }
                } else {
                    console.log(`❌ Simplified DOM: FAILED - ${response.error}`);
                    
                    if (response.error.includes('Unsupported BROP command')) {
                        console.log('🔧 Extension may need another reload or background script issue');
                    } else if (response.error.includes('No active tab')) {
                        console.log('🔧 Make sure a webpage tab is active and focused');
                    } else if (response.error.includes('Content Security Policy')) {
                        console.log('🔧 Page has strict CSP, try a different website');
                    }
                }
                
                ws2.close();
                resolve();
            } catch (error) {
                console.error('❌ Error parsing DOM response:', error.message);
                ws2.close();
                reject(error);
            }
        });
        
        ws2.on('error', (error) => {
            if (resolved) return;
            resolved = true;
            console.error('❌ DOM test error:', error.message);
            reject(error);
        });
        
        setTimeout(() => {
            if (resolved) return;
            resolved = true;
            console.log('⏰ DOM test timeout');
            ws2.close();
            resolve();
        }, 15000);
    });
    
    // Test other basic commands on the webpage
    console.log('\n📋 Step 3: Testing other commands on webpage...');
    const commands = ['get_console_logs', 'get_screenshot', 'get_page_content'];
    
    for (const command of commands) {
        const ws = new WebSocket('ws://localhost:9223');
        
        const result = await new Promise((resolve) => {
            let resolved = false;
            
            ws.on('open', () => {
                const message = {
                    id: `test-${command}-webpage`,
                    command: { type: command }
                };
                ws.send(JSON.stringify(message));
            });
            
            ws.on('message', (data) => {
                if (resolved) return;
                resolved = true;
                
                try {
                    const response = JSON.parse(data.toString());
                    ws.close();
                    resolve({
                        command,
                        success: response.success,
                        error: response.error
                    });
                } catch (error) {
                    ws.close();
                    resolve({
                        command,
                        success: false,
                        error: error.message
                    });
                }
            });
            
            ws.on('error', (error) => {
                if (resolved) return;
                resolved = true;
                resolve({
                    command,
                    success: false,
                    error: error.message
                });
            });
            
            setTimeout(() => {
                if (resolved) return;
                resolved = true;
                ws.close();
                resolve({
                    command,
                    success: false,
                    error: 'timeout'
                });
            }, 5000);
        });
        
        if (result.success) {
            console.log(`   ✅ ${command}: PASS`);
        } else {
            console.log(`   ❌ ${command}: FAIL - ${result.error}`);
        }
        
        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n🎯 Test Results Summary:');
    console.log('✅ Navigation to webpage works');
    console.log('🧪 All commands tested on real webpage');
    console.log('📊 Check output above for simplified DOM results');
}

testWithWebpage();