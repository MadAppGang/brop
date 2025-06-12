#!/usr/bin/env node
/**
 * Test direct BROP navigation to understand what's happening
 */

require('dotenv').config({ path: '../../.env' });
const WebSocket = require('ws');

let messageId = 0;

async function testDirectNavigation() {
    console.log('🧭 Testing Direct BROP Navigation');
    console.log('=' + '='.repeat(35));
    
    let ws = null;
    
    try {
        // Connect to BROP
        console.log('📋 Step 1: Connecting to BROP...');
        
        ws = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        console.log('✅ Connected to BROP bridge');
        
        // Test multiple navigation attempts
        const testUrls = [
            'https://httpbin.org/html',
            'https://example.com',
            'https://www.google.com',
            'data:text/html,<html><head><title>Simple Test</title></head><body><h1>Hello</h1><button>Click</button></body></html>'
        ];
        
        for (let i = 0; i < testUrls.length; i++) {
            const url = testUrls[i];
            console.log(`\\n📋 Step ${i + 2}: Testing navigation to ${url.substring(0, 50)}...`);
            
            // Navigate
            const navResult = await sendCommand(ws, {
                type: 'navigate',
                url: url
            });
            
            console.log(`   Navigation result: ${navResult.success ? 'SUCCESS' : 'FAILED'}`);
            if (!navResult.success) {
                console.log(`   Error: ${navResult.error}`);
                continue;
            }
            
            // Wait a bit for page load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Get page content to verify actual URL
            const contentResult = await sendCommand(ws, {
                type: 'get_page_content'
            });
            
            if (contentResult.success) {
                console.log(`   ✅ Actual URL: ${contentResult.result.url}`);
                console.log(`   📄 Actual Title: ${contentResult.result.title || 'No title'}`);
                console.log(`   📝 Content length: ${(contentResult.result.text || '').length} chars`);
                
                // Check if URL matches what we requested
                if (contentResult.result.url === url || contentResult.result.url.startsWith(url)) {
                    console.log('   ✅ Navigation successful - URL matches');
                } else {
                    console.log(`   ⚠️ Navigation redirected - Expected: ${url}, Got: ${contentResult.result.url}`);
                }
            } else {
                console.log(`   ❌ Failed to get page content: ${contentResult.error}`);
            }
            
            // Test simplified DOM on this page
            const domResult = await sendCommand(ws, {
                type: 'get_simplified_dom',
                max_depth: 2,
                include_invisible: false
            });
            
            if (domResult.success) {
                console.log(`   🌳 DOM elements: ${domResult.result.total_interactive_elements || 0}`);
                console.log(`   📊 Structure: ${domResult.result.page_structure_summary || 'N/A'}`);
            } else {
                console.log(`   ❌ DOM simplification failed: ${domResult.error}`);
            }
        }
        
        console.log('\\n🎯 Navigation Analysis:');
        console.log('=' + '='.repeat(25));
        console.log('✅ Check if URLs are being redirected');
        console.log('✅ Verify which pages work for DOM simplification');
        console.log('✅ Identify any patterns in navigation failures');
        
    } catch (error) {
        console.error('❌ Direct navigation test failed:', error.message);
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
        const id = `nav_test_${messageId}`;
        const message = {
            id: id,
            command: command
        };
        
        const timeout = setTimeout(() => {
            reject(new Error('Command timeout'));
        }, 15000);
        
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

testDirectNavigation();