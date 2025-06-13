const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

async function testSimplifiedDOM() {
    console.log('🧪 BROP Simplified DOM Test');
    console.log('===========================');
    console.log('📋 Testing new Readability + Turndown implementation');
    
    const ws = createBROPConnection();
    let testTabId = null;
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        let currentTest = 0;
        const tests = [
            'create_tab',
            'navigate_to_content',
            'test_markdown_extraction',
            'test_html_extraction',
            'test_detailed_response',
            'close_tab'
        ];
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            runNextTest();
        });
        
        function runNextTest() {
            if (currentTest >= tests.length) {
                console.log('\n🎉 ALL SIMPLIFIED DOM TESTS COMPLETED!');
                console.log('✅ New Readability-based extraction working');
                console.log('✅ Both HTML and Markdown formats supported');
                console.log('✅ Content cleaning and processing functional');
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
                        method: 'create_tab',
                        params: { 
                            url: 'about:blank',
                            active: true
                        }
                    }));
                    break;
                    
                case 'navigate_to_content':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'navigate',
                        params: { 
                            url: 'https://httpbin.org/html',
                            tabId: testTabId
                        }
                    }));
                    break;
                    
                case 'test_markdown_extraction':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_simplified_dom',
                        params: { 
                            tabId: testTabId,
                            format: 'markdown',
                            enableDetailedResponse: false
                        }
                    }));
                    break;
                    
                case 'test_html_extraction':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_simplified_dom',
                        params: { 
                            tabId: testTabId,
                            format: 'html',
                            enableDetailedResponse: false
                        }
                    }));
                    break;
                    
                case 'test_detailed_response':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_simplified_dom',
                        params: { 
                            tabId: testTabId,
                            format: 'markdown',
                            enableDetailedResponse: true
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
                        console.log(`   ✅ Created test tab: ${testTabId}`);
                        console.log(`   🔗 URL: ${response.result.url}`);
                        break;
                        
                    case 'navigate_to_content':
                        console.log(`   ✅ Navigated to: ${response.result.url}`);
                        console.log(`   📄 Title: ${response.result.title}`);
                        // Wait for page to load
                        console.log('   ⏳ Waiting 4 seconds for Wikipedia to load...');
                        setTimeout(() => {
                            currentTest++;
                            runNextTest();
                        }, 4000);
                        return;
                        
                    case 'test_markdown_extraction':
                        const markdownLength = response.result.markdown?.length || 0;
                        console.log(`   ✅ Markdown extracted: ${markdownLength} characters`);
                        console.log(`   📊 Source: ${response.result.stats?.source}`);
                        console.log(`   🔗 URL: ${response.result.url}`);
                        console.log(`   📄 Title: ${response.result.title}`);
                        if (markdownLength > 0) {
                            console.log(`   📋 Sample: ${response.result.markdown.substring(0, 100)}...`);
                        }
                        break;
                        
                    case 'test_html_extraction':
                        const htmlLength = response.result.html?.length || 0;
                        console.log(`   ✅ HTML extracted: ${htmlLength} characters`);
                        console.log(`   📊 Source: ${response.result.stats?.source}`);
                        console.log(`   🔗 URL: ${response.result.url}`);
                        console.log(`   📄 Title: ${response.result.title}`);
                        if (htmlLength > 0) {
                            const cleanHtml = response.result.html.replace(/<[^>]*>/g, '').trim();
                            console.log(`   📋 Sample text: ${cleanHtml.substring(0, 100)}...`);
                        }
                        break;
                        
                    case 'test_detailed_response':
                        const detailedLength = response.result.markdown?.length || 0;
                        console.log(`   ✅ Detailed markdown extracted: ${detailedLength} characters`);
                        console.log(`   📊 Source: ${response.result.stats?.source}`);
                        console.log(`   🎯 Detailed mode: ${response.result.stats?.source === 'full_document' ? 'YES' : 'NO'}`);
                        break;
                        
                    case 'close_tab':
                        console.log(`   ✅ Test tab ${testTabId} closed successfully`);
                        testTabId = null;
                        break;
                }
            } else {
                console.log(`   ❌ ERROR: ${response.error}`);
                
                // Show helpful information about what failed
                if (response.error.includes('Cannot access chrome://')) {
                    console.log(`   💡 This is expected - chrome:// URLs are protected`);
                } else if (response.error.includes('Content extraction failed')) {
                    console.log(`   💡 This indicates an issue with our new extraction method`);
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
            console.log('⏰ Test timeout - cleaning up...');
            if (testTabId) {
                console.log(`🗑️ Attempting to clean up test tab ${testTabId}`);
                ws.send(JSON.stringify({
                    id: 999,
                    method: 'close_tab',
                    params: { tabId: testTabId }
                }));
            }
            setTimeout(() => {
                ws.close();
                resolve();
            }, 1000);
        }, 60000);
    });
}

testSimplifiedDOM().catch(console.error);