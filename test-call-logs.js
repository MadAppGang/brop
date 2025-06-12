#!/usr/bin/env node
/**
 * Test Call Logs
 * Direct test of the GET_LOGS functionality
 */

const WebSocket = require('ws');

let messageId = 0;

async function testCallLogs() {
    console.log('📝 Testing Call Logs Functionality');
    console.log('=' + '='.repeat(35));
    
    let ws = null;
    
    try {
        console.log('📋 Connecting to BROP bridge...');
        
        ws = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        console.log('✅ Connected to BROP bridge');
        
        // First, generate some commands to create logs
        console.log('\n📋 Step 1: Generating some commands to create logs...');
        
        const testCommands = [
            { type: 'test_reload_feature', message: 'Log test 1' },
            { type: 'get_extension_errors' },
            { type: 'navigate', url: 'https://example.com' }
        ];
        
        for (let i = 0; i < testCommands.length; i++) {
            const cmd = testCommands[i];
            console.log(`   ${i + 1}. Sending ${cmd.type}...`);
            
            try {
                const result = await sendCommand(ws, cmd);
                console.log(`      ${result.success ? '✅' : '❌'} ${result.success ? 'Success' : result.error?.substring(0, 30) + '...'}`);
            } catch (error) {
                console.log(`      ❌ Error: ${error.message.substring(0, 30)}...`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Now test the GET_LOGS via bridge (like the popup does)
        console.log('\n📋 Step 2: Testing GET_LOGS via WebSocket bridge...');
        
        const logsResult = await sendCommand(ws, {
            type: 'GET_LOGS',
            limit: 10
        });
        
        if (logsResult.success) {
            console.log('✅ GET_LOGS command worked via bridge!');
            console.log(`   Total logs returned: ${logsResult.result?.logs?.length || 0}`);
            
            if (logsResult.result?.logs?.length > 0) {
                console.log('\n📋 Recent log entries:');
                logsResult.result.logs.slice(-3).forEach((log, index) => {
                    console.log(`   ${index + 1}. ${log.method} - ${log.success ? 'Success' : 'Failed'} (${log.timestamp})`);
                });
            } else {
                console.log('   ⚠️  No logs returned - this might be the issue!');
            }
        } else {
            console.log('❌ GET_LOGS command failed via bridge');
            console.log(`   Error: ${logsResult.error}`);
        }
        
        ws.close();
        
        // Now test GET_LOGS via Chrome extension runtime message (like popup does)
        console.log('\n📋 Step 3: Simulating popup GET_LOGS call...');
        console.log('   (This tests the chrome.runtime.sendMessage path)');
        
        // This would normally be done by popup_enhanced.js:
        // const response = await chrome.runtime.sendMessage({ type: 'GET_LOGS', limit: 100 });
        console.log('   💡 To fully test this:');
        console.log('      1. Open BROP extension popup');
        console.log('      2. Open browser DevTools');
        console.log('      3. Check console for [BROP Popup] messages');
        console.log('      4. Go to Call Logs tab and check if entries appear');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `log_test_${messageId}`;
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

testCallLogs();