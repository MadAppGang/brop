#!/usr/bin/env node
/**
 * Debug Tab Status
 * 
 * Check what's actually happening with the tabs
 */

const WebSocket = require('ws');

async function checkTabStatus() {
    console.log('🔍 Check Tab Status');
    console.log('=' + '='.repeat(60));
    
    try {
        // Step 1: Create target and check tab URL
        console.log('📡 Step 1: Create target...');
        const mainWs = new WebSocket('ws://localhost:9222');
        
        let targetId = null;
        
        await new Promise((resolve, reject) => {
            mainWs.on('open', () => {
                console.log('✅ Connected to main endpoint');
                mainWs.send(JSON.stringify({
                    id: 1,
                    method: 'Target.createTarget',
                    params: { url: 'https://example.com' } // Use a real URL
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
        
        // Wait a moment for the tab to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 2: Test navigation
        console.log(`\n📡 Step 2: Test navigation to a working site...`);
        const pageWs = new WebSocket(`ws://localhost:9300/`);
        
        await new Promise((resolve, reject) => {
            pageWs.on('open', () => {
                console.log(`✅ Connected to page endpoint`);
                
                // Try to navigate to a real site
                console.log('📤 Testing Page.navigate to example.com...');
                pageWs.send(JSON.stringify({
                    id: 1,
                    method: 'Page.navigate',
                    params: { url: 'https://example.com' }
                }));
                
                setTimeout(() => {
                    console.log('📤 Testing Runtime.evaluate after navigation...');
                    pageWs.send(JSON.stringify({
                        id: 2,
                        method: 'Runtime.evaluate',
                        params: { expression: 'document.title' }
                    }));
                }, 3000);
            });
            
            pageWs.on('message', (data) => {
                const response = JSON.parse(data.toString());
                console.log(`📥 Page response:`, response);
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
    console.log('🎯 Debug Tab Status');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Check what URLs tabs actually have and test real navigation');
    console.log('');
    
    await checkTabStatus();
}

main();