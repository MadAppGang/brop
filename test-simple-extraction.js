const WebSocket = require('ws');

async function testSimpleExtraction() {
    console.log('🧪 Simple DOM Extraction Debug Test');
    console.log('===================================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Test with the Wikipedia tab we know exists
            console.log('🔧 Testing DOM extraction on JavaScript Wikipedia page...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'get_simplified_dom',
                params: { 
                    tabId: 654754018, // JavaScript Wikipedia tab we saw earlier
                    format: 'markdown',
                    enableDetailedResponse: false
                }
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            
            console.log(`📥 Response ${response.id}: ${response.success ? '✅ SUCCESS' : '❌ FAILED'}`);
            console.log(`📊 Full response:`, JSON.stringify(response, null, 2));
            
            ws.close();
            resolve();
        });
        
        ws.on('close', function close() {
            console.log('🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
            ws.close();
            resolve();
        }, 10000);
    });
}

testSimpleExtraction().catch(console.error);