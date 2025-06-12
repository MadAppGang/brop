#!/usr/bin/env node
/**
 * Debug BROP Tab Management Issues
 * This script will help diagnose the tab management and content script problems
 */

const WebSocket = require('ws');

let messageId = 0;

async function debugTabManagement() {
    console.log('🔍 BROP Tab Management Diagnostics');
    console.log('=' + '='.repeat(40));
    
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
        
        // Test 1: Get basic page info
        console.log('\\n📋 Step 2: Getting current page info...');
        const pageInfoResult = await sendCommand(ws, {
            type: 'get_page_content'
        });
        
        if (pageInfoResult.success) {
            console.log(`✅ Current page: ${pageInfoResult.result.title || 'No title'}`);
            console.log(`🌐 URL: ${pageInfoResult.result.url || 'No URL'}`);
            console.log(`📝 Content length: ${(pageInfoResult.result.text || '').length} chars`);
        } else {
            console.log(`❌ Failed to get page info: ${pageInfoResult.error}`);
        }
        
        // Test 2: Try to get simplified DOM with detailed error reporting
        console.log('\\n📋 Step 3: Testing simplified DOM with debug info...');
        try {
            const domResult = await sendCommand(ws, {
                type: 'get_simplified_dom',
                max_depth: 2,
                include_invisible: false
            });
            
            console.log(`DOM call result: ${JSON.stringify(domResult, null, 2)}`);
            
            if (domResult.success) {
                console.log('✅ Simplified DOM working');
                console.log(`   Elements: ${domResult.result.total_interactive_elements || 0}`);
                console.log(`   Structure: ${domResult.result.page_structure_summary || 'N/A'}`);
            } else {
                console.log(`❌ Simplified DOM failed: ${domResult.error}`);
                if (domResult.error && domResult.error.includes('Could not establish connection')) {
                    console.log('   🔍 This suggests content script is not responding');
                }
            }
        } catch (error) {
            console.log(`❌ Simplified DOM threw error: ${error.message}`);
        }
        
        // Test 3: Try basic navigation to see tab handling
        console.log('\\n📋 Step 4: Testing navigation and tab tracking...');
        console.log('   Navigating to a simple page...');
        
        const navResult = await sendCommand(ws, {
            type: 'navigate',
            url: 'https://httpbin.org/html'
        });
        
        console.log(`Navigation result: ${navResult.success ? 'SUCCESS' : 'FAILED'}`);
        if (!navResult.success) {
            console.log(`   Error: ${navResult.error}`);
        }
        
        // Wait for navigation to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check page again after navigation
        const newPageInfoResult = await sendCommand(ws, {
            type: 'get_page_content'
        });
        
        if (newPageInfoResult.success) {
            console.log(`   ✅ After navigation: ${newPageInfoResult.result.title || 'No title'}`);
            console.log(`   🌐 New URL: ${newPageInfoResult.result.url || 'No URL'}`);
        }
        
        // Test 4: Try simplified DOM on the new page
        console.log('\\n📋 Step 5: Testing simplified DOM after navigation...');
        const newDomResult = await sendCommand(ws, {
            type: 'get_simplified_dom',
            max_depth: 2,
            include_invisible: false
        });
        
        if (newDomResult.success) {
            console.log('✅ Simplified DOM working after navigation');
            console.log(`   Elements: ${newDomResult.result.total_interactive_elements || 0}`);
        } else {
            console.log(`❌ Simplified DOM still failing: ${newDomResult.error}`);
        }
        
        // Test 5: Check what happens with multiple commands
        console.log('\\n📋 Step 6: Testing rapid command sequence...');
        const rapidTests = [
            { type: 'get_screenshot', format: 'png' },
            { type: 'get_page_content' },
            { type: 'get_simplified_dom', max_depth: 1 }
        ];
        
        for (let i = 0; i < rapidTests.length; i++) {
            const cmd = rapidTests[i];
            console.log(`   Testing ${cmd.type}...`);
            
            try {
                const result = await sendCommand(ws, cmd);
                console.log(`   ${cmd.type}: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
                if (!result.success) {
                    console.log(`      Error: ${result.error}`);
                }
            } catch (error) {
                console.log(`   ${cmd.type}: ❌ EXCEPTION - ${error.message}`);
            }
        }
        
        console.log('\\n🎯 Diagnostic Summary:');
        console.log('=' + '='.repeat(30));
        console.log('✅ Check which commands work vs fail');
        console.log('✅ Look for patterns in content script communication');
        console.log('✅ Identify if the issue is page-specific or universal');
        console.log('✅ Check if rapid commands cause issues');
        
    } catch (error) {
        console.error('❌ Diagnostic failed:', error.message);
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
        const id = `debug_${messageId}`;
        const message = {
            id: id,
            command: command
        };
        
        const timeout = setTimeout(() => {
            reject(new Error(`Command ${command.type} timeout`));
        }, 10000);
        
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

debugTabManagement();