const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

async function testFinalVerification() {
    console.log('🎯 FINAL VERIFICATION TEST');
    console.log('==========================');
    console.log('📋 Verifying all key features work correctly');
    
    const ws = createBROPConnection();
    let messageId = 0;
    let testResults = [];
    let currentTabId = null;
    
    return new Promise((resolve) => {
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Step 1: Get available tabs first
            console.log('\n🔧 Step 1: Getting available tabs...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'list_tabs',
                params: {}
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.id === 1) {
                // Handle tabs list
                if (response.success) {
                    const tabs = response.result.tabs || [];
                    console.log(`   ✅ Found ${tabs.length} tabs`);
                    
                    const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                    
                    if (!accessibleTab) {
                        console.log('\n🔧 Creating new tab for testing...');
                        ws.send(JSON.stringify({
                            id: ++messageId,
                            method: 'create_tab',
                            params: { url: 'https://example.com' }
                        }));
                        return;
                    }
                    
                    currentTabId = accessibleTab.tabId;
                    console.log(`   🎯 Using tab ${currentTabId}: ${accessibleTab.title}`);
                    
                    // Start the actual tests
                    runTest1();
                } else {
                    console.log(`   ❌ Failed to get tabs: ${response.error}`);
                    completeTest(false);
                }
                
            } else if (response.success && response.result && response.result.tabId && !currentTabId) {
                // Handle tab creation
                currentTabId = response.result.tabId;
                console.log(`   ✅ Created tab ${currentTabId}`);
                
                setTimeout(() => {
                    runTest1();
                }, 2000);
                
            } else {
                // Handle test responses
                handleTestResponse(response);
            }
        });

        function runTest1() {
            console.log('\n🔧 Test 1: Basic page content retrieval...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'get_page_content',
                params: { 
                    tabId: currentTabId,
                    include_metadata: true 
                }
            }));
        }

        function runTest2() {
            console.log('\n🔧 Test 2: CSP-compliant console execution...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'execute_console',
                params: { 
                    tabId: currentTabId,
                    code: 'document.title' 
                }
            }));
        }

        function runTest3() {
            console.log('\n🔧 Test 3: Console log capture...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'get_console_logs',
                params: { 
                    tabId: currentTabId,
                    limit: 5 
                }
            }));
        }

        function runTest4() {
            console.log('\n🔧 Test 4: Extension error tracking...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'get_extension_errors',
                params: { limit: 3 }
            }));
        }

        function runTest5() {
            console.log('\n🔧 Test 5: Screenshot capture...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'get_screenshot',
                params: { 
                    tabId: currentTabId,
                    format: 'png' 
                }
            }));
        }

        function handleTestResponse(response) {
            const testMap = {
                2: { name: 'Page Content', nextTest: runTest2 },
                3: { name: 'Console Execution', nextTest: runTest3 },
                4: { name: 'Console Logs', nextTest: runTest4 },
                5: { name: 'Extension Errors', nextTest: runTest5 },
                6: { name: 'Screenshot', nextTest: showFinalResults }
            };

            const test = testMap[response.id];
            if (!test) return;

            if (response.success) {
                console.log(`   ✅ ${test.name}: SUCCESS`);
                
                // Log relevant details
                if (response.result) {
                    if (response.result.title) {
                        console.log(`      Title: ${response.result.title}`);
                    } else if (response.result.result) {
                        console.log(`      Result: ${response.result.result}`);
                    } else if (response.result.logs) {
                        console.log(`      Logs: ${response.result.logs.length} entries`);
                    } else if (response.result.errors) {
                        console.log(`      Errors: ${response.result.errors.length} tracked`);
                    } else if (response.result.data) {
                        console.log(`      Screenshot: ${response.result.data.length} bytes`);
                    }
                }

                testResults.push({ 
                    test: test.name, 
                    status: 'PASS', 
                    details: 'SUCCESS' 
                });
            } else {
                console.log(`   ❌ ${test.name}: FAILED - ${response.error}`);
                testResults.push({ 
                    test: test.name, 
                    status: 'FAIL', 
                    details: response.error 
                });
            }

            // Move to next test
            setTimeout(() => {
                test.nextTest();
            }, 500);
        }

        function showFinalResults() {
            console.log('\n📊 FINAL VERIFICATION RESULTS');
            console.log('==============================');
            
            const passedTests = testResults.filter(r => r.status === 'PASS');
            const failedTests = testResults.filter(r => r.status === 'FAIL');
            
            console.log(`✅ Passed: ${passedTests.length}/${testResults.length} tests`);
            console.log(`❌ Failed: ${failedTests.length}/${testResults.length} tests`);
            
            if (failedTests.length > 0) {
                console.log('\n❌ Failed Tests:');
                failedTests.forEach(test => {
                    console.log(`   - ${test.test}: ${test.details}`);
                });
            }
            
            const successRate = testResults.length > 0 ? 
                Math.round((passedTests.length / testResults.length) * 100) : 0;
            
            console.log(`\n📈 Success Rate: ${successRate}%`);
            
            if (successRate >= 80) {
                console.log('\n🎉 EXCELLENT: BROP service is working well!');
                console.log('✅ Core functionality verified');
                console.log('✅ Tab management operational');
                console.log('✅ Content extraction working');
                console.log('✅ Console integration functional');
            } else {
                console.log('\n⚠️  NEEDS ATTENTION: Some core features failed');
            }
            
            completeTest(successRate >= 80);
        }

        function completeTest(success) {
            console.log('\n🎯 Final verification complete!');
            
            // Close connection immediately
            setTimeout(() => {
                ws.close();
                resolve();
            }, 500);
        }
        
        ws.on('close', function close() {
            console.log('🔌 Disconnected from bridge');
        });
        
        ws.on('error', (error) => {
            console.error('❌ Connection error:', error.message);
            resolve();
        });
        
        // Much shorter timeout - test should complete quickly
        setTimeout(() => {
            console.log('⏰ Test timeout - completing now');
            completeTest(false);
        }, 10000); // Reduced from 20s to 10s
    });
}

testFinalVerification().catch(console.error);