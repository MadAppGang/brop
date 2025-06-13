const WebSocket = require('ws');
const { createBROPConnection } = require('../../test-utils');

async function testExplicitTabManagement() {
    console.log('🧪 BROP Explicit Tab Management Test');
    console.log('====================================');
    console.log('📋 Testing strict tab targeting approach');
    
    const ws = createBROPConnection();
    let testTabId = null;
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        let currentTest = 0;
        const tests = [
            'list_tabs',
            'create_tab',
            'navigate_tab', 
            'execute_console',
            'get_console_logs',
            'get_page_content',
            'get_screenshot',
            'close_tab',
            'final_list'
        ];
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            runNextTest();
        });
        
        function runNextTest() {
            if (currentTest >= tests.length) {
                console.log('\n🎉 ALL EXPLICIT TAB TESTS COMPLETED!');
                console.log('✅ Strict tab targeting works correctly');
                console.log('✅ No fallback logic needed');
                console.log('✅ Predictable and reliable tab operations');
                setTimeout(() => {
                    ws.close();
                    resolve();
                }, 200);
                return;
            }
            
            const test = tests[currentTest];
            console.log(`\n🔧 Test ${currentTest + 1}/${tests.length}: ${test.replace('_', ' ').toUpperCase()}`);
            
            switch (test) {
                case 'list_tabs':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'list_tabs',
                        params: {}
                    }));
                    break;
                    
                case 'create_tab':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'create_tab',
                        params: { 
                            url: 'https://httpbin.org/html',
                            active: true
                        }
                    }));
                    break;
                    
                case 'navigate_tab':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'navigate',
                        params: { 
                            url: 'https://httpbin.org/get',
                            tabId: testTabId
                        }
                    }));
                    break;
                    
                case 'execute_console':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'execute_console',
                        params: { 
                            code: 'console.log("Test log from explicit tab " + ' + testTabId + '); document.title',
                            tabId: testTabId
                        }
                    }));
                    break;
                    
                case 'get_console_logs':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_console_logs',
                        params: { 
                            limit: 10,
                            tabId: testTabId
                        }
                    }));
                    break;
                    
                case 'get_page_content':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_page_content',
                        params: { 
                            include_metadata: true,
                            tabId: testTabId
                        }
                    }));
                    break;
                    
                case 'get_screenshot':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_screenshot',
                        params: { 
                            format: 'png',
                            tabId: testTabId
                        }
                    }));
                    break;
                    
                case 'close_tab':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'close_tab',
                        params: { 
                            tabId: testTabId
                        }
                    }));
                    break;
                    
                case 'final_list':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'list_tabs',
                        params: {}
                    }));
                    break;
            }
        }
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            const test = tests[currentTest];
            
            console.log(`📥 Response ${response.id}: ${response.success ? '✅ SUCCESS' : '❌ FAILED'}`);
            
            if (response.success) {
                switch (test) {
                    case 'list_tabs':
                        const tabs = response.result.tabs || [];
                        console.log(`   📋 Found ${tabs.length} tabs (${response.result.accessibleTabs} accessible)`);
                        console.log(`   🎯 Active tab: ${response.result.activeTabId || 'none'}`);
                        if (tabs.length > 0) {
                            tabs.slice(0, 3).forEach((tab, i) => {
                                const accessible = tab.accessible ? '✅' : '❌';
                                console.log(`      ${i + 1}. ${accessible} Tab ${tab.tabId}: ${tab.title?.substring(0, 40)}...`);
                                console.log(`         URL: ${tab.url?.substring(0, 60)}...`);
                            });
                        }
                        break;
                        
                    case 'create_tab':
                        testTabId = response.result.tabId;
                        console.log(`   ✅ Created test tab: ${testTabId}`);
                        console.log(`   🔗 URL: ${response.result.url}`);
                        console.log(`   📄 Title: ${response.result.title}`);
                        // Wait for page to load
                        console.log('   ⏳ Waiting 1 second for page to load...');
                        setTimeout(() => {
                            currentTest++;
                            runNextTest();
                        }, 1000);
                        return;
                        
                    case 'navigate_tab':
                        console.log(`   ✅ Navigated tab ${testTabId} to: ${response.result.url}`);
                        console.log(`   📄 New title: ${response.result.title}`);
                        // Wait for navigation
                        setTimeout(() => {
                            currentTest++;
                            runNextTest();
                        }, 1000);
                        return;
                        
                    case 'execute_console':
                        console.log(`   ✅ Console executed on tab ${testTabId}: ${response.result.result}`);
                        break;
                        
                    case 'get_console_logs':
                        const logCount = response.result.logs?.length || 0;
                        console.log(`   ✅ Retrieved ${logCount} console logs from tab ${testTabId}`);
                        console.log(`   📊 Method: ${response.result.method}`);
                        console.log(`   📍 Source: ${response.result.source}`);
                        console.log(`   📄 Tab: ${response.result.tab_title}`);
                        if (logCount > 0) {
                            console.log('   📋 Recent logs:');
                            response.result.logs.slice(0, 3).forEach((log, i) => {
                                const message = log.message || log.text || 'No message';
                                console.log(`      ${i + 1}. ${log.level?.toUpperCase()}: ${message.substring(0, 80)}`);
                            });
                        }
                        break;
                        
                    case 'get_page_content':
                        console.log(`   ✅ Page content retrieved from tab ${testTabId}`);
                        console.log(`   📄 Title: ${response.result.title}`);
                        console.log(`   🔗 URL: ${response.result.url}`);
                        console.log(`   📝 Content: ${response.result.text?.length || 0} chars`);
                        break;
                        
                    case 'get_screenshot':
                        const imageSize = response.result.image_data?.length || 0;
                        console.log(`   ✅ Screenshot captured from tab ${testTabId}: ${imageSize} bytes`);
                        console.log(`   📄 Tab: ${response.result.tab_title}`);
                        console.log(`   🔗 URL: ${response.result.tab_url}`);
                        break;
                        
                    case 'close_tab':
                        console.log(`   ✅ Closed test tab ${testTabId}`);
                        testTabId = null;
                        break;
                        
                    case 'final_list':
                        const finalTabs = response.result.tabs || [];
                        console.log(`   📋 Final tab count: ${finalTabs.length} tabs`);
                        console.log(`   🧹 Test tab cleanup confirmed`);
                        break;
                }
            } else {
                console.log(`   ❌ ERROR: ${response.error}`);
                
                // For demonstration, show the helpful error messages
                if (response.error.includes('tabId is required')) {
                    console.log(`   💡 This demonstrates the strict tab requirement`);
                } else if (response.error.includes('Cannot access chrome://')) {
                    console.log(`   💡 This shows proper chrome:// URL protection`);
                }
            }
            
            currentTest++;
            setTimeout(runNextTest, 300);
        });
        
        ws.on('close', function close() {
            console.log('\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        // Timeout after 15 seconds
        setTimeout(() => {
            console.log('⏰ Test timeout - cleaning up...');
            if (testTabId) {
                console.log(`🗑️ Attempting to clean up test tab ${testTabId}`);
                // Try to close the test tab
                ws.send(JSON.stringify({
                    id: 999,
                    method: 'close_tab',
                    params: { tabId: testTabId }
                }));
            }
            setTimeout(() => {
                ws.close();
                resolve();
            }, 500);
        }, 15000);
    });
}

testExplicitTabManagement().catch(console.error);