#!/usr/bin/env node
/**
 * Debug get_simplified_dom command specifically
 */

const WebSocket = require('ws');

async function debugSimplifiedDOM() {
    console.log('🔍 Debugging get_simplified_dom command');
    console.log('=' + '='.repeat(40));
    
    let ws = null;
    let messageId = 0;
    const pendingRequests = new Map();
    
    try {
        // Connect to BROP
        console.log('📋 Step 1: Connecting to BROP...');
        ws = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            ws.on('open', () => {
                console.log('✅ Connected to BROP bridge');
                resolve();
            });
            
            ws.on('error', reject);
        });
        
        // Set up message handling
        ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                console.log('📨 Received response:', JSON.stringify(response, null, 2));
                
                if (pendingRequests.has(response.id)) {
                    const { resolve } = pendingRequests.get(response.id);
                    pendingRequests.delete(response.id);
                    resolve(response);
                }
            } catch (error) {
                console.error('Error parsing response:', error.message);
            }
        });
        
        // Test basic navigation first
        console.log('\n📋 Step 2: Testing navigation...');
        const navResult = await sendCommand({
            type: 'navigate',
            url: 'https://example.com'
        });
        
        console.log('✅ Navigation result:', navResult);
        
        // Wait a moment for page to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test get_simplified_dom
        console.log('\n📋 Step 3: Testing get_simplified_dom...');
        const domResult = await sendCommand({
            type: 'get_simplified_dom',
            max_depth: 3,
            include_coordinates: true,
            include_text_nodes: true
        });
        
        console.log('✅ Simplified DOM result:');
        console.log('   Success:', domResult.success);
        if (domResult.success) {
            console.log('   Page title:', domResult.result?.page_title);
            console.log('   Interactive elements:', domResult.result?.total_interactive_elements);
            console.log('   Structure summary:', domResult.result?.page_structure_summary);
            console.log('   Root node available:', !!domResult.result?.root);
            console.log('   Suggested selectors:', domResult.result?.suggested_selectors?.length || 0);
        } else {
            console.log('   Error:', domResult.error);
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (ws) {
            ws.close();
            console.log('\n🔚 Connection closed');
        }
    }
    
    function sendCommand(command) {
        return new Promise((resolve, reject) => {
            const id = `debug_${++messageId}`;
            const message = { id, command };
            
            pendingRequests.set(id, { resolve, reject });
            
            console.log('📤 Sending command:', JSON.stringify(message, null, 2));
            ws.send(JSON.stringify(message));
            
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Command timeout'));
                }
            }, 10000);
        });
    }
}

debugSimplifiedDOM();