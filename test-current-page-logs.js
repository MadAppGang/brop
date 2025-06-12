const WebSocket = require('ws');

async function testCurrentPageLogs() {
    console.log('📜 Testing Console Logs on Current Page');
    console.log('=======================================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Don't navigate - just capture logs from whatever page is currently open
            console.log('\n📜 Capturing console logs from current page...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'get_console_logs',
                params: { 
                    limit: 20,
                    source: 'page_console'
                }
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.id === 1) {
                console.log(`   📊 Retrieved: ${response.result?.logs?.length || 0} console logs`);
                console.log(`   📊 Source: ${response.result?.source || 'unknown'}`);
                console.log(`   🌐 Page: ${response.result?.tab_title || 'unknown'}`);
                console.log(`   🔗 URL: ${response.result?.tab_url || 'unknown'}`);
                
                if (response.result?.logs?.length > 0) {
                    console.log('\n   📋 Captured console logs:');
                    response.result.logs.forEach((log, i) => {
                        const message = log.message || log.text || 'No message';
                        console.log(`   ${i + 1}. [${log.timestamp || log.level}] ${log.level}: ${message.substring(0, 120)}${message.length > 120 ? '...' : ''}`);
                    });
                } else {
                    console.log('   ℹ️  No console logs captured');
                    if (response.result?.fallback_reason) {
                        console.log(`   📝 Fallback reason: ${response.result.fallback_reason}`);
                    }
                    if (response.result?.error) {
                        console.log(`   ❌ Error: ${response.result.error}`);
                    }
                }
                
                console.log('\n✅ Console log capture test completed!');
                ws.close();
                resolve();
            }
            
            if (!response.success) {
                console.log(`   ❌ Error: ${response.error}`);
                if (response.error?.includes('CSP') || response.error?.includes('unsafe-eval')) {
                    console.log('   🚨 CSP violation still present!');
                } else {
                    console.log('   ✅ No CSP violations - our fixes worked!');
                }
            }
        });
        
        ws.on('close', function close() {
            console.log('🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
    });
}

testCurrentPageLogs().catch(console.error);