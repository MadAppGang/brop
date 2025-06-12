#!/usr/bin/env node
/**
 * Generate logs for popup testing
 */

const WebSocket = require('ws');

let messageId = 0;

async function generateLogsForPopup() {
    console.log('📝 Generating Logs for Popup Testing');
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
        
        // Generate several different types of commands for variety
        const commands = [
            { type: 'get_extension_errors', limit: 5 },
            { type: 'navigate', url: 'https://example.com' },
            { type: 'get_screenshot', format: 'png' },
            { type: 'get_page_content' },
            { type: 'get_simplified_dom', max_depth: 2 },
            { type: 'navigate', url: 'https://httpbin.org/html' },
            { type: 'invalid_test_command' } // This should fail and create an error
        ];
        
        console.log(`\\n📋 Running ${commands.length} commands to generate log entries...`);
        
        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            console.log(`   ${i + 1}. ${cmd.type}`);
            
            try {
                const result = await sendCommand(ws, cmd);
                console.log(`      ${result.success ? '✅' : '❌'} ${result.success ? 'Success' : result.error?.substring(0, 50) + '...'}`);
            } catch (error) {
                console.log(`      ❌ Exception: ${error.message.substring(0, 50)}...`);
            }
            
            // Small delay between commands
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        console.log('\\n✅ Commands completed!');
        console.log('\\n🎯 Next Steps:');
        console.log('   1. Open the BROP extension popup');
        console.log('   2. Click on the "Call Logs" tab');
        console.log('   3. You should see the commands we just ran');
        console.log('   4. Check browser console for [BROP Popup] debug messages');
        console.log('   5. Each log entry should be clickable for details');
        
    } catch (error) {
        console.error('❌ Failed to generate logs:', error.message);
    } finally {
        if (ws) {
            ws.close();
            console.log('\\n🔚 Cleanup completed');
        }
    }
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `popup_test_${messageId}`;
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

generateLogsForPopup();