#!/usr/bin/env node
/**
 * Test BROP extension status and simplified DOM command
 */

const WebSocket = require('ws');

async function testExtensionStatus() {
    console.log('🔍 Testing BROP Extension Status and Simplified DOM');
    console.log('=' + '='.repeat(50));
    
    try {
        // Test basic BROP command first
        console.log('\n📋 Step 1: Testing basic console command...');
        const ws1 = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            let resolved = false;
            
            ws1.on('open', () => {
                console.log('✅ Connected to BROP server');
                
                const consoleMessage = {
                    id: 'test-console-1',
                    command: {
                        type: 'execute_console',
                        code: 'document.title'
                    }
                };
                
                console.log('📤 Sending console command...');
                ws1.send(JSON.stringify(consoleMessage));
            });
            
            ws1.on('message', (data) => {
                if (resolved) return;
                resolved = true;
                
                try {
                    const response = JSON.parse(data.toString());
                    console.log('📥 Console response:', response);
                    
                    if (response.success) {
                        console.log('✅ Basic console command working');
                    } else {
                        console.log('❌ Basic console command failed:', response.error);
                    }
                    
                    ws1.close();
                    resolve();
                } catch (error) {
                    console.error('❌ Error parsing console response:', error.message);
                    ws1.close();
                    reject(error);
                }
            });
            
            ws1.on('error', (error) => {
                if (resolved) return;
                resolved = true;
                console.error('❌ Console test error:', error.message);
                reject(error);
            });
            
            setTimeout(() => {
                if (resolved) return;
                resolved = true;
                console.log('⏰ Console test timeout');
                ws1.close();
                resolve();
            }, 5000);
        });

        // Test simplified DOM command
        console.log('\n📋 Step 2: Testing simplified DOM command...');
        const ws2 = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            let resolved = false;
            
            ws2.on('open', () => {
                console.log('✅ Connected to BROP server');
                
                const domMessage = {
                    id: 'test-dom-1',
                    command: {
                        type: 'get_simplified_dom',
                        max_depth: 3,
                        include_hidden: false
                    }
                };
                
                console.log('📤 Sending simplified DOM command...');
                ws2.send(JSON.stringify(domMessage));
            });
            
            ws2.on('message', (data) => {
                if (resolved) return;
                resolved = true;
                
                try {
                    const response = JSON.parse(data.toString());
                    console.log('📥 DOM response:', response);
                    
                    if (response.success) {
                        console.log('✅ Simplified DOM command working!');
                        if (response.result) {
                            console.log('📊 DOM result summary:');
                            console.log(`   - Interactive elements: ${response.result.total_interactive_elements || 'N/A'}`);
                            console.log(`   - Page structure: ${response.result.page_structure_summary || 'N/A'}`);
                        }
                    } else {
                        console.log('❌ Simplified DOM command failed:', response.error);
                        if (response.error.includes('Unsupported BROP command')) {
                            console.log('🔧 This suggests the extension needs to be reloaded to pick up the new handler');
                        }
                    }
                    
                    ws2.close();
                    resolve();
                } catch (error) {
                    console.error('❌ Error parsing DOM response:', error.message);
                    ws2.close();
                    reject(error);
                }
            });
            
            ws2.on('error', (error) => {
                if (resolved) return;
                resolved = true;
                console.error('❌ DOM test error:', error.message);
                reject(error);
            });
            
            setTimeout(() => {
                if (resolved) return;
                resolved = true;
                console.log('⏰ DOM test timeout');
                ws2.close();
                resolve();
            }, 5000);
        });

        console.log('\n📋 Step 3: Testing all available commands...');
        const ws3 = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            let resolved = false;
            
            ws3.on('open', () => {
                console.log('✅ Connected to BROP server');
                
                // Test commands one by one
                const commands = [
                    'get_console_logs',
                    'get_screenshot', 
                    'get_page_content',
                    'get_simplified_dom'
                ];
                
                let commandIndex = 0;
                
                function testNextCommand() {
                    if (commandIndex >= commands.length) {
                        ws3.close();
                        resolve();
                        return;
                    }
                    
                    const command = commands[commandIndex++];
                    const message = {
                        id: `test-${command}`,
                        command: { type: command }
                    };
                    
                    console.log(`📤 Testing command: ${command}`);
                    ws3.send(JSON.stringify(message));
                }
                
                testNextCommand();
            });
            
            ws3.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    const commandType = response.id?.replace('test-', '') || 'unknown';
                    
                    if (response.success) {
                        console.log(`   ✅ ${commandType}: SUCCESS`);
                    } else {
                        console.log(`   ❌ ${commandType}: FAILED - ${response.error}`);
                    }
                    
                    // Continue with next command after a short delay
                    setTimeout(() => {
                        if (!resolved) {
                            const commandIndex = ['get_console_logs', 'get_screenshot', 'get_page_content', 'get_simplified_dom'].indexOf(commandType) + 1;
                            if (commandIndex > 0 && commandIndex < 4) {
                                const nextCommand = ['get_console_logs', 'get_screenshot', 'get_page_content', 'get_simplified_dom'][commandIndex];
                                if (nextCommand) {
                                    const message = {
                                        id: `test-${nextCommand}`,
                                        command: { type: nextCommand }
                                    };
                                    console.log(`📤 Testing command: ${nextCommand}`);
                                    ws3.send(JSON.stringify(message));
                                } else {
                                    resolved = true;
                                    ws3.close();
                                    resolve();
                                }
                            } else {
                                resolved = true;
                                ws3.close();
                                resolve();
                            }
                        }
                    }, 500);
                } catch (error) {
                    console.error('❌ Error parsing response:', error.message);
                }
            });
            
            ws3.on('error', (error) => {
                if (resolved) return;
                resolved = true;
                console.error('❌ Commands test error:', error.message);
                reject(error);
            });
            
            setTimeout(() => {
                if (resolved) return;
                resolved = true;
                console.log('⏰ Commands test timeout');
                ws3.close();
                resolve();
            }, 15000);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
    
    console.log('\n🎯 Test Complete! Summary:');
    console.log('   - If simplified DOM failed: Extension needs reload');
    console.log('   - If basic commands work: BROP service is enabled ✅');
    console.log('   - Extension reload steps:');
    console.log('     1. Open chrome://extensions/');
    console.log('     2. Find "Browser Remote Operations Protocol"');
    console.log('     3. Click the reload button (↻)');
}

testExtensionStatus();