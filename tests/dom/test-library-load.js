const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

async function testLibraryLoad() {
    console.log('🧪 Library Loading Test');
    console.log('======================');
    
    const ws = createBROPConnection();
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Create a simple test tab first
            console.log('📝 Creating test tab...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'create_tab',
                params: { url: 'https://httpbin.org/html' }
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            
            console.log(`📥 Response ${response.id}: ${response.success ? '✅ SUCCESS' : '❌ FAILED'}`);
            
            if (response.success) {
                if (response.id === 1) {
                    // Tab created
                    const tabId = response.result.tabId;
                    console.log(`   ✅ Created tab ${tabId}`);
                    console.log(`   ⏳ Waiting 3 seconds for page to load...`);
                    
                    setTimeout(() => {
                        console.log('\n🔧 Testing dom-to-semantic-markdown library load...');
                        ws.send(JSON.stringify({
                            id: ++messageId,
                            method: 'get_simplified_dom',
                            params: { 
                                tabId: tabId,
                                format: 'markdown'
                            }
                        }));
                    }, 3000);
                    
                } else if (response.id === 2) {
                    // DOM extraction response
                    console.log(`   ✅ Markdown extraction successful!`);
                    console.log(`   📊 Source: ${response.result.stats?.source}`);
                    console.log(`   📄 Title: ${response.result.title}`);
                    console.log(`   📏 Length: ${response.result.markdown?.length} characters`);
                    
                    if (response.result.markdown) {
                        console.log(`   📋 Sample: ${response.result.markdown.substring(0, 100)}...`);
                    }
                    
                    ws.close();
                    resolve();
                }
            } else {
                console.log(`   ❌ ERROR: ${response.error}`);
                ws.close();
                resolve();
            }
        });
        
        ws.on('close', function close() {
            console.log('\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
            ws.close();
            resolve();
        }, 15000);
    });
}

testLibraryLoad().catch(console.error);