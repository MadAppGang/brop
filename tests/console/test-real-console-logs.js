#!/usr/bin/env node
/**
 * Test real console logs from a website that naturally produces console output
 */

const { createNamedBROPConnection } = require('../../client');

async function testRealConsoleLogs() {
    console.log('🌐 Testing Real Console Logs');
    console.log('============================');
    console.log('👀 Please open Chrome DevTools (F12) -> Console tab');
    console.log('📋 We will open GitHub which often has console output');
    console.log('');

    const ws = createNamedBROPConnection('real-console-logs-test');
    let requestId = 1;
    let currentTabId = null;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Step 1: Get available tabs first
            console.log('\n📍 STEP 1: Getting available tabs...');
            const tabsCommand = {
                id: requestId++,
                method: 'list_tabs',
                params: {}
            };
            ws.send(JSON.stringify(tabsCommand));

            // Install console capture immediately after navigation
            setTimeout(() => {
                if (currentTabId) {
                    console.log('\n📍 STEP 3: Installing console capture...');
                    const captureCommand = {
                        id: requestId++,
                        method: 'get_console_logs',
                        params: { 
                            tabId: currentTabId,
                            limit: 5 
                        }
                    };
                    ws.send(JSON.stringify(captureCommand));
                }
            }, 3000);

            // Wait for page to fully load and generate logs
            setTimeout(() => {
                console.log('\n📍 STEP 4: Waiting for page to generate console logs...');
                console.log('   ⏰ Letting GitHub load completely...');
            }, 6000);

            // Get all console logs
            setTimeout(() => {
                if (currentTabId) {
                    console.log('\n📍 STEP 5: Retrieving all console logs...');
                    const logsCommand = {
                        id: requestId++,
                        method: 'get_console_logs',
                        params: { 
                            tabId: currentTabId,
                            limit: 50 
                        }
                    };
                    ws.send(JSON.stringify(logsCommand));
                }
            }, 10000);

            // Get recent logs again to see new activity
            setTimeout(() => {
                if (currentTabId) {
                    console.log('\n📍 STEP 6: Getting recent console activity...');
                    const recentLogsCommand = {
                        id: requestId++,
                        method: 'get_console_logs',
                        params: { 
                            tabId: currentTabId,
                            limit: 10 
                        }
                    };
                    ws.send(JSON.stringify(recentLogsCommand));
                }
            }, 13000);

            // Get only error logs
            setTimeout(() => {
                if (currentTabId) {
                    console.log('\n📍 STEP 7: Getting error logs only...');
                    const errorLogsCommand = {
                        id: requestId++,
                        method: 'get_console_logs',
                        params: { 
                            tabId: currentTabId,
                            limit: 20, 
                            level: 'error' 
                        }
                    };
                    ws.send(JSON.stringify(errorLogsCommand));
                }
            }, 16000);

            // Get only warning logs
            setTimeout(() => {
                if (currentTabId) {
                    console.log('\n📍 STEP 8: Getting warning logs only...');
                    const warnLogsCommand = {
                        id: requestId++,
                        method: 'get_console_logs',
                        params: { 
                            tabId: currentTabId,
                            limit: 20, 
                            level: 'warn' 
                        }
                    };
                    ws.send(JSON.stringify(warnLogsCommand));
                }
            }, 19000);

            // Close
            setTimeout(() => {
                console.log('\n✅ Real console logs test completed!');
                console.log('📋 Please compare the captured logs below with what you see in browser console');
                ws.close();
                resolve();
            }, 22000);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📥 Response ${message.id}:`, message.success ? '✅' : '❌');
                
                if (message.id === 1 && message.success) {
                    // Handle tabs list response
                    const tabs = message.result.tabs || [];
                    console.log(`   ✅ Found ${tabs.length} tabs`);
                    
                    const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                    
                    if (!accessibleTab) {
                        console.log('\n🔧 Creating new tab for GitHub testing...');
                        const createTabCommand = {
                            id: requestId++,
                            method: 'create_tab',
                            params: { url: 'https://github.com' }
                        };
                        ws.send(JSON.stringify(createTabCommand));
                        return;
                    }
                    
                    currentTabId = accessibleTab.tabId;
                    console.log(`   🎯 Using tab ${currentTabId}: ${accessibleTab.title}`);
                    
                    // Navigate to GitHub
                    console.log('\n📍 STEP 2: Navigating to GitHub...');
                    const navCommand = {
                        id: requestId++,
                        method: 'navigate',
                        params: { 
                            tabId: currentTabId,
                            url: 'https://github.com' 
                        }
                    };
                    ws.send(JSON.stringify(navCommand));
                    
                } else if (message.success && message.result && message.result.tabId) {
                    // Handle tab creation response
                    currentTabId = message.result.tabId;
                    console.log(`   ✅ Created new tab ${currentTabId}`);
                    
                } else if (message.success && message.result) {
                    switch (message.id) {
                        case 2:
                        case 3:
                            console.log('   ✅ Navigation to GitHub completed');
                            break;
                            
                        case 3:
                        case 4:
                            console.log(`   ✅ Console capture installed (${message.result.logs.length} initial logs)`);                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 INITIAL LOGS FOUND:');
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message.substring(0, 100)}${log.message.length > 100 ? '...' : ''}`);
                                });
                            }
                            break;
                            
                        case 4:
                        case 5:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} total console logs`);
                            console.log(`   📊 Source: ${message.result.source}`);
                            console.log(`   🌐 Tab: ${message.result.tab_title}`);
                            console.log(`   📄 URL: ${message.result.tab_url}`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 ALL CAPTURED CONSOLE LOGS:');
                                console.log('   ' + '='.repeat(80));
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    const messagePreview = log.message.length > 150 ? 
                                        log.message.substring(0, 150) + '...' : log.message;
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${messagePreview}`);
                                    if (log.args && log.args.length > 0) {
                                        const argsPreview = log.args.join(', ').substring(0, 100);
                                        console.log(`      Args: ${argsPreview}${log.args.join(', ').length > 100 ? '...' : ''}`);
                                    }
                                });
                                console.log('   ' + '='.repeat(80));
                                
                                // Analyze log types
                                const logCounts = {};
                                message.result.logs.forEach(log => {
                                    logCounts[log.level] = (logCounts[log.level] || 0) + 1;
                                });
                                
                                console.log('\n   📊 LOG BREAKDOWN:');
                                Object.entries(logCounts).forEach(([level, count]) => {
                                    console.log(`   - ${level.toUpperCase()}: ${count} messages`);
                                });
                            } else {
                                console.log('   ℹ️  No console logs captured from the page');
                                console.log('   💡 This could mean:');
                                console.log('      - The page doesn\'t generate console output');
                                console.log('      - Console capture wasn\'t installed in time');
                                console.log('      - CSP restrictions prevented capture');
                            }
                            break;
                            
                        case 5:
                        case 6:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} recent console logs`);
                            console.log(`   📊 Source: ${message.result.source || 'unknown'}`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 RECENT CONSOLE ACTIVITY:');
                                console.log('   ' + '='.repeat(80));
                                message.result.logs.slice(0, 5).forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    const messagePreview = log.message.length > 100 ? 
                                        log.message.substring(0, 100) + '...' : log.message;
                                    console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${messagePreview}`);
                                });
                                console.log('   ' + '='.repeat(80));
                            }
                            break;
                            
                        case 6:
                        case 7:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} error logs`);
                            console.log(`   🔍 Filter: ${message.result.filter_level}`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 ERROR LOGS ONLY:');
                                console.log('   ' + '='.repeat(80));
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] ERROR: ${log.message}`);
                                });
                                console.log('   ' + '='.repeat(80));
                            } else {
                                console.log('   ✅ No error logs found (that\'s good!)');
                            }
                            break;
                            
                        case 7:
                        case 8:
                            console.log(`   ✅ Retrieved ${message.result.logs.length} warning logs`);
                            console.log(`   🔍 Filter: ${message.result.filter_level}`);
                            
                            if (message.result.logs.length > 0) {
                                console.log('\n   📋 WARNING LOGS ONLY:');
                                console.log('   ' + '='.repeat(80));
                                message.result.logs.forEach((log, index) => {
                                    const time = new Date(log.timestamp).toLocaleTimeString();
                                    console.log(`   ${index + 1}. [${time}] WARN: ${log.message}`);
                                });
                                console.log('   ' + '='.repeat(80));
                            } else {
                                console.log('   ✅ No warning logs found');
                            }
                            break;
                    }
                } else if (!message.success) {
                    console.log('   ❌ Error:', message.error);
                }
            } catch (error) {
                console.log('📝 Raw response:', data.toString().substring(0, 200) + '...');
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
    testRealConsoleLogs().catch(console.error);
}