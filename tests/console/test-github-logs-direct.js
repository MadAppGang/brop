const WebSocket = require('ws');

async function testGitHubLogsDirect() {
    console.log('📜 Testing GitHub Console Logs (Direct Capture)');
    console.log('===============================================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            console.log('🎯 Make sure you have GitHub open in your browser');
            console.log('🎯 The extension will capture logs from the currently active tab');
            
            // Wait a moment then capture logs from current page
            setTimeout(() => {
                console.log('\n📜 Capturing console logs from active tab...');
                ws.send(JSON.stringify({
                    id: ++messageId,
                    method: 'get_console_logs',
                    params: { 
                        limit: 10,
                        source: 'page_console'
                    }
                }));
            }, 1000);
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.id === 1) {
                if (response.success) {
                    console.log(`   📊 Retrieved: ${response.result?.logs?.length || 0} console logs`);
                    console.log(`   📊 Source: ${response.result?.source || 'unknown'}`);
                    console.log(`   🌐 Page: ${response.result?.tab_title || 'unknown'}`);
                    console.log(`   🔗 URL: ${response.result?.tab_url || 'unknown'}`);
                    
                    if (response.result?.logs?.length > 0) {
                        console.log('\n   📋 GitHub Console Logs Captured:');
                        response.result.logs.forEach((log, i) => {
                            const message = log.message || log.text || 'No message';
                            console.log(`   ${i + 1}. [${log.timestamp || log.level}] ${log.level}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
                        });
                        console.log('\n🎉 SUCCESS: CSP-compliant console log capture working!');
                    } else {
                        console.log('   ℹ️  No console logs found on current page');
                        if (response.result?.fallback_reason) {
                            console.log(`   📝 Reason: ${response.result.fallback_reason}`);
                        }
                    }
                } else {
                    console.log(`   ❌ Failed: ${response.error}`);
                    if (response.error?.includes('CSP') || response.error?.includes('unsafe-eval')) {
                        console.log('   🚨 CSP violation still present!');
                    } else if (response.error?.includes('chrome://')) {
                        console.log('   💡 Try switching to GitHub tab and run again');
                    } else {
                        console.log('   ✅ No CSP violations detected');
                    }
                }
                
                console.log('\n✅ Console log capture test completed!');
                ws.close();
                resolve();
            }
        });
        
        ws.on('close', function close() {
            console.log('🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        // Add timeout
        setTimeout(() => {
            console.log('⏰ Test timeout - closing connection');
            ws.close();
            resolve();
        }, 10000);
    });
}

testGitHubLogsDirect().catch(console.error);