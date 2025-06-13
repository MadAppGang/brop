#!/usr/bin/env node
/**
 * Clear Extension Errors and Logs
 * Quick utility to clear errors and logs for a fresh test run
 */

const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

let messageId = 0;

async function clearExtensionData() {
    console.log('🧹 Clearing Extension Errors and Logs');
    console.log('=' + '='.repeat(35));
    
    let ws = null;
    
    try {
        console.log('📋 Connecting to BROP bridge...');
        
        ws = createBROPConnection();
        
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        console.log('✅ Connected to BROP bridge');
        
        // Clear errors and logs
        console.log('\\n📋 Clearing extension data...');
        
        const clearResult = await sendCommand(ws, {
            method: 'clear_extension_errors',
            params: {
                clearLogs: true  // Also clear call logs
            }
        });
        
        if (clearResult.success) {
            console.log('✅ Successfully cleared extension data');
            console.log(`   ${clearResult.result.message}`);
            console.log('\\n🎯 Extension is now ready for fresh testing');
        } else {
            console.log(`❌ Failed to clear data: ${clearResult.error}`);
        }
        
    } catch (error) {
        console.error('❌ Clear operation failed:', error.message);
    } finally {
        if (ws) {
            ws.close();
            console.log('\\n🔚 Clear operation completed');
        }
    }
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `clear_${messageId}`;
        const message = {
            id: id,
            ...command
        };
        
        const timeout = setTimeout(() => {
            reject(new Error(`Command timeout`));
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
                reject(new Error(`Response parsing failed: ${error.message}`));
            }
        };
        
        ws.on('message', messageHandler);
        ws.send(JSON.stringify(message));
    });
}

clearExtensionData();