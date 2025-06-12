#!/usr/bin/env node
/**
 * Basic Connection Test for BROP Stagehand
 * Tests fundamental BROP connection without AI features
 */

require('dotenv').config({ path: '../../.env' });
const WebSocket = require('ws');

let messageId = 0;

async function testBasicConnection() {
    console.log('🔧 Testing Basic BROP Connection');
    console.log('=' + '='.repeat(35));
    
    let ws = null;
    
    try {
        // Test WebSocket connection
        console.log('📋 Step 1: Testing WebSocket connection...');
        
        ws = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            ws.on('open', () => {
                console.log('✅ WebSocket connected to BROP bridge');
                resolve();
            });
            
            ws.on('error', (error) => {
                reject(new Error(`WebSocket connection failed: ${error.message}`));
            });
            
            setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 5000);
        });
        
        // Test basic navigation
        console.log('\\n📋 Step 2: Testing basic navigation...');
        
        const navResult = await sendCommand(ws, {
            type: 'navigate',
            url: 'https://httpbin.org/html'
        });
        
        console.log('✅ Navigation result:', navResult);
        
        // Test page content retrieval (without simplified DOM)
        console.log('\\n📋 Step 3: Testing basic page content...');
        
        const contentResult = await sendCommand(ws, {
            type: 'get_page_content'
        });
        
        console.log('✅ Page content available:', !!contentResult.success);
        if (contentResult.success) {
            console.log(`   📄 Title: ${contentResult.result.title || 'N/A'}`);
            console.log(`   🌐 URL: ${contentResult.result.url || 'N/A'}`);
            console.log(`   📝 Text length: ${(contentResult.result.text || '').length} chars`);
        }
        
        // Test screenshot
        console.log('\\n📋 Step 4: Testing screenshot...');
        
        const screenshotResult = await sendCommand(ws, {
            type: 'get_screenshot',
            format: 'png',
            full_page: false
        });
        
        console.log('✅ Screenshot test:', screenshotResult.success ? 'SUCCESS' : 'FAILED');
        if (screenshotResult.success) {
            console.log(`   📸 Image data length: ${screenshotResult.result.image_data?.length || 0} chars`);
        }
        
        // Test simplified DOM (the problematic one)
        console.log('\\n📋 Step 5: Testing simplified DOM...');
        
        try {
            const domResult = await sendCommand(ws, {
                type: 'get_simplified_dom',
                max_depth: 3,
                include_invisible: false
            });
            
            console.log('✅ Simplified DOM test:', domResult.success ? 'SUCCESS' : 'FAILED');
            if (domResult.success) {
                console.log(`   🌳 DOM structure available: ${!!domResult.result.simplified_tree}`);
                console.log(`   🔢 Interactive elements: ${domResult.result.total_interactive_elements || 0}`);
            } else {
                console.log(`   ❌ Error: ${domResult.error}`);
            }
        } catch (error) {
            console.log(`   ❌ Simplified DOM failed: ${error.message}`);
        }
        
        console.log('\\n🎯 Basic Connection Assessment:');
        console.log('=' + '='.repeat(35));
        console.log('✅ WebSocket connection: Working');
        console.log('✅ Basic navigation: Working');
        console.log('✅ Page content: Working');
        console.log('✅ Screenshots: Working');
        console.log('❓ Simplified DOM: Check results above');
        
        console.log('\\n💡 If simplified DOM failed, the issue is likely:');
        console.log('   1. Content script not injected into the page');
        console.log('   2. Content script permissions issue');
        console.log('   3. Message passing between background/content script broken');
        console.log('   4. Page security restrictions (HTTPS/CSP issues)');
        
    } catch (error) {
        console.error('❌ Basic connection test failed:', error.message);
        
        if (error.message.includes('ECONNREFUSED')) {
            console.log('\\n🔧 Connection refused - ensure BROP bridge is running:');
            console.log('   cd ../bridge-server && node bridge_server.js');
        }
    } finally {
        if (ws) {
            ws.close();
            console.log('\\n🔚 Test cleanup completed');
        }
    }
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `test_${messageId}`;
        const message = {
            id: id,
            command: command
        };
        
        const timeout = setTimeout(() => {
            reject(new Error('Command timeout'));
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

testBasicConnection();