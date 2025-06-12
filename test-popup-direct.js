#!/usr/bin/env node
/**
 * Test Popup Direct Communication
 * Test the exact path the popup uses to get logs
 */

const WebSocket = require('ws');

let messageId = 0;

async function testPopupPath() {
    console.log('🔍 Testing Popup Communication Path');
    console.log('=' + '='.repeat(35));
    
    let ws = null;
    
    try {
        console.log('📋 Step 1: Connecting to BROP bridge...');
        
        ws = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        console.log('✅ Connected to BROP bridge');
        
        // Generate some commands that should create logs
        console.log('\n📋 Step 2: Generating commands to create logs...');
        
        const commands = [
            { type: 'test_reload_feature' },
            { type: 'get_extension_errors' },
            { type: 'navigate', url: 'https://example.com' }
        ];
        
        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            console.log(`   ${i + 1}. ${cmd.type}`);
            
            try {
                const result = await sendCommand(ws, cmd);
                console.log(`      ${result.success ? '✅' : '❌'} ${result.success ? 'Success' : 'Failed'}`);
            } catch (error) {
                console.log(`      ❌ Error: ${error.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        ws.close();
        
        console.log('\n📋 Step 3: The issue is that GET_LOGS is NOT a WebSocket command!');
        console.log('   The popup uses chrome.runtime.sendMessage(), not WebSocket.');
        console.log('   This means:');
        console.log('   ✅ Commands via WebSocket DO generate logs (we just ran 3)');
        console.log('   ❌ GET_LOGS is only accessible via Chrome runtime messages');
        console.log('   💡 The popup should now show the 3 commands we just ran');
        
        console.log('\n🎯 Next Steps:');
        console.log('   1. Open the BROP extension popup in Chrome');
        console.log('   2. Click the "Call Logs" tab');
        console.log('   3. You should see 3 log entries from the commands above');
        console.log('   4. If not, check browser console for popup error messages');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `popup_path_test_${messageId}`;
        const message = {
            id: id,
            command: command
        };
        
        const timeout = setTimeout(() => {
            reject(new Error(`Command timeout`));
        }, 8000);
        
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

testPopupPath();