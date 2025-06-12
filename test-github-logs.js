const WebSocket = require('ws');

async function testGitHubLogs() {
    console.log('🌐 Testing GitHub Console Logs');
    console.log('===============================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Navigate to GitHub
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
                console.log('   🔄 Waiting 3 seconds for page to load...');
                
                setTimeout(() => {
                    // Get console logs
                    console.log('\n📜 Getting GitHub console logs...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_console_logs',
                        params: { source: 'page_console' }
                    }));
                }, 3000);
            } else if (response.id === 2) {
                console.log(`   ✅ Retrieved ${response.result?.logs?.length || 0} console logs from GitHub`);
                console.log(`   📊 Source: ${response.result?.source}`);
                
                if (response.result?.logs?.length > 0) {
                    console.log('\n   📋 GitHub console logs:');
                    response.result.logs.slice(0, 5).forEach((log, i) => {
                        console.log(`   ${i + 1}. [${log.timestamp}] ${log.level}: ${log.message.substring(0, 100)}...`);
                    });
                } else {
                    console.log('   ℹ️  No console logs captured from GitHub (likely due to CSP)');
                }
                
                // Get extension logs too
                console.log('\n🔧 Getting extension logs...');
                ws.send(JSON.stringify({
                    id: ++messageId,
                    method: 'get_console_logs',
                    params: { source: 'extension_background' }
                }));
            } else if (response.id === 3) {
                console.log(`   ✅ Retrieved ${response.result?.logs?.length || 0} extension logs`);
                
                if (response.result?.logs?.length > 0) {
                    console.log('\n   📋 Recent extension activity:');
                    response.result.logs.slice(-5).forEach((log, i) => {
                        console.log(`   ${i + 1}. [${log.timestamp}] ${log.level}: ${log.message.substring(0, 80)}...`);
                    });
                }
                
                console.log('\n✅ GitHub logging test completed!');
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

testGitHubLogs().catch(console.error);