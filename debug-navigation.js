#!/usr/bin/env node
/**
 * Debug Navigation Issues
 * Check what URL the browser is actually on and test navigation
 */

const WebSocket = require('ws');

let messageId = 0;

async function debugNavigation() {
    console.log('🧭 BROP Navigation Diagnostics');
    console.log('=' + '='.repeat(35));
    
    let ws = null;
    
    try {
        console.log('📋 Step 1: Connecting to BROP bridge...');
        
        ws = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        console.log('✅ Connected to BROP bridge');
        
        // Test 1: Check current tab info directly
        console.log('\\n📋 Step 2: Checking current tab state...');
        try {
            // Use our own tab query (similar to what background script does)
            const tabQueryResult = await sendCommand(ws, {
                type: 'debug_tab_info'  // We'll add this as a debug command
            });
            
            console.log(`Tab query result: ${JSON.stringify(tabQueryResult, null, 2)}`);
        } catch (error) {
            console.log(`❌ Tab query failed: ${error.message}`);
        }
        
        // Test 2: Try to take a screenshot to see what's actually displayed
        console.log('\\n📋 Step 3: Taking screenshot to see current page...');
        const screenshotResult = await sendCommand(ws, {
            type: 'get_screenshot',
            format: 'png'
        });
        
        if (screenshotResult.success) {
            console.log('✅ Screenshot captured successfully');
            console.log(`   Image size: ${screenshotResult.result.image_data?.length || 0} characters`);
            console.log('   This confirms the browser is responding');
        } else {
            console.log(`❌ Screenshot failed: ${screenshotResult.error}`);
        }
        
        // Test 3: Try navigating to different types of URLs
        const testUrls = [
            'about:blank',  // Should always work
            'data:text/html,<html><head><title>Test</title></head><body><h1>Simple Test Page</h1><p>This is a basic HTML page for testing.</p></body></html>',
            'https://httpbin.org/html',
            'https://example.com'
        ];
        
        for (let i = 0; i < testUrls.length; i++) {
            const url = testUrls[i];
            console.log(`\\n📋 Step ${4 + i}: Testing navigation to ${url.substring(0, 50)}...`);
            
            // Navigate
            const navResult = await sendCommand(ws, {
                type: 'navigate',
                url: url
            });
            
            console.log(`   Navigation API result: ${navResult.success ? 'SUCCESS' : 'FAILED'}`);
            if (!navResult.success) {
                console.log(`   Error: ${navResult.error}`);
                continue;
            }
            
            // Wait for navigation
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Try to get page content to verify navigation worked
            try {
                const contentResult = await sendCommand(ws, {
                    type: 'get_page_content'
                });
                
                if (contentResult.success) {
                    console.log(`   ✅ Page content accessible`);
                    console.log(`      Title: ${contentResult.result.title || 'No title'}`);
                    console.log(`      URL: ${contentResult.result.url || 'No URL'}`);
                    console.log(`      Content: ${(contentResult.result.text || '').substring(0, 100)}...`);
                    
                    // If this works, try simplified DOM
                    const domResult = await sendCommand(ws, {
                        type: 'get_simplified_dom',
                        max_depth: 2
                    });
                    
                    if (domResult.success) {
                        console.log(`   ✅ Simplified DOM working!`);
                        console.log(`      Elements: ${domResult.result.total_interactive_elements || 0}`);
                        console.log(`      Structure: ${domResult.result.page_structure_summary || 'N/A'}`);
                        break; // Found a working page!
                    } else {
                        console.log(`   ❌ Simplified DOM failed: ${domResult.error}`);
                    }
                } else {
                    console.log(`   ❌ Page content failed: ${contentResult.error}`);
                }
            } catch (error) {
                console.log(`   ❌ Page access threw error: ${error.message}`);
            }
        }
        
        console.log('\\n🎯 Navigation Diagnostic Summary:');
        console.log('=' + '='.repeat(35));
        console.log('✅ Identify which URLs actually work');
        console.log('✅ Find URLs where content script injection succeeds');
        console.log('✅ Determine if issue is universal or URL-specific');
        
    } catch (error) {
        console.error('❌ Navigation diagnostic failed:', error.message);
    } finally {
        if (ws) {
            ws.close();
            console.log('\\n🔚 Diagnostic cleanup completed');
        }
    }
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `nav_debug_${messageId}`;
        const message = {
            id: id,
            command: command
        };
        
        const timeout = setTimeout(() => {
            reject(new Error(`Command ${command.type} timeout`));
        }, 15000); // Longer timeout for navigation
        
        const messageHandler = (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.id === id) {
                    clearTimeout(timeout);
                    ws.removeListener('message', messageHandler);
                    resolve(response);
                }
            } catch (error) {
                clearTimeout(timeout);
                ws.removeListener('message', messageHandler);
                reject(new Error(`Response parsing failed: ${error.message}`));
            }
        };
        
        ws.on('message', messageHandler);
        ws.send(JSON.stringify(message));
    });
}

debugNavigation();