#!/usr/bin/env node
/**
 * Debug console capture to see why we're not catching GitHub's console errors
 */

const WebSocket = require('ws');

async function testDebugConsoleCapture() {
    console.log('🔍 Debug Console Capture Test');
    console.log('==============================');
    console.log('🎯 Goal: Find out why we\'re missing GitHub\'s console errors');
    console.log('👀 Please keep Chrome DevTools Console open');
    console.log('');

    const ws = new WebSocket('ws://localhost:9223');
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Navigate to GitHub again
            console.log('\n📍 STEP 1: Navigating to GitHub...');
            const navCommand = {
                id: requestId++,
                command: {
                    type: 'navigate',
                    params: { url: 'https://github.com' }
                }
            };
            ws.send(JSON.stringify(navCommand));

            // Install console capture with debug info
            setTimeout(() => {
                console.log('\n📍 STEP 2: Installing console capture with debug info...');
                const captureCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 10 }
                    }
                };
                ws.send(JSON.stringify(captureCommand));
            }, 4000);

            // Wait longer for GitHub to load and generate errors
            setTimeout(() => {
                console.log('\n📍 STEP 3: Waiting for GitHub console errors to appear...');
                console.log('   ⏰ GitHub should be generating font CSP errors now...');
            }, 8000);

            // Get console logs again with debug info
            setTimeout(() => {
                console.log('\n📍 STEP 4: Getting console logs with debug info...');
                const debugLogsCommand = {
                    id: requestId++,
                    command: {
                        type: 'get_console_logs',
                        params: { limit: 50 }
                    }
                };
                ws.send(JSON.stringify(debugLogsCommand));
            }, 12000);

            // Close
            setTimeout(() => {
                console.log('\n🔍 Debug test completed!');
                console.log('📋 Please compare results with browser console');
                ws.close();
                resolve();
            }, 15000);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📥 Response ${message.id}:`, message.success ? '✅' : '❌');
                
                if (message.success && message.result) {
                    switch (message.id) {
                        case 1:
                            console.log('   ✅ Navigation to GitHub completed');
                            break;
                            
                        case 2:
                            console.log('   ✅ Console capture installed');
                            
                            if (message.result.debug_info) {
                                console.log('\n   🔍 DEBUG INFO (Initial):');
                                console.log(`   - Already installed: ${message.result.debug_info.alreadyInstalled}`);
                                console.log(`   - Console type: ${message.result.debug_info.consoleType}`);
                                console.log(`   - Log type: ${message.result.debug_info.logType}`);
                                console.log(`   - Setup completed: ${message.result.debug_info.setupCompleted}`);
                                console.log(`   - Test log added: ${message.result.debug_info.testLogAdded}`);
                                console.log(`   - Total captured: ${message.result.debug_info.totalCaptured}`);
                                console.log(`   - Backup count: ${message.result.debug_info.backupCount}`);
                            }
                            
                            if (message.result.logs && message.result.logs.length > 0) {
                                console.log('\n   📋 INITIAL CAPTURED LOGS:');
                                message.result.logs.forEach((log, index) => {
                                    console.log(`   ${index + 1}. [${log.level}] ${log.message}`);
                                });
                            }
                            break;
                            
                        case 3:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} console logs`);
                            
                            if (message.result.debug_info) {
                                console.log('\n   🔍 DEBUG INFO (After wait):');
                                console.log(`   - Already installed: ${message.result.debug_info.alreadyInstalled}`);
                                console.log(`   - Total captured: ${message.result.debug_info.totalCaptured}`);
                                console.log(`   - Backup count: ${message.result.debug_info.backupCount}`);
                                console.log(`   - Setup time: ${message.result.debug_info.setupTime ? new Date(message.result.debug_info.setupTime).toISOString() : 'N/A'}`);
                            }
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 ALL CAPTURED LOGS:');
                                console.log('   ' + '='.repeat(80));
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                                    if (log.args && log.args.length > 0) {
                                        console.log(`      Args: ${log.args.join(', ')}`);
                                    }
                                    if (log.captureIndex !== undefined) {
                                        console.log(`      Capture Index: ${log.captureIndex}`);
                                    }
                                });
                                console.log('   ' + '='.repeat(80));
                            } else {
                                console.log('\n   ❌ NO LOGS CAPTURED');
                                console.log('   🔍 This means either:');
                                console.log('      1. Console capture setup failed');
                                console.log('      2. GitHub errors occurred before our capture was installed');
                                console.log('      3. GitHub errors are not using console.error/warn/log/info');
                                console.log('      4. CSP is blocking our console override script');
                            }
                            
                            if (message.result.backup_logs && message.result.backup_logs.length > 0) {
                                console.log('\n   📁 BACKUP LOGS:');
                                message.result.backup_logs.forEach((log, index) => {
                                    console.log(`   ${index + 1}. [BACKUP] ${log.level}: ${log.message}`);
                                });
                            }
                            break;
                    }
                } else if (!message.success) {
                    console.log('   ❌ Error:', message.error);
                }
            } catch (error) {
                console.log('📝 Raw response:', data.toString().substring(0, 300) + '...');
            }
        });

        ws.on('error', (error) => {
            console.error('❌ Connection error:', error.message);
            resolve();
        });

        ws.on('close', () => {
            console.log('🔌 Disconnected from bridge');
            resolve();
        });
    });
}

if (require.main === module) {
    testDebugConsoleCapture().catch(console.error);
}