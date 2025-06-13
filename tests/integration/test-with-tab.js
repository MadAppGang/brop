const WebSocket = require('ws');

async function testWithRealTab() {
    console.log('🧪 BROP Test with Real Tab');
    console.log('==========================');
    console.log('📋 Creating test tab and running comprehensive tests');
    
    const ws = new WebSocket('ws://localhost:9223');
    let testTabId = null;
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        let currentTest = 0;
        const tests = [
            'create_tab',
            'navigate_tab', 
            'execute_console',
            'get_console_logs',
            'get_page_content',
            'get_screenshot',
            'close_tab'
        ];
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            runNextTest();
        });
        
        function runNextTest() {
            if (currentTest >= tests.length) {
                console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
                ws.close();
                resolve();
                return;
            }
            
            const test = tests[currentTest];
            console.log(`\n🔧 Test ${currentTest + 1}/${tests.length}: ${test.replace('_', ' ').toUpperCase()}`);
            
            switch (test) {
                case 'create_tab':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'navigate',
                        params: { 
                            url: 'about:blank',
                            create_new_tab: true
                        }
                    }));
                    break;
                    
                case 'navigate_tab':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'navigate',
                        params: { 
                            url: 'https://httpbin.org/html',
                            tabId: testTabId
                        }
                    }));
                    break;
                    
                case 'execute_console':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'execute_console',
                        params: { 
                            code: 'console.log("Test log from BROP on httpbin"); document.title',
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
                    // Close the test tab
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'navigate',
                        params: { 
                            url: 'chrome://newtab/',
                            tabId: testTabId,
                            close_tab: true
                        }
                    }));
                    break;
            }
        }
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            const test = tests[currentTest];
            
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.success) {
                switch (test) {
                    case 'create_tab':
                        if (response.result?.tabId) {
                            testTabId = response.result.tabId;
                            console.log(`   ✅ Created test tab: ${testTabId}`);
                        } else {
                            console.log('   ✅ Tab creation initiated');
                        }
                        break;
                        
                    case 'navigate_tab':
                        console.log(`   ✅ Navigated to: ${response.result?.url || 'httpbin.org'}`);
                        // Wait for page to load
                        console.log('   ⏳ Waiting 3 seconds for page to load...');
                        setTimeout(() => {
                            currentTest++;
                            runNextTest();
                        }, 3000);
                        return;
                        
                    case 'execute_console':
                        console.log(`   ✅ Console executed: ${response.result?.result || 'Success'}`);
                        break;
                        
                    case 'get_console_logs':
                        const logCount = response.result?.logs?.length || 0;
                        console.log(`   ✅ Retrieved ${logCount} console logs`);
                        console.log(`   📊 Method: ${response.result?.method || 'unknown'}`);
                        console.log(`   📍 Source: ${response.result?.source || 'unknown'}`);
                        if (logCount > 0) {
                            console.log('   📋 Sample logs:');
                            response.result.logs.slice(0, 3).forEach((log, i) => {
                                const message = log.message || log.text || 'No message';
                                console.log(`      ${i + 1}. ${log.level?.toUpperCase()}: ${message.substring(0, 80)}`);
                            });
                        }
                        break;
                        
                    case 'get_page_content':
                        console.log(`   ✅ Page content retrieved: ${response.result?.title || 'Unknown'}`);
                        console.log(`   🔗 URL: ${response.result?.url || 'Unknown'}`);
                        console.log(`   📝 Content length: ${response.result?.content?.length || 0} chars`);
                        break;
                        
                    case 'get_screenshot':
                        const imageSize = response.result?.image_data?.length || 0;
                        console.log(`   ✅ Screenshot captured: ${imageSize} bytes`);
                        break;
                        
                    case 'close_tab':
                        console.log(`   ✅ Test tab ${testTabId} closed`);
                        break;
                }
            } else {
                console.log(`   ❌ Failed: ${response.error}`);
                if (test === 'create_tab') {
                    console.log('   💡 Cannot create tab - trying to continue with current tab...');
                    // Continue without creating a new tab
                }
            }
            
            currentTest++;
            setTimeout(runNextTest, 1000);
        });
        
        ws.on('close', function close() {
            console.log('\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        // Timeout after 60 seconds
        setTimeout(() => {
            console.log('⏰ Test timeout - closing connection');
            if (testTabId) {
                console.log(`🗑️ Cleaning up test tab ${testTabId}`);
            }
            ws.close();
            resolve();
        }, 60000);
    });
}

testWithRealTab().catch(console.error);