#!/usr/bin/env node
/**
 * Test the simplified DOM feature specifically
 */

const WebSocket = require('ws');

async function testSimplifiedDOM() {
    console.log('🌳 Testing BROP Simplified DOM Feature');
    console.log('=' + '='.repeat(40));
    
    try {
        // Connect to BROP native server
        const ws = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            ws.on('open', () => {
                console.log('✅ Connected to BROP native server');
                
                // Test simplified DOM command
                const message = {
                    id: 'test-dom-1',
                    command: {
                        type: 'get_simplified_dom',
                        max_depth: 3,
                        include_hidden: false,
                        include_text_nodes: true,
                        include_coordinates: true
                    }
                };
                
                console.log('📤 Sending simplified DOM request...');
                ws.send(JSON.stringify(message));
            });
            
            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    console.log('📥 Received response:', response);
                    
                    if (response.success) {
                        console.log('✅ Simplified DOM command successful');
                        if (response.result) {
                            console.log(`📊 Interactive elements: ${response.result.total_interactive_elements || 'N/A'}`);
                            console.log(`📋 Page structure: ${response.result.page_structure_summary || 'N/A'}`);
                            console.log(`🎯 Suggested selectors: ${response.result.suggested_selectors?.length || 0}`);
                        }
                    } else {
                        console.log('❌ Simplified DOM command failed:', response.error);
                    }
                    
                    ws.close();
                    resolve();
                } catch (error) {
                    console.error('❌ Error parsing response:', error.message);
                    reject(error);
                }
            });
            
            ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                reject(error);
            });
            
            setTimeout(() => {
                reject(new Error('Test timeout'));
            }, 10000);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSimplifiedDOM();