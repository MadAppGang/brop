#!/usr/bin/env node
/**
 * Complete BROP Extension Debug Workflow
 * This script demonstrates the full debugging cycle:
 * 1. Clear errors for clean test run
 * 2. Run some test commands
 * 3. Check captured errors
 * 4. Reload extension if needed
 */

const WebSocket = require('ws');

let messageId = 0;

async function debugWorkflow() {
    console.log('🔧 BROP Extension Complete Debug Workflow');
    console.log('=' + '='.repeat(50));
    
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
        
        // Step 1: Clear all errors and logs for a clean test run
        console.log('\\n📋 Step 2: Clearing previous errors and logs...');
        
        const clearResult = await sendCommand(ws, {
            method: 'clear_extension_errors',
            params: { clearLogs: true }  // Also clear call logs
        });
        
        if (clearResult.success) {
            console.log('✅ Cleared for clean test run');
            console.log(`   ${clearResult.result.message}`);
        } else {
            console.log(`❌ Failed to clear: ${clearResult.error}`);
        }
        
        // Step 2: Run a series of test commands to generate activity
        console.log('\\n📋 Step 3: Running test commands to generate activity...');
        
        const testCommands = [
            { name: 'Extension Errors Check', cmd: { method: 'get_extension_errors', params: { limit: 5 } } },
            { name: 'Navigation Test', cmd: { method: 'navigate', params: { url: 'https://example.com' } } },
            { name: 'Screenshot Test', cmd: { method: 'get_screenshot', params: { format: 'png' } } },
            { name: 'Page Content Test', cmd: { method: 'get_page_content', params: {} } },
            { name: 'Simplified DOM Test', cmd: { method: 'get_simplified_dom', params: { max_depth: 2 } } },
            { name: 'Invalid Command Test', cmd: { method: 'this_command_does_not_exist', params: {} } }
        ];
        
        const results = [];
        
        for (let i = 0; i < testCommands.length; i++) {
            const test = testCommands[i];
            console.log(`   ${i + 1}. ${test.name}...`);
            
            try {
                const result = await sendCommand(ws, test.cmd);
                const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
                console.log(`      ${status}`);
                if (!result.success) {
                    console.log(`      Error: ${result.error?.substring(0, 60)}...`);
                }
                results.push({ test: test.name, success: result.success, error: result.error });
            } catch (error) {
                console.log(`      ❌ EXCEPTION: ${error.message.substring(0, 60)}...`);
                results.push({ test: test.name, success: false, error: error.message });
            }
            
            // Small delay between commands
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Step 3: Check what errors were captured
        console.log('\\n📋 Step 4: Checking captured errors...');
        
        const errorCheckResult = await sendCommand(ws, {
            method: 'get_extension_errors',
            params: { limit: 20 }
        });
        
        if (errorCheckResult.success) {
            const errorData = errorCheckResult.result;
            console.log(`\\n📊 Error Analysis:`);
            console.log(`   Total Errors: ${errorData.total_errors}`);
            
            if (errorData.errors && errorData.errors.length > 0) {
                console.log(`   Recent Errors (${errorData.errors.length} shown):`);
                
                errorData.errors.forEach((error, i) => {
                    const time = new Date(error.timestamp).toLocaleTimeString();
                    console.log(`      ${i + 1}. [${time}] ${error.type}: ${error.message.substring(0, 80)}...`);
                    if (error.context && Object.keys(error.context).length > 0) {
                        console.log(`         Context: ${JSON.stringify(error.context).substring(0, 60)}...`);
                    }
                });
                
                // Analyze error patterns
                const errorTypes = {};
                errorData.errors.forEach(error => {
                    errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
                });
                
                console.log(`\\n   📈 Error Breakdown:`);
                Object.entries(errorTypes).forEach(([type, count]) => {
                    console.log(`      ${type}: ${count} occurrences`);
                });
                
            } else {
                console.log('   ✅ No errors captured (clean run!)');
            }
        }
        
        // Step 4: Show test results summary
        console.log('\\n📋 Step 5: Test Results Summary:');
        console.log('-'.repeat(60));
        
        results.forEach((result, i) => {
            const status = result.success ? '✅' : '❌';
            console.log(`   ${status} ${result.test}`);
            if (!result.success && result.error) {
                console.log(`      Error: ${result.error.substring(0, 80)}...`);
            }
        });
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        
        console.log(`\\n📊 Success Rate: ${successCount}/${results.length} (${Math.round(successCount/results.length*100)}%)`);
        
        // Step 5: Offer to reload extension if there were significant issues
        if (failureCount > 2) {
            console.log('\\n📋 Step 6: Multiple failures detected. Extension reload recommended.');
            console.log('\\n🔄 To reload the extension, run:');
            console.log('   node debug-reload.js');
        } else {
            console.log('\\n✅ Extension appears to be functioning adequately.');
        }
        
        console.log('\\n🎯 Debug Workflow Commands Available:');
        console.log('=' + '='.repeat(45));
        console.log('📋 Error Management:');
        console.log('   • get_extension_errors - Get all captured errors');
        console.log('   • clear_extension_errors - Clear error history');
        console.log('   • clear_extension_errors + clearLogs:true - Clear errors & logs');
        console.log('\\n🔄 Extension Management:');
        console.log('   • reload_extension - Reload the extension');
        console.log('   • reload_extension + reason:"debug" - Reload with reason');
        console.log('   • reload_extension + delay:2000 - Reload with 2s delay');
        console.log('\\n🧪 Testing:');
        console.log('   • Run this script again for another debug cycle');
        console.log('   • Use individual test scripts for specific issues');
        
    } catch (error) {
        console.error('❌ Debug workflow failed:', error.message);
    } finally {
        if (ws) {
            ws.close();
            console.log('\\n🔚 Debug workflow completed');
        }
    }
}

function sendCommand(ws, commandData) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `debug_workflow_${messageId}`;
        const message = {
            id: id,
            method: commandData.method,
            params: commandData.params || {}
        };
        
        const timeout = setTimeout(() => {
            reject(new Error(`Command ${commandData.method} timeout`));
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

debugWorkflow();