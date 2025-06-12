#!/usr/bin/env node
/**
 * Debug Page Server
 * 
 * Test individual page server functionality
 */

const WebSocket = require('ws');

async function testPageServerBasics() {
    console.log('🔍 Test Page Server Basics');
    console.log('=' + '='.repeat(60));
    
    try {
        // Step 1: Create target via main endpoint
        console.log('📡 Step 1: Create target...');
        const mainWs = new WebSocket('ws://localhost:9222');
        
        let targetId = null;
        
        await new Promise((resolve, reject) => {
            mainWs.on('open', () => {
                console.log('✅ Connected to main endpoint');
                mainWs.send(JSON.stringify({
                    id: 1,
                    method: 'Target.createTarget',
                    params: { url: 'about:blank' }
                }));
            });
            
            mainWs.on('message', (data) => {
                const response = JSON.parse(data.toString());
                console.log('📥 Main response:', JSON.stringify(response, null, 2));
                
                if (response.id === 1 && response.result?.targetId) {
                    targetId = response.result.targetId;
                    console.log(`✅ Target ID: ${targetId}`);
                    resolve();
                }
            });
            
            mainWs.on('error', reject);
            setTimeout(() => reject(new Error('Timeout')), 5000);
        });
        
        mainWs.close();
        
        // Step 2: Test page server connection
        console.log('\n📡 Step 2: Test page server...');
        
        // Try different ports to find the page server
        const ports = [9300, 9301, 9302];
        let connectedPort = null;
        
        for (const port of ports) {
            try {
                console.log(`Trying port ${port}...`);
                const pageWs = new WebSocket(`ws://localhost:${port}/`);
                
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 2000);
                    
                    pageWs.on('open', () => {
                        clearTimeout(timeout);
                        connectedPort = port;
                        console.log(`✅ Connected to page server on port ${port}`);
                        
                        // Test basic command
                        pageWs.send(JSON.stringify({
                            id: 100,
                            method: 'Runtime.evaluate',
                            params: { expression: '1 + 1' }
                        }));
                    });
                    
                    pageWs.on('message', (data) => {
                        const response = JSON.parse(data.toString());
                        console.log('📥 Page server response:', JSON.stringify(response, null, 2));
                        
                        pageWs.close();
                        resolve();
                    });
                    
                    pageWs.on('error', () => {
                        clearTimeout(timeout);
                        reject(new Error('Connection failed'));
                    });
                });
                
                break; // Successfully connected
                
            } catch (error) {
                console.log(`❌ Port ${port} failed: ${error.message}`);
            }
        }
        
        if (connectedPort) {
            console.log(`✅ Page server working on port ${connectedPort}`);
            return true;
        } else {
            console.log('❌ No page server found');
            return false;
        }
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🎯 Debug Page Server');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Test individual page server components');
    console.log('');
    
    await testPageServerBasics();
}

main();