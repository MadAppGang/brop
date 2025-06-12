#!/usr/bin/env node
/**
 * Simple Page Test
 * 
 * Test page commands with data URLs that should work
 */

const WebSocket = require('ws');

async function testPageCommands() {
    console.log('🔍 Simple Page Command Test');
    console.log('=' + '='.repeat(60));
    
    try {
        // Step 1: Create target with data URL
        console.log('📡 Step 1: Create target with data URL...');
        const mainWs = new WebSocket('ws://localhost:9222');
        
        let targetId = null;
        
        await new Promise((resolve, reject) => {
            mainWs.on('open', () => {
                console.log('✅ Connected to main endpoint');
                mainWs.send(JSON.stringify({
                    id: 1,
                    method: 'Target.createTarget',
                    params: { url: 'data:text/html,<h1>Test Page</h1><p>Hello World</p>' }
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
        
        // Step 2: Test page server with simple commands
        console.log(`\n📡 Step 2: Test page server commands...`);
        const pageWs = new WebSocket(`ws://localhost:9300/`);
        
        const responses = [];
        
        await new Promise((resolve, reject) => {
            pageWs.on('open', () => {
                console.log(`✅ Connected to page endpoint`);
                
                // Test simple runtime command that should work
                console.log('📤 Testing Runtime.evaluate...');
                pageWs.send(JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: { expression: '1 + 1' }
                }));
            });
            
            pageWs.on('message', (data) => {
                const response = JSON.parse(data.toString());
                responses.push(response);
                console.log(`📥 Page response:`, response);
                
                if (response.id === 1) {
                    setTimeout(() => {
                        pageWs.close();
                        resolve();
                    }, 500);
                }
            });
            
            pageWs.on('error', reject);
            setTimeout(() => reject(new Error('Timeout')), 10000);
        });
        
        console.log(`\n📊 Results: ${responses.length} responses`);
        const successful = responses.filter(r => r.result && !r.error).length;
        console.log(`✅ Successful: ${successful}/${responses.length}`);
        
        return successful > 0;
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🎯 Simple Page Command Test');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Test basic page commands with simple data URL');
    console.log('');
    
    const success = await testPageCommands();
    console.log(`\nResult: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
}

main();