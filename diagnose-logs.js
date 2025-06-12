#!/usr/bin/env node
/**
 * Diagnose Logs Issue
 * Creates a comprehensive analysis of the logs problem
 */

const WebSocket = require('ws');

async function diagnoseLogs() {
    console.log('🔍 Diagnosing Logs Display Issue');
    console.log('=' + '='.repeat(35));
    
    console.log('📋 Analysis of the Problem:');
    console.log('');
    
    console.log('🔸 What we know:');
    console.log('   ✅ Popup shows "38 total calls" - storage IS working');
    console.log('   ❌ Popup shows no visible entries - display logic failing');
    console.log('');
    
    console.log('🔸 Log Structure Analysis:');
    console.log('   📝 Background script creates logs with this structure:');
    console.log('   {');
    console.log('     id: "log_timestamp_random",');
    console.log('     timestamp: Date.now(),');
    console.log('     method: "command_name",        // ✅ popup expects this');
    console.log('     type: "CDP" or "BROP",         // ✅ popup expects this');
    console.log('     params: JSON.stringify(params), // ✅ popup expects this');
    console.log('     result: JSON.stringify(result), // ✅ popup expects this');
    console.log('     error: error_message,          // ✅ popup expects this');
    console.log('     success: !error,               // ✅ popup expects this');
    console.log('     duration: duration             // ✅ popup expects this');
    console.log('   }');
    console.log('');
    
    console.log('🔸 Popup Display Logic Analysis:');
    console.log('   📝 Popup tries to access:');
    console.log('   • log.type.toLowerCase() - LINE 342 - POTENTIAL CRASH POINT!');
    console.log('   • log.method - should work');
    console.log('   • log.timestamp - should work');
    console.log('   • log.success - should work');
    console.log('   • JSON.parse(log.params) - should work');
    console.log('');
    
    console.log('🔸 Suspected Issues:');
    console.log('   1. 🚨 log.type might be undefined/null causing toLowerCase() crash');
    console.log('   2. 🚨 Popup filtering might be hiding all entries');
    console.log('   3. 🚨 Display rendering might be failing silently');
    console.log('');
    
    console.log('🔧 IMMEDIATE FIX NEEDED:');
    console.log('   Line 342 in popup_enhanced.js:');
    console.log('   CURRENT: const typeClass = log.type.toLowerCase();');
    console.log('   SHOULD BE: const typeClass = (log.type || "unknown").toLowerCase();');
    console.log('');
    
    console.log('🔧 User Debug Steps:');
    console.log('   1. Open BROP extension popup');
    console.log('   2. Open DevTools Console');
    console.log('   3. Look for JavaScript errors like:');
    console.log('      "Cannot read properties of undefined (reading \'toLowerCase\')"');
    console.log('   4. If you see that error, it confirms the issue');
    console.log('');
    
    console.log('🎯 Let me generate fresh logs and we\'ll fix the popup issue...');
    
    // Generate fresh logs
    try {
        const ws = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        console.log('✅ Connected - generating fresh logs...');
        
        const result = await sendCommand(ws, {
            type: 'test_reload_feature', 
            message: 'Diagnosis test'
        });
        
        console.log(`✅ Fresh log generated: ${result.success ? 'Success' : 'Failed'}`);
        
        ws.close();
        
    } catch (error) {
        console.log(`❌ Failed to generate logs: ${error.message}`);
    }
    
    console.log('');
    console.log('🚀 NEXT ACTION: I will fix the popup_enhanced.js file now...');
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        const id = `diag_${Date.now()}`;
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

diagnoseLogs();