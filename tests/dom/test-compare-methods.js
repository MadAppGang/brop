const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

async function testCompareMethods() {
    console.log('🧪 BROP Method Comparison Test');
    console.log('===============================');
    console.log('📋 Comparing get_page_content (working) vs get_simplified_dom (broken)');
    
    const ws = createBROPConnection();
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        let currentTest = 0;
        let currentTabId = null;
        const tests = ['get_tabs', 'page_content', 'simplified_dom'];
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            runNextTest();
        });
        
        function runNextTest() {
            if (currentTest >= tests.length) {
                ws.close();
                resolve();
                return;
            }
            
            const test = tests[currentTest];
            console.log(`\\n🔧 Test ${currentTest + 1}/${tests.length}: ${test.toUpperCase()}`);
            
            if (test === 'get_tabs') {
                console.log('📋 Step 1: Getting available tabs...');
                ws.send(JSON.stringify({
                    id: ++messageId,
                    method: 'list_tabs',
                    params: {}
                }));
            } else if (test === 'page_content') {
                console.log('📋 Testing get_page_content method...');
                ws.send(JSON.stringify({
                    id: ++messageId,
                    method: 'get_page_content',
                    params: { 
                        tabId: currentTabId
                    }
                }));
            } else if (test === 'simplified_dom') {
                console.log('📋 Testing get_simplified_dom method...');
                ws.send(JSON.stringify({
                    id: ++messageId,
                    method: 'get_simplified_dom',
                    params: { 
                        tabId: currentTabId,
                        format: 'markdown'
                    }
                }));
            }
        }
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            const test = tests[currentTest];
            
            console.log(`📥 Response ${response.id}: ${response.success ? '✅ SUCCESS' : '❌ FAILED'}`);
            
            if (response.success) {
                if (test === 'get_tabs') {
                    const tabs = response.result.tabs || [];
                    console.log(`   ✅ Found ${tabs.length} tabs`);
                    
                    const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                    
                    if (!accessibleTab) {
                        console.log('\n🔧 Creating new tab for testing...');
                        ws.send(JSON.stringify({
                            id: ++messageId,
                            method: 'create_tab',
                            params: { url: 'https://en.wikipedia.org/wiki/JavaScript' }
                        }));
                        return;
                    }
                    
                    currentTabId = accessibleTab.tabId;
                    console.log(`   🎯 Using tab ${currentTabId}: ${accessibleTab.title}`);
                    
                } else if (response.result && response.result.tabId) {
                    // Handle tab creation response
                    currentTabId = response.result.tabId;
                    console.log(`   ✅ Created new tab ${currentTabId}`);
                    
                    // Wait for page to load
                    setTimeout(() => {
                        currentTest++;
                        runNextTest();
                    }, 3000);
                    return;
                    
                } else if (test === 'page_content') {
                    console.log(`   ✅ get_page_content works: ${response.result.text?.length || 0} chars`);
                    console.log(`   📄 Title: ${response.result.title}`);
                    console.log(`   🔗 URL: ${response.result.url}`);
                } else if (test === 'simplified_dom') {
                    console.log(`   ✅ get_simplified_dom works: ${response.result.markdown?.length || 0} chars`);
                    console.log(`   📄 Title: ${response.result.title}`);
                    console.log(`   🔗 URL: ${response.result.url}`);
                }
            } else {
                console.log(`   ❌ ${test} failed: ${response.error}`);
            }
            
            currentTest++;
            setTimeout(runNextTest, 1000);
        });
        
        ws.on('close', function close() {
            console.log('\\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
            ws.close();
            resolve();
        }, 15000);
    });
}

testCompareMethods().catch(console.error);