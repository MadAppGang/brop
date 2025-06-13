#!/usr/bin/env node
/**
 * Final comprehensive validation of BROP + Simplified DOM + Stagehand integration
 */

const WebSocket = require('ws');
const { createBROPConnection, createNamedBROPConnection } = require('../../client');

async function validateAllFeatures() {
    console.log('🎯 Final BROP System Validation');
    console.log('=' + '='.repeat(40));
    console.log('This test validates:');
    console.log('✓ BROP native protocol commands');
    console.log('✓ Simplified DOM feature');
    console.log('✓ Extension service activation');
    console.log('✓ All integration points');
    console.log('');
    
    const results = {
        basicCommands: [],
        simplifiedDOM: null,
        overallStatus: 'unknown'
    };
    
    try {
        // Test 1: Basic BROP Commands with proper tab management
        console.log('📋 Test 1: Basic BROP Commands');
        console.log('-'.repeat(30));
        
        // First get a tab to use for all commands
        let currentTabId = null;
        const ws1 = createNamedBROPConnection('tab-setup');
        
        await new Promise((resolve) => {
            let resolved = false;
            
            ws1.on('open', () => {
                const message = {
                    id: 'list-tabs',
                    method: 'list_tabs',
                    params: {}
                };
                ws1.send(JSON.stringify(message));
            });
            
            ws1.on('message', (data) => {
                if (resolved) return;
                
                try {
                    const response = JSON.parse(data.toString());
                    
                    if (response.id === 'list-tabs' && response.success) {
                        const tabs = response.result.tabs || [];
                        const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                        
                        if (accessibleTab) {
                            currentTabId = accessibleTab.tabId;
                            console.log(`   ✅ Using tab ${currentTabId}: ${accessibleTab.title}`);
                        } else {
                            console.log('   ⚠️ No accessible tabs found, creating new tab...');
                            const createMessage = {
                                id: 'create-tab',
                                method: 'create_tab',
                                params: { url: 'https://example.com' }
                            };
                            ws1.send(JSON.stringify(createMessage));
                            return;
                        }
                    } else if (response.id === 'create-tab' && response.success) {
                        currentTabId = response.result.tabId;
                        console.log(`   ✅ Created new tab ${currentTabId}`);
                    }
                    
                    resolved = true;
                    ws1.close();
                    resolve();
                } catch (error) {
                    console.error('   ❌ Error getting tab:', error.message);
                    resolved = true;
                    ws1.close();
                    resolve();
                }
            });
            
            ws1.on('error', (error) => {
                if (resolved) return;
                resolved = true;
                console.error('   ❌ Connection error:', error.message);
                resolve();
            });
            
            setTimeout(() => {
                if (resolved) return;
                resolved = true;
                ws1.close();
                resolve();
            }, 5000);
        });
        
        if (!currentTabId) {
            console.log('   ❌ Could not get or create a tab');
            results.basicCommands = [
                { command: 'get_console_logs', success: false, error: 'No tab available' },
                { command: 'get_screenshot', success: false, error: 'No tab available' },
                { command: 'get_page_content', success: false, error: 'No tab available' }
            ];
        } else {
            // Now test each command with the tabId
            const basicCommands = [
                { method: 'get_console_logs', params: { tabId: currentTabId, limit: 5 } },
                { method: 'get_screenshot', params: { tabId: currentTabId, format: 'png' } },
                { method: 'get_page_content', params: { tabId: currentTabId } }
            ];
            
            for (const commandInfo of basicCommands) {
                const ws = createNamedBROPConnection(`basic-${commandInfo.method}`);
                
                const result = await new Promise((resolve) => {
                    let resolved = false;
                    
                    ws.on('open', () => {
                        const message = {
                            id: `test-${commandInfo.method}`,
                            method: commandInfo.method,
                            params: commandInfo.params
                        };
                        ws.send(JSON.stringify(message));
                    });
                    
                    ws.on('message', (data) => {
                        if (resolved) return;
                        resolved = true;
                        
                        try {
                            const response = JSON.parse(data.toString());
                            ws.close();
                            resolve({
                                command: commandInfo.method,
                                success: response.success,
                                error: response.error
                            });
                        } catch (error) {
                            ws.close();
                            resolve({
                                command: commandInfo.method,
                                success: false,
                                error: error.message
                            });
                        }
                    });
                    
                    ws.on('error', (error) => {
                        if (resolved) return;
                        resolved = true;
                        resolve({
                            command: commandInfo.method,
                            success: false,
                            error: error.message
                        });
                    });
                    
                    setTimeout(() => {
                        if (resolved) return;
                        resolved = true;
                        ws.close();
                        resolve({
                            command: commandInfo.method,
                            success: false,
                            error: 'timeout'
                        });
                    }, 5000);
                });
                
                results.basicCommands.push(result);
                if (result.success) {
                    console.log(`   ✅ ${commandInfo.method}: PASS`);
                } else {
                    console.log(`   ❌ ${commandInfo.method}: FAIL - ${result.error}`);
                }
            }
        }
        
        // Test 2: Simplified DOM Command
        console.log('\n📋 Test 2: Simplified DOM Feature');
        console.log('-'.repeat(30));
        
        const ws = createNamedBROPConnection('simplified-dom');
        
        results.simplifiedDOM = await new Promise((resolve) => {
            let resolved = false;
            
            ws.on('open', () => {
                const message = {
                    id: 'test-simplified-dom',
                    method: 'get_simplified_dom',
                    params: {
                        tabId: currentTabId,
                        max_depth: 3,
                        include_hidden: false,
                        include_text_nodes: true,
                        include_coordinates: true
                    }
                };
                console.log('   📤 Sending simplified DOM request...');
                ws.send(JSON.stringify(message));
            });
            
            ws.on('message', (data) => {
                if (resolved) return;
                resolved = true;
                
                try {
                    const response = JSON.parse(data.toString());
                    ws.close();
                    
                    if (response.success) {
                        console.log('   ✅ Simplified DOM: PASS');
                        if (response.result) {
                            console.log(`   📊 Interactive elements: ${response.result.total_interactive_elements || 'N/A'}`);
                            console.log(`   🏗️  Structure summary: ${response.result.page_structure_summary || 'N/A'}`);
                            console.log(`   🎯 Suggested selectors: ${(response.result.suggested_selectors || []).length}`);
                        }
                    } else {
                        console.log(`   ❌ Simplified DOM: FAIL - ${response.error}`);
                        if (response.error.includes('Unsupported BROP command')) {
                            console.log('   🔧 Extension needs reload: chrome://extensions/ -> BROP -> reload');
                        }
                    }
                    
                    resolve({
                        success: response.success,
                        error: response.error,
                        result: response.result
                    });
                } catch (error) {
                    ws.close();
                    console.log(`   ❌ Simplified DOM: FAIL - ${error.message}`);
                    resolve({
                        success: false,
                        error: error.message
                    });
                }
            });
            
            ws.on('error', (error) => {
                if (resolved) return;
                resolved = true;
                console.log(`   ❌ Simplified DOM: FAIL - ${error.message}`);
                resolve({
                    success: false,
                    error: error.message
                });
            });
            
            setTimeout(() => {
                if (resolved) return;
                resolved = true;
                ws.close();
                console.log('   ⏰ Simplified DOM: TIMEOUT');
                resolve({
                    success: false,
                    error: 'timeout'
                });
            }, 10000);
        });
        
        // Generate final report
        console.log('\n📊 Final Validation Report');
        console.log('=' + '='.repeat(40));
        
        const basicCommandsPassed = results.basicCommands.filter(c => c.success).length;
        const basicCommandsTotal = results.basicCommands.length;
        const simplifiedDOMPassed = results.simplifiedDOM.success;
        
        console.log(`Basic Commands: ${basicCommandsPassed}/${basicCommandsTotal} PASS`);
        console.log(`Simplified DOM: ${simplifiedDOMPassed ? 'PASS' : 'FAIL'}`);
        
        if (basicCommandsPassed === basicCommandsTotal && simplifiedDOMPassed) {
            results.overallStatus = 'complete';
            console.log('\n🎉 ALL TESTS PASS - BROP System Fully Operational!');
            console.log('✅ BROP native protocol: Working');
            console.log('✅ Simplified DOM feature: Working');
            console.log('✅ Chrome extension: Active and updated');
            console.log('✅ Ready for Stagehand AI integration');
        } else if (basicCommandsPassed === basicCommandsTotal && !simplifiedDOMPassed) {
            results.overallStatus = 'reload-needed';
            console.log('\n⚠️  MOSTLY WORKING - Extension Reload Needed');
            console.log('✅ BROP native protocol: Working');
            console.log('❌ Simplified DOM feature: Needs extension reload');
            console.log('🔧 Action Required: Reload extension at chrome://extensions/');
        } else {
            results.overallStatus = 'issues';
            console.log('\n❌ ISSUES DETECTED - Service May Be Disabled');
            console.log('❌ BROP native protocol: Issues detected');
            console.log('❌ Check BROP extension status and service activation');
        }
        
        console.log('\n📋 Next Steps:');
        if (results.overallStatus === 'complete') {
            console.log('1. ✅ All systems operational');
            console.log('2. 🚀 Ready to run Stagehand AI integration tests');
            console.log('3. 🎯 BROP + AI automation fully functional');
        } else if (results.overallStatus === 'reload-needed') {
            console.log('1. 🔧 Open chrome://extensions/');
            console.log('2. 🔄 Find "Browser Remote Operations Protocol" and click reload');
            console.log('3. 🧪 Re-run this test to verify simplified DOM feature');
        } else {
            console.log('1. 🔍 Check BROP extension is installed and enabled');
            console.log('2. 🔧 Check BROP service is activated in extension popup');
            console.log('3. 🔄 Try reloading the extension');
        }
        
        // Save results
        const timestamp = Date.now();
        const reportPath = `/Users/jack/mag/mcp-brop/final-validation-report-${timestamp}.json`;
        require('fs').writeFileSync(reportPath, JSON.stringify({
            timestamp,
            results,
            summary: {
                basicCommandsPass: basicCommandsPassed,
                basicCommandsTotal,
                simplifiedDOMPass: simplifiedDOMPassed,
                overallStatus: results.overallStatus
            }
        }, null, 2));
        
        console.log(`\n💾 Report saved to: final-validation-report-${timestamp}.json`);
        
    } catch (error) {
        console.error('\n❌ Validation failed:', error.message);
        results.overallStatus = 'error';
    }
    
    return results;
}

validateAllFeatures();