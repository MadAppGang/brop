#!/usr/bin/env node
/**
 * Test Bridge Connection
 * 
 * Simple test to verify the bridge server is responding correctly
 */

const WebSocket = require('ws');

async function testBridgeConnection() {
    console.log('🔍 Testing bridge server connection...');
    
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9222');
        let connected = false;
        
        const timeout = setTimeout(() => {
            if (!connected) {
                console.log('❌ Connection timeout after 5 seconds');
                ws.close();
                resolve(false);
            }
        }, 5000);
        
        ws.on('open', () => {
            connected = true;
            clearTimeout(timeout);
            console.log('✅ Connected to bridge server');
            
            // Send a simple CDP command
            const testMessage = {
                id: 1,
                method: 'Target.getBrowserContexts',
                params: {}
            };
            
            console.log('📤 Sending Target.getBrowserContexts...');
            ws.send(JSON.stringify(testMessage));
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('📥 Received:', JSON.stringify(message, null, 2));
                
                if (message.id === 1) {
                    if (message.result) {
                        console.log('✅ Bridge server responding correctly');
                        resolve(true);
                    } else {
                        console.log('❌ Bridge server returned error:', message.error);
                        resolve(false);
                    }
                    ws.close();
                }
            } catch (error) {
                console.log('❌ Error parsing response:', error.message);
                resolve(false);
                ws.close();
            }
        });
        
        ws.on('error', (error) => {
            console.log('❌ WebSocket error:', error.message);
            resolve(false);
        });
        
        ws.on('close', () => {
            console.log('🔌 Connection closed');
            if (!connected) {
                resolve(false);
            }
        });
    });
}

async function testHttpEndpoints() {
    console.log('\n🔍 Testing HTTP endpoints...');
    
    try {
        // Test version endpoint
        const versionResponse = await fetch('http://localhost:9225/json/version');
        const versionData = await versionResponse.json();
        console.log('✅ Version endpoint:', versionData);
        
        // Test targets endpoint
        const targetsResponse = await fetch('http://localhost:9225/json/list');
        const targetsData = await targetsResponse.json();
        console.log('✅ Targets endpoint:', targetsData);
        
        return true;
    } catch (error) {
        console.log('❌ HTTP endpoints error:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Bridge Connection Test');
    console.log('=' + '='.repeat(40));
    
    const wsTest = await testBridgeConnection();
    const httpTest = await testHttpEndpoints();
    
    console.log('\n📊 Results:');
    console.log(`WebSocket connection: ${wsTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`HTTP endpoints: ${httpTest ? '✅ PASS' : '❌ FAIL'}`);
    
    if (wsTest && httpTest) {
        console.log('🎉 Bridge server is working correctly!');
    } else {
        console.log('⚠️ Bridge server has issues');
    }
}

if (require.main === module) {
    main().catch(console.error);
}