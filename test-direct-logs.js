#!/usr/bin/env node
/**
 * Test Direct Logs Communication
 * This tests the exact same path the popup uses to get logs
 */

const WebSocket = require('ws');

// This simulates exactly what the popup does:
// chrome.runtime.sendMessage({ type: 'GET_LOGS', limit: 100 })

async function testDirectLogsAccess() {
    console.log('🔍 Testing Direct Logs Access (Popup Path)');
    console.log('=' + '='.repeat(45));
    
    console.log('❌ Cannot directly test chrome.runtime.sendMessage from Node.js');
    console.log('   This requires Chrome extension context');
    console.log('');
    console.log('🔧 Let\'s debug the logs storage instead...');
    
    // First generate some commands
    console.log('📋 Step 1: Generating commands to ensure logs exist...');
    
    let ws = null;
    
    try {
        ws = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        console.log('✅ Connected to BROP bridge');
        
        // Generate a few commands
        const testCommands = [
            { type: 'test_reload_feature', message: 'Debug test 1' },
            { type: 'get_extension_errors' },
            { type: 'navigate', url: 'https://httpbin.org/get' }
        ];
        
        console.log(`   Sending ${testCommands.length} commands...`);
        
        for (let i = 0; i < testCommands.length; i++) {
            const cmd = testCommands[i];
            try {
                const result = await sendCommand(ws, cmd);
                console.log(`   ${i + 1}. ${cmd.type}: ${result.success ? '✅' : '❌'}`);
            } catch (error) {
                console.log(`   ${i + 1}. ${cmd.type}: ❌ ${error.message}`);
            }
        }
        
        ws.close();
        
    } catch (error) {
        console.error('❌ Failed to generate commands:', error.message);
    }
    
    console.log('\n📋 Step 2: What we know about the issue...');
    console.log('   ✅ Popup shows "38 total calls" - logs ARE being stored');
    console.log('   ❌ Popup shows no visible entries - display logic issue');
    console.log('   💡 Possible causes:');
    console.log('      1. GET_LOGS returning empty array despite storage');
    console.log('      2. Popup receiving logs but failing to render them');
    console.log('      3. Filtering logic hiding all entries');
    console.log('      4. UI rendering issue in popup');
    console.log('');
    
    console.log('🔧 Debug Actions for User:');
    console.log('   1. Open BROP extension popup');
    console.log('   2. Open browser DevTools (F12)');
    console.log('   3. Go to Console tab');
    console.log('   4. Look for these debug messages:');
    console.log('      • [BROP Popup] Loading logs...');
    console.log('      • [BROP Popup] Logs response: {...}');
    console.log('      • [BROP Popup] Loaded X logs');
    console.log('   5. Check what the logs response actually contains');
    console.log('');
    
    console.log('🔍 Key Questions to Answer:');
    console.log('   • Does logs response contain an array?');
    console.log('   • How many logs are in the response?');
    console.log('   • Are the logs being filtered out?');
    console.log('   • Is the UI rendering failing?');
    console.log('');
    
    console.log('📋 Quick Test:');
    console.log('   In the popup console, try manually:');
    console.log('   chrome.runtime.sendMessage({type: "GET_LOGS", limit: 10}, console.log)');
    console.log('   This will show exactly what the background script returns');
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        const id = `debug_${Date.now()}`;
        const message = { id, command };
        
        const timeout = setTimeout(() => {
            reject(new Error(`Timeout`));
        }, 5000);
        
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
                reject(new Error(`Parse error`));
            }
        };
        
        ws.on('message', messageHandler);
        ws.send(JSON.stringify(message));
    });
}

testDirectLogsAccess();