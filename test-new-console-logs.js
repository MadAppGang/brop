const WebSocket = require('ws');

async function testNewConsoleLogMethod() {
    console.log('🌐 Testing New Console Log Method');
    console.log('=================================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Navigate to GitHub first
            console.log('\n🌐 Navigating to GitHub...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'navigate',
                params: { url: 'https://github.com' }
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.id === 1 && response.success) {
                console.log('   ✅ Navigation to GitHub completed');
                console.log('   🔄 Waiting 5 seconds for page to load and generate logs...');
                
                setTimeout(() => {
                    // Test runtime messaging for console logs
                    console.log('\n📜 Testing Chrome runtime messaging for console logs...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_console_logs',
                        params: { 
                            source: 'page_console',
                            limit: 50
                        }
                    }));
                }, 5000);
            } else if (response.id === 2) {
                console.log(`   ✅ Retrieved ${response.result?.logs?.length || 0} console logs`);
                console.log(`   📊 Source: ${response.result?.source}`);
                console.log(`   🌐 Tab: ${response.result?.tab_title}`);
                
                if (response.result?.logs?.length > 0) {
                    console.log('\n   📋 Recent console logs:');
                    response.result.logs.slice(-5).forEach((log, i) => {
                        console.log(`   ${i + 1}. [${log.timestamp}] ${log.level}: ${log.message?.substring(0, 80)}...`);
                    });
                } else {
                    console.log('   ℹ️  No console logs captured');
                    if (response.result?.fallback_reason) {
                        console.log(`   📝 Fallback reason: ${response.result.fallback_reason}`);
                    }
                }
                
                console.log('\n✅ New console log method test completed!');
                ws.close();
                resolve();
            }
            
            if (!response.success) {
                console.log(`   ❌ Error: ${response.error}`);
            }
        });
        
        ws.on('close', function close() {
            console.log('🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
    });
}

testNewConsoleLogMethod().catch(console.error);