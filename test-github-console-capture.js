const WebSocket = require('ws');

async function testGitHubConsoleCapture() {
    console.log('🌐 Testing GitHub Console Log Capture (CSP-Fixed)');
    console.log('=================================================');
    
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
                console.log('   🔄 Waiting 5 seconds for GitHub to load and generate console logs...');
                
                setTimeout(() => {
                    console.log('\n📜 Testing CSP-compliant console log capture...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_console_logs',
                        params: { 
                            limit: 50,
                            source: 'page_console'
                        }
                    }));
                }, 5000);
            } else if (response.id === 2) {
                console.log(`   ✅ Console log capture completed`);
                console.log(`   📊 Retrieved: ${response.result?.logs?.length || 0} logs`);
                console.log(`   📊 Source: ${response.result?.source || 'unknown'}`);
                console.log(`   🌐 Page: ${response.result?.tab_title || 'unknown'}`);
                
                if (response.result?.logs?.length > 0) {
                    console.log('\n   📋 Console logs captured:');
                    response.result.logs.slice(0, 5).forEach((log, i) => {
                        console.log(`   ${i + 1}. [${log.timestamp}] ${log.level}: ${log.message?.substring(0, 100)}...`);
                    });
                } else {
                    console.log('   ℹ️  No console logs captured');
                    if (response.result?.fallback_reason) {
                        console.log(`   📝 Fallback reason: ${response.result.fallback_reason}`);
                    }
                }
                
                console.log('\n✅ CSP-compliant console capture test completed!');
                console.log('🎯 No "unsafe-eval" CSP errors should appear in browser console');
                ws.close();
                resolve();
            }
            
            if (!response.success) {
                console.log(`   ❌ Error: ${response.error}`);
                if (response.error?.includes('CSP') || response.error?.includes('unsafe-eval')) {
                    console.log('   🚨 CSP violation detected - our fixes need more work!');
                } else {
                    console.log('   ✅ No CSP violations - this is a different issue');
                }
            }
        });
        
        ws.on('close', function close() {
            console.log('🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
    });
}

testGitHubConsoleCapture().catch(console.error);