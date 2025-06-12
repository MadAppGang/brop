const WebSocket = require('ws');

async function testDebugConsole() {
    console.log('🔧 Debug Console Log Capture');
    console.log('============================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Test console logs with debug info
            console.log('\n📜 Testing console log capture with debug info...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'get_console_logs',
                params: { 
                    limit: 5,
                    source: 'page_console'
                }
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.id === 1) {
                if (response.success) {
                    console.log('\n🔧 DEBUG Response Details:');
                    console.log('   📊 Logs count:', response.result?.logs?.length || 0);
                    console.log('   📊 Source:', response.result?.source || 'undefined');
                    console.log('   🌐 Tab title:', response.result?.tab_title || 'undefined');
                    console.log('   🔗 Tab URL:', response.result?.tab_url || 'undefined');
                    console.log('   📝 Total captured:', response.result?.total_captured || 'undefined');
                    
                    if (response.result?.fallback_reason) {
                        console.log('   📝 Fallback reason:', response.result.fallback_reason);
                    }
                    
                    if (response.result?.logs?.length > 0) {
                        console.log('\n📋 Console Logs Found:');
                        response.result.logs.forEach((log, i) => {
                            console.log(`   ${i + 1}. [${log.timestamp || log.level}] ${log.level}: ${(log.message || log.text || 'No message').substring(0, 100)}`);
                        });
                        console.log('\n🎉 SUCCESS: Console logs captured!');
                    } else {
                        console.log('\n💡 Analysis:');
                        if (response.result?.tab_url?.includes('github.com')) {
                            console.log('   ✅ Accessing GitHub page');
                            console.log('   💡 GitHub might not have console logs at this moment');
                            console.log('   💡 Try refreshing GitHub page to generate more logs');
                        } else {
                            console.log('   ❌ Not accessing GitHub page');
                            console.log('   💡 Switch to GitHub tab and try again');
                        }
                    }
                } else {
                    console.log(`   ❌ Error: ${response.error}`);
                    
                    if (response.error?.includes('CSP') || response.error?.includes('unsafe-eval')) {
                        console.log('   🚨 CSP violation detected - our fixes need more work!');
                    } else {
                        console.log('   ✅ No CSP violations detected');
                    }
                }
                
                console.log('\n✅ Debug test completed!');
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

testDebugConsole().catch(console.error);