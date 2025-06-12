const WebSocket = require('ws');

async function testCompareMethods() {
    console.log('🧪 BROP Method Comparison Test');
    console.log('===============================');
    console.log('📋 Comparing get_page_content (working) vs get_simplified_dom (broken)');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        let currentTest = 0;
        const tests = ['page_content', 'simplified_dom'];
        
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
            
            if (test === 'page_content') {
                console.log('📋 Testing working get_page_content method...');
                ws.send(JSON.stringify({
                    id: ++messageId,
                    method: 'get_page_content',
                    params: { 
                        tabId: 654754018 // Wikipedia tab
                    }
                }));
            } else {
                console.log('📋 Testing broken get_simplified_dom method...');
                ws.send(JSON.stringify({
                    id: ++messageId,
                    method: 'get_simplified_dom',
                    params: { 
                        tabId: 654754018, // Wikipedia tab
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
                if (test === 'page_content') {
                    console.log(`   ✅ get_page_content works: ${response.result.text?.length || 0} chars`);
                    console.log(`   📄 Title: ${response.result.title}`);
                    console.log(`   🔗 URL: ${response.result.url}`);
                } else {
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