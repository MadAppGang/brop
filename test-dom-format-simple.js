#!/usr/bin/env node
/**
 * Simple test for DOM format options
 */

const WebSocket = require('ws');

async function testDOMFormats() {
    console.log('🔍 Testing DOM Format Options');
    console.log('=' + '='.repeat(30));
    
    let ws = null;
    let messageId = 0;
    const pendingRequests = new Map();
    
    try {
        // Connect to BROP
        console.log('📋 Connecting to BROP...');
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
                if (pendingRequests.has(response.id)) {
                    const { resolve } = pendingRequests.get(response.id);
                    pendingRequests.delete(response.id);
                    resolve(response);
                }
            } catch (error) {
                console.error('Error parsing response:', error.message);
            }
        });
        
        // Test tree format
        console.log('\n📋 Testing Tree Format...');
        const treeResult = await sendCommand({
            type: 'get_simplified_dom',
            format: 'tree',
            max_depth: 2
        });
        console.log('   Tree success:', treeResult.success);
        if (!treeResult.success) {
            console.log('   Tree error:', treeResult.error);
        } else {
            console.log('   Tree keys:', Object.keys(treeResult.result || {}));
        }
        
        // Test HTML format  
        console.log('\n📋 Testing HTML Format...');
        const htmlResult = await sendCommand({
            type: 'get_simplified_dom',
            format: 'html',
            max_depth: 2
        });
        console.log('   HTML success:', htmlResult.success);
        if (!htmlResult.success) {
            console.log('   HTML error:', htmlResult.error);
        } else {
            console.log('   HTML keys:', Object.keys(htmlResult.result || {}));
        }
        
        // Test markdown format
        console.log('\n📋 Testing Markdown Format...');
        const markdownResult = await sendCommand({
            type: 'get_simplified_dom',
            format: 'markdown',
            max_depth: 2
        });
        console.log('   Markdown success:', markdownResult.success);
        if (!markdownResult.success) {
            console.log('   Markdown error:', markdownResult.error);
        } else {
            console.log('   Markdown keys:', Object.keys(markdownResult.result || {}));
        }
        
        console.log('\n✅ DOM format testing completed');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        if (ws) {
            ws.close();
        }
    }
    
    function sendCommand(command) {
        return new Promise((resolve, reject) => {
            const id = `test_${++messageId}`;
            const message = { id, command };
            
            pendingRequests.set(id, { resolve, reject });
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

testDOMFormats();