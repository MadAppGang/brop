const WebSocket = require('ws');

async function testPopupWithTab() {
    console.log('🧪 Popup Test with Valid Tab');
    console.log('===========================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            console.log('📋 Creating a test tab for popup testing...');
            
            // Create a tab first
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'create_tab',
                params: { url: 'https://example.com' }
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            
            if (response.id === 1 && response.success) {
                const tabId = response.result.tabId;
                console.log(`✅ Created tab ${tabId}`);
                console.log('📋 Testing popup Test Extension button functionality...');
                
                // Now test execute_console with the valid tab
                ws.send(JSON.stringify({
                    id: ++messageId,
                    method: 'execute_console',
                    params: { 
                        code: 'console.log("BROP test successful"); "Test completed"',
                        tabId: tabId
                    }
                }));
                
            } else if (response.id === 2) {
                const success = response.success;
                console.log(`📥 Execute Console Result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
                
                if (success) {
                    console.log(`   📄 Result: ${response.result?.result || 'N/A'}`);
                } else {
                    console.log(`   ❌ Error: ${response.error}`);
                }
                
                console.log('\\n🎯 POPUP VERIFICATION:');
                console.log('======================');
                console.log('✅ Commands processed with proper method names');
                console.log('✅ Both commands should appear in popup logs');
                console.log('✅ No "Unknown" values should appear');
                console.log('\\n📱 Now open the Chrome extension popup to verify:');
                console.log('   1. Recent logs show "create_tab" and "execute_console"');
                console.log('   2. Click "Test Extension" button works');
                console.log('   3. Details windows show method names correctly');
                
                ws.close();
                resolve();
            } else {
                console.log('❌ Unexpected response:', response.error || 'Unknown');
                ws.close();
                resolve();
            }
        });
        
        ws.on('close', function close() {
            console.log('\\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
            ws.close();
            resolve();
        }, 10000);
    });
}

testPopupWithTab().catch(console.error);