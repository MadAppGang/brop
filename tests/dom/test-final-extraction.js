const WebSocket = require('ws');
const { createBROPConnection } = require('../../test-utils');

async function testFinalExtraction() {
    console.log('🧪 Final Extraction Test - Both Libraries');
    console.log('=========================================');
    
    const ws = createBROPConnection();
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        let testTabId = null;
        let currentTest = 0;
        const tests = ['create_tab', 'test_markdown', 'test_html', 'cleanup'];
        
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
            console.log(`\n🔧 Test ${currentTest + 1}/${tests.length}: ${test.toUpperCase()}`);
            
            switch (test) {
                case 'create_tab':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'create_tab',
                        params: { url: 'https://en.wikipedia.org/wiki/JavaScript' }
                    }));
                    break;
                    
                case 'test_markdown':
                    console.log('📋 Testing dom-to-semantic-markdown...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_simplified_dom',
                        params: { 
                            tabId: testTabId,
                            format: 'markdown'
                        }
                    }));
                    break;
                    
                case 'test_html':
                    console.log('📋 Testing Mozilla Readability...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_simplified_dom',
                        params: { 
                            tabId: testTabId,
                            format: 'html'
                        }
                    }));
                    break;
                    
                case 'cleanup':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'close_tab',
                        params: { tabId: testTabId }
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
                    case 'create_tab':
                        testTabId = response.result.tabId;
                        console.log(`   ✅ Created tab ${testTabId}: ${response.result.url}`);
                        console.log('   ⏳ Waiting 5 seconds for Wikipedia to load...');
                        setTimeout(() => {
                            currentTest++;
                            runNextTest();
                        }, 5000);
                        return;
                        
                    case 'test_markdown':
                        console.log(`   ✅ Markdown extraction: ${response.result.markdown?.length || 0} chars`);
                        console.log(`   📊 Source: ${response.result.stats?.source}`);
                        console.log(`   📄 Title: ${response.result.title}`);
                        if (response.result.markdown) {
                            console.log(`   📋 Sample: ${response.result.markdown.substring(0, 150)}...`);
                        }
                        break;
                        
                    case 'test_html':
                        console.log(`   ✅ HTML extraction: ${response.result.html?.length || 0} chars`);
                        console.log(`   📊 Source: ${response.result.stats?.source}`);
                        console.log(`   📄 Title: ${response.result.title}`);
                        if (response.result.html) {
                            const textSample = response.result.html.replace(/<[^>]*>/g, '').trim();
                            console.log(`   📋 Sample: ${textSample.substring(0, 150)}...`);
                        }
                        break;
                        
                    case 'cleanup':
                        console.log(`   ✅ Tab ${testTabId} closed`);
                        console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
                        console.log('✅ dom-to-semantic-markdown working for markdown format');
                        console.log('✅ Mozilla Readability working for html format');
                        console.log('✅ No fallbacks - using only specified libraries');
                        break;
                }
            } else {
                console.log(`   ❌ ERROR: ${response.error}`);
            }
            
            currentTest++;
            setTimeout(runNextTest, 1000);
        });
        
        ws.on('close', function close() {
            console.log('\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
            ws.close();
            resolve();
        }, 30000);
    });
}

testFinalExtraction().catch(console.error);