#!/usr/bin/env node
/**
 * Get Chrome Extension Interface Errors
 * This attempts to detect the actual Chrome extension errors like the tab debugger issues
 */

const WebSocket = require('ws');

let messageId = 0;

async function getChromeExtensionErrors() {
    console.log('🔍 Getting Chrome Extension Interface Errors');
    console.log('=' + '='.repeat(45));
    
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
        
        // Get Chrome extension interface errors
        console.log('\\n📋 Checking Chrome extension state and errors...');
        
        const chromeErrorResult = await sendCommand(ws, {
            type: 'get_chrome_extension_errors'
        });
        
        if (chromeErrorResult.success) {
            const data = chromeErrorResult.result;
            
            console.log('\\n📊 Chrome Extension State Analysis:');
            console.log('=' + '='.repeat(45));
            console.log(`❌ Total Chrome Errors Found: ${data.total_chrome_errors}`);
            console.log(`🔧 Debugger Attached Tabs: ${data.debugger_attached_tabs?.length || 0}`);
            console.log(`📋 Debugger Sessions: ${data.debugger_sessions?.length || 0}`);
            
            if (data.debugger_attached_tabs && data.debugger_attached_tabs.length > 0) {
                console.log(`\\n🔍 Attached Tab IDs: ${data.debugger_attached_tabs.join(', ')}`);
            }
            
            if (data.debugger_sessions && data.debugger_sessions.length > 0) {
                console.log(`🔍 Session Tab IDs: ${data.debugger_sessions.join(', ')}`);
            }
            
            if (data.chrome_errors && data.chrome_errors.length > 0) {
                console.log(`\\n❌ Chrome Extension Errors (${data.chrome_errors.length} found):`);
                console.log('-'.repeat(80));
                
                data.chrome_errors.forEach((error, i) => {
                    const timestamp = new Date(error.timestamp).toLocaleString();
                    console.log(`\\n${i + 1}. ${error.type}`);
                    console.log(`   ⏰ Time: ${timestamp}`);
                    console.log(`   💬 Message: ${error.message}`);
                    console.log(`   📍 Source: ${error.source}`);
                    
                    if (error.tabId) {
                        console.log(`   🗂️  Tab ID: ${error.tabId}`);
                    }
                });
                
                // Check specifically for tab-related errors
                const tabErrors = data.chrome_errors.filter(e => 
                    e.message.includes('tab') || e.type.includes('Tab') || e.type.includes('Debugger')
                );
                
                if (tabErrors.length > 0) {
                    console.log(`\\n🎯 Tab-Related Errors (${tabErrors.length} found):`);
                    tabErrors.forEach((error, i) => {
                        console.log(`   ${i + 1}. ${error.message}`);
                        if (error.tabId) {
                            console.log(`      Tab ID: ${error.tabId}`);
                        }
                    });
                }
                
            } else {
                console.log('\\n✅ No Chrome extension state errors detected');
            }
            
            console.log(`\\n💡 ${data.note}`);
            console.log(`\\n⚠️  ${data.limitation}`);
            
            if (data.error) {
                console.log(`\\n❌ Additional Error: ${data.error}`);
            }
            
        } else {
            console.log(`❌ Failed to get Chrome extension errors: ${chromeErrorResult.error}`);
        }
        
        // Also get our custom logged errors for comparison
        console.log('\\n📋 Comparing with custom logged errors...');
        
        const customErrorResult = await sendCommand(ws, {
            type: 'get_extension_errors',
            limit: 5
        });
        
        if (customErrorResult.success) {
            console.log(`\\n📊 Custom Logged Errors: ${customErrorResult.result.total_errors} total`);
            
            if (customErrorResult.result.errors && customErrorResult.result.errors.length > 0) {
                const recentErrors = customErrorResult.result.errors.slice(0, 3);
                console.log('   📋 Most Recent:');
                recentErrors.forEach((error, i) => {
                    console.log(`      ${i + 1}. ${error.type}: ${error.message.substring(0, 60)}...`);
                });
            }
        }
        
        console.log('\\n🎯 Summary:');
        console.log('=' + '='.repeat(20));
        console.log('- Chrome Extension API has limited error exposure');
        console.log('- Tab debugger attachment issues are detectable through state checks');
        console.log('- For full Chrome extension console errors, check chrome://extensions/');
        console.log('- The "Failed to attach debugger to tab" error should be detectable here');
        
    } catch (error) {
        console.error('❌ Failed to get Chrome extension errors:', error.message);
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
        const id = `chrome_error_check_${messageId}`;
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

getChromeExtensionErrors();