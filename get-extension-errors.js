#!/usr/bin/env node
/**
 * Get Extension Errors
 * Retrieve and display all extension errors for debugging
 */

const WebSocket = require('ws');

let messageId = 0;

async function getExtensionErrors() {
    console.log('🔍 Getting Extension Errors');
    console.log('=' + '='.repeat(30));
    
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
        
        // Get extension errors
        console.log('\\n📋 Retrieving extension errors...');
        
        const errorResult = await sendCommand(ws, {
            type: 'get_extension_errors',
            limit: 50  // Get up to 50 recent errors
        });
        
        if (errorResult.success) {
            const errorData = errorResult.result;
            
            console.log('\\n📊 Extension Error Report:');
            console.log('=' + '='.repeat(35));
            console.log(`📈 Total Errors: ${errorData.total_errors}`);
            console.log(`💾 Max Stored: ${errorData.max_stored}`);
            console.log(`🔧 Extension: ${errorData.extension_info?.name} v${errorData.extension_info?.version}`);
            console.log(`🆔 Extension ID: ${errorData.extension_info?.id}`);
            
            if (errorData.errors && errorData.errors.length > 0) {
                console.log(`\\n❌ Recent Errors (${errorData.errors.length} shown):`);
                console.log('-'.repeat(80));
                
                errorData.errors.forEach((error, i) => {
                    const timestamp = new Date(error.timestamp).toLocaleString();
                    console.log(`\\n${i + 1}. ${error.type}`);
                    console.log(`   ⏰ Time: ${timestamp}`);
                    console.log(`   💬 Message: ${error.message}`);
                    
                    if (error.stack && error.stack.length < 200) {
                        console.log(`   📍 Stack: ${error.stack}`);
                    } else if (error.stack) {
                        console.log(`   📍 Stack: ${error.stack.substring(0, 150)}...`);
                    }
                    
                    if (error.url && error.url !== 'Extension Background') {
                        console.log(`   🌐 URL: ${error.url}`);
                    }
                });
                
                console.log('\\n🎯 Error Summary by Type:');
                const errorTypes = {};
                errorData.errors.forEach(error => {
                    errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
                });
                
                Object.entries(errorTypes).forEach(([type, count]) => {
                    console.log(`   ${type}: ${count} errors`);
                });
                
            } else {
                console.log('\\n✅ No errors found! Extension is running cleanly.');
            }
            
        } else {
            console.log(`❌ Failed to get extension errors: ${errorResult.error}`);
        }
        
    } catch (error) {
        console.error('❌ Failed to retrieve extension errors:', error.message);
    } finally {
        if (ws) {
            ws.close();
            console.log('\\n🔚 Connection closed');
        }
    }
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `error_check_${messageId}`;
        const message = {
            id: id,
            command: command
        };
        
        const timeout = setTimeout(() => {
            reject(new Error(`Command timeout`));
        }, 10000);
        
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

getExtensionErrors();