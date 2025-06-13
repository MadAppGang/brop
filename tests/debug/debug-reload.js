#!/usr/bin/env node
/**
 * Reload Extension
 * Quick utility to reload the BROP extension
 */

const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

let messageId = 0;

async function reloadExtension() {
    console.log('🔄 Reloading BROP Extension');
    console.log('=' + '='.repeat(25));
    
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
        
        // Reload extension
        console.log('\\n📋 Scheduling extension reload...');
        
        const reloadResult = await sendCommand(ws, {
            method: 'reload_extension',
            params: {
                reason: 'Debug reload requested',
                delay: 1000
            }
        });
        
        if (reloadResult.success) {
            console.log('✅ Extension reload scheduled');
            console.log(`   ${reloadResult.result.message}`);
            console.log(`   Reason: ${reloadResult.result.reason}`);
            
            const reloadTime = new Date(reloadResult.result.scheduled_time).toLocaleTimeString();
            console.log(`   Reload time: ${reloadTime}`);
            
            console.log('\\n🎯 Extension will reload shortly...');
        } else {
            console.log(`❌ Failed to reload extension: ${reloadResult.error}`);
        }
        
    } catch (error) {
        console.error('❌ Reload operation failed:', error.message);
    } finally {
        if (ws) {
            ws.close();
            console.log('\\n🔚 Reload operation completed');
        }
    }
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `reload_${messageId}`;
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

reloadExtension();