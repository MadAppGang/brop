#!/usr/bin/env node
/**
 * Debug Logs and Errors
 * Test both the error reporting functionality and check why popup logs aren't showing
 */

const WebSocket = require('ws');

let messageId = 0;

async function debugLogsAndErrors() {
    console.log('🔍 Debug Logs and Error Reporting');
    console.log('=' + '='.repeat(40));
    
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
        
        // Test 1: Generate some commands to create log entries
        console.log('\\n📋 Step 2: Generating commands to create log entries...');
        
        const testCommands = [
            { type: 'get_screenshot', format: 'png' },
            { type: 'navigate', url: 'https://example.com' },
            { type: 'get_page_content' },
            { type: 'get_simplified_dom', max_depth: 2 }
        ];
        
        for (let i = 0; i < testCommands.length; i++) {
            const cmd = testCommands[i];
            console.log(`   Running ${cmd.type}...`);
            
            try {
                const result = await sendCommand(ws, cmd);
                console.log(`   ${cmd.type}: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
                if (!result.success) {
                    console.log(`      Error: ${result.error}`);
                }
            } catch (error) {
                console.log(`   ${cmd.type}: ❌ EXCEPTION - ${error.message}`);
            }
            
            // Small delay between commands
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Test 2: Check if the new error reporting command works
        console.log('\\n📋 Step 3: Testing extension error reporting...');
        
        try {
            const errorResult = await sendCommand(ws, {
                type: 'get_extension_errors',
                limit: 20
            });
            
            if (errorResult.success) {
                console.log('✅ Error reporting command works!');
                console.log(`   Total errors stored: ${errorResult.result.total_errors || 0}`);
                console.log(`   Max errors stored: ${errorResult.result.max_stored || 0}`);
                console.log(`   Extension: ${errorResult.result.extension_info?.name || 'Unknown'} v${errorResult.result.extension_info?.version || 'Unknown'}`);
                
                if (errorResult.result.errors && errorResult.result.errors.length > 0) {
                    console.log('   📋 Recent errors:');
                    errorResult.result.errors.slice(0, 3).forEach((error, i) => {
                        console.log(`      ${i + 1}. ${error.type}: ${error.message}`);
                        console.log(`         At: ${new Date(error.timestamp).toLocaleString()}`);
                    });
                } else {
                    console.log('   ✅ No errors found (good!)');
                }
            } else {
                console.log(`❌ Error reporting failed: ${errorResult.error}`);
            }
        } catch (error) {
            console.log(`❌ Error reporting exception: ${error.message}`);
        }
        
        // Test 3: Try to trigger an error intentionally to test error capture
        console.log('\\n📋 Step 4: Testing error capture by triggering an invalid command...');
        
        try {
            const invalidResult = await sendCommand(ws, {
                type: 'invalid_command_that_should_fail',
                some_param: 'test'
            });
            
            console.log(`Unexpected success from invalid command: ${JSON.stringify(invalidResult)}`);
        } catch (error) {
            console.log(`✅ Invalid command correctly failed: ${error.message}`);
        }
        
        // Wait a moment for error to be logged
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test 4: Check errors again to see if our test error was captured
        console.log('\\n📋 Step 5: Checking if test error was captured...');
        
        try {
            const errorResult2 = await sendCommand(ws, {
                type: 'get_extension_errors',
                limit: 5
            });
            
            if (errorResult2.success) {
                console.log(`   Total errors now: ${errorResult2.result.total_errors || 0}`);
                
                if (errorResult2.result.errors && errorResult2.result.errors.length > 0) {
                    console.log('   📋 Latest errors:');
                    errorResult2.result.errors.slice(0, 2).forEach((error, i) => {
                        console.log(`      ${i + 1}. ${error.type}: ${error.message.substring(0, 80)}...`);
                    });
                } else {
                    console.log('   No errors captured');
                }
            }
        } catch (error) {
            console.log(`❌ Error check failed: ${error.message}`);
        }
        
        console.log('\\n🎯 Debug Summary:');
        console.log('=' + '='.repeat(25));
        console.log('✅ Commands generated for log testing');
        console.log('✅ Error reporting functionality tested');
        console.log('✅ Error capture mechanism tested');
        console.log('\\n💡 Next: Check popup to see if logs appear');
        console.log('   - Open BROP extension popup');
        console.log('   - Go to "Call Logs" tab');
        console.log('   - Look for the commands we just ran');
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    } finally {
        if (ws) {
            ws.close();
            console.log('\\n🔚 Debug cleanup completed');
        }
    }
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `logs_debug_${messageId}`;
        const message = {
            id: id,
            command: command
        };
        
        const timeout = setTimeout(() => {
            reject(new Error(`Command ${command.type} timeout`));
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

debugLogsAndErrors();