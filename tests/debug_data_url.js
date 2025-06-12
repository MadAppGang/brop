#!/usr/bin/env node
/**
 * Debug Data URL
 * 
 * Test with data URLs that should allow script execution
 */

const WebSocket = require('ws');

async function testDataUrl() {
    console.log('🔍 Test Data URL');
    console.log('=' + '='.repeat(60));
    
    try {
        // Create target
        console.log('📡 Creating target...');
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
                console.log('📥 Response:', JSON.stringify(response, null, 2));
                
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
        
        // Test with page endpoint - navigate to data URL first
        console.log(`\n📡 Testing navigation to data URL...`);
        const pageWs = new WebSocket(`ws://localhost:9300/`);
        
        await new Promise((resolve, reject) => {
            pageWs.on('open', () => {
                console.log(`✅ Connected to page endpoint`);
                
                // Navigate to a data URL first
                console.log('📤 Navigating to data URL...');
                pageWs.send(JSON.stringify({
                    id: 1,
                    method: 'Page.navigate',
                    params: { 
                        url: 'data:text/html,<html><head><title>Test Page</title></head><body><h1>Working Page</h1><script>window.testValue = 42;</script></body></html>' 
                    }
                }));
                
                setTimeout(() => {
                    console.log('📤 Testing Runtime.evaluate...');
                    pageWs.send(JSON.stringify({
                        id: 2,
                        method: 'Runtime.evaluate',
                        params: { expression: 'window.testValue || "undefined"' }
                    }));
                }, 3000);
            });
            
            pageWs.on('message', (data) => {
                const response = JSON.parse(data.toString());
                console.log(`📥 Page response:`, response);
                
                if (response.id === 2) {
                    setTimeout(() => {
                        pageWs.close();
                        resolve();
                    }, 500);
                }
            });
            
            pageWs.on('error', reject);
            setTimeout(() => {
                pageWs.close();
                resolve();
            }, 8000);
        });
        
        return true;
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🎯 Debug Data URL Test');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Test navigation and evaluation with data URLs');
    console.log('');
    
    await testDataUrl();
}

main();