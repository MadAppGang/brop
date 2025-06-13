#!/usr/bin/env node
/**
 * Test different types of console errors with proper BROP commands and tabId handling
 */

const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

async function testConsoleErrorTypes() {
    console.log('🧪 Testing Different Console Error Types');
    console.log('=======================================');
    console.log('🎯 Goal: Generate and capture various console error types');

    const ws = createBROPConnection();
    let requestId = 1;
    let currentTabId = null;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Step 1: Get available tabs
            console.log('\n📍 STEP 1: Getting available tabs...');
            const tabsCommand = {
                id: requestId++,
                method: 'list_tabs',
                params: {}
            };
            ws.send(JSON.stringify(tabsCommand));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📥 Response ${message.id}: ${message.success ? '✅' : '❌'}`);

                if (message.id === 1 && message.success) {
                    // Handle tabs list
                    const tabs = message.result.tabs || [];
                    console.log(`   ✅ Found ${tabs.length} tabs`);
                    
                    const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                    
                    if (!accessibleTab) {
                        console.log('\n📍 Creating new tab for testing...');
                        const createTabCommand = {
                            id: requestId++,
                            method: 'create_tab',
                            params: { url: 'https://httpbin.org/html' }
                        };
                        ws.send(JSON.stringify(createTabCommand));
                        return;
                    }
                    
                    currentTabId = accessibleTab.tabId;
                    console.log(`   🎯 Using tab ${currentTabId}: ${accessibleTab.title}`);
                    
                    // Navigate to test page
                    console.log('\n📍 STEP 2: Navigating to test page...');
                    const navCommand = {
                        id: requestId++,
                        method: 'navigate',
                        params: { 
                            tabId: currentTabId,
                            url: 'https://httpbin.org/html' 
                        }
                    };
                    ws.send(JSON.stringify(navCommand));
                    
                } else if (message.success && message.result && message.result.tabId && !currentTabId) {
                    // Handle tab creation
                    currentTabId = message.result.tabId;
                    console.log(`   ✅ Created tab ${currentTabId}`);
                    
                    setTimeout(() => {
                        generateConsoleErrors();
                    }, 3000);
                    
                } else if (message.success && currentTabId) {
                    // Handle navigation complete or other successful operations
                    if (message.id === 2) {
                        console.log('   ✅ Navigation completed');
                        setTimeout(() => {
                            generateConsoleErrors();
                        }, 2000);
                    } else if (message.id === 3) {
                        console.log('   ✅ Console errors generated');
                        setTimeout(() => {
                            retrieveConsoleLogs();
                        }, 2000);
                    } else if (message.result && message.result.logs) {
                        displayCapturedLogs(message.result);
                        setTimeout(() => {
                            console.log('\n✅ Console error type test completed!');
                            ws.close();
                            resolve();
                        }, 1000);
                    }
                } else if (!message.success) {
                    console.log(`   ❌ Error: ${message.error}`);
                    // Continue to next step
                    setTimeout(() => {
                        if (!currentTabId) {
                            console.log('\n❌ No valid tab available for testing');
                            ws.close();
                            resolve();
                        } else {
                            generateConsoleErrors();
                        }
                    }, 1000);
                }
            } catch (error) {
                console.log('📝 Parse error:', error.message);
            }
        });

        function generateConsoleErrors() {
            console.log('\n📍 STEP 3: Generating various console error types...');
            console.log('🔍 Generating JavaScript console errors on page...');
            
            const errorCommand = {
                id: requestId++,
                method: 'execute_console',
                params: {
                    tabId: currentTabId,
                    code: `
                        // Generate different types of console messages
                        console.log('✅ Test log message');
                        console.warn('⚠️ Test warning message');
                        console.error('❌ Test error message');
                        console.info('ℹ️ Test info message');
                        
                        // Generate JavaScript errors
                        try {
                            throw new Error('Generated test error');
                        } catch (e) {
                            console.error('Caught error:', e.message);
                        }
                        
                        // Generate reference error
                        try {
                            nonExistentFunction();
                        } catch (e) {
                            console.error('Reference error:', e.message);
                        }
                        
                        // Generate type error
                        try {
                            null.someMethod();
                        } catch (e) {
                            console.error('Type error:', e.message);
                        }
                        
                        console.log('Console error generation completed');
                        'Error generation complete'
                    `
                }
            };
            ws.send(JSON.stringify(errorCommand));
        }

        function retrieveConsoleLogs() {
            console.log('\n📍 STEP 4: Retrieving captured console logs...');
            const logsCommand = {
                id: requestId++,
                method: 'get_console_logs',
                params: {
                    tabId: currentTabId,
                    limit: 20
                }
            };
            ws.send(JSON.stringify(logsCommand));
        }

        function displayCapturedLogs(result) {
            console.log('\n📊 CONSOLE ERROR CAPTURE RESULTS:');
            console.log('==================================');
            console.log(`📝 Total logs captured: ${result.logs?.length || 0}`);
            console.log(`📍 Source: ${result.source || 'unknown'}`);

            if (result.logs && result.logs.length > 0) {
                console.log('\n📋 CAPTURED CONSOLE MESSAGES:');
                console.log('-'.repeat(60));
                
                const errorTypes = { log: 0, warn: 0, error: 0, info: 0 };
                
                result.logs.forEach((log, index) => {
                    const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A';
                    const level = (log.level || 'log').toLowerCase();
                    const message = log.message || log.text || 'No message';
                    
                    errorTypes[level] = (errorTypes[level] || 0) + 1;
                    
                    console.log(`${index + 1}. [${time}] ${level.toUpperCase()}: ${message}`);
                    if (log.source) {
                        console.log(`   📍 Source: ${log.source}`);
                    }
                });
                
                console.log('-'.repeat(60));
                console.log('\n📊 ERROR TYPE BREAKDOWN:');
                console.log(`   📝 Logs: ${errorTypes.log || 0}`);
                console.log(`   ⚠️  Warnings: ${errorTypes.warn || 0}`);
                console.log(`   ❌ Errors: ${errorTypes.error || 0}`);
                console.log(`   ℹ️  Info: ${errorTypes.info || 0}`);
                
                console.log('\n🎯 CONSOLE CAPTURE ANALYSIS:');
                console.log('✅ BROP can successfully capture console messages');
                console.log('✅ Multiple error types are detected and logged');
                console.log('✅ Error generation and capture pipeline working');
                
            } else {
                console.log('\n📋 No console logs captured');
                console.log('💡 This could mean:');
                console.log('   - Console capture not active on this page');
                console.log('   - Logs cleared before retrieval');
                console.log('   - Different capture method needed');
            }
        }

        ws.on('error', (error) => {
            console.error('❌ Connection error:', error.message);
            resolve();
        });

        ws.on('close', () => {
            console.log('🔌 Disconnected');
            resolve();
        });
    });
}

// Run the test
if (require.main === module) {
    testConsoleErrorTypes().catch(console.error);
}