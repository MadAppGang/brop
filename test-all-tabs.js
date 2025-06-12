const WebSocket = require('ws');

async function testAllTabs() {
    console.log('📜 Testing All Available Tabs');
    console.log('=============================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Use navigate command to see tabs
            console.log('\n📜 Getting all tabs information...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'get_page_content',
                params: {}
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.id === 1) {
                if (response.success) {
                    console.log(`   🌐 Current page: ${response.result?.title || 'unknown'}`);
                    console.log(`   🔗 URL: ${response.result?.url || 'unknown'}`);
                    console.log(`   📄 HTML length: ${response.result?.html?.length || 0} chars`);
                    
                    if (response.result?.url?.includes('github.com')) {
                        console.log('\n🎉 GitHub page detected! Now trying to get console logs...');
                        
                        // Try to get console logs from this GitHub page
                        setTimeout(() => {
                            ws.send(JSON.stringify({
                                id: ++messageId,
                                method: 'get_console_logs',
                                params: { 
                                    limit: 10,
                                    source: 'page_console'
                                }
                            }));
                        }, 1000);
                    } else {
                        console.log('\n💡 This is not GitHub. Please:');
                        console.log('   1. Open GitHub in your browser');
                        console.log('   2. Make sure the GitHub tab is active/focused');
                        console.log('   3. Run the test again');
                        ws.close();
                        resolve();
                    }
                } else {
                    console.log(`   ❌ Failed to get page content: ${response.error}`);
                    if (response.error?.includes('No active tab')) {
                        console.log('\n💡 No active tab found. Please:');
                        console.log('   1. Make sure your browser window is focused');
                        console.log('   2. Click on any tab to make it active');
                        console.log('   3. Run the test again');
                    }
                    ws.close();
                    resolve();
                }
            } else if (response.id === 2) {
                if (response.success) {
                    console.log(`   📊 Retrieved: ${response.result?.logs?.length || 0} console logs from GitHub`);
                    
                    if (response.result?.logs?.length > 0) {
                        console.log('\n   📋 GitHub Console Logs:');
                        response.result.logs.forEach((log, i) => {
                            const message = log.message || log.text || 'No message';
                            console.log(`   ${i + 1}. [${log.level}] ${message.substring(0, 120)}...`);
                        });
                        console.log('\n🎉 SUCCESS: Console logs captured from GitHub!');
                    } else {
                        console.log('   ℹ️  No console logs found (this is normal for many sites)');
                    }
                } else {
                    console.log(`   ❌ Failed to get console logs: ${response.error}`);
                }
                
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
        }, 15000);
    });
}

testAllTabs().catch(console.error);