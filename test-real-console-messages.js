const WebSocket = require('ws');

async function testRealConsoleMessages() {
    console.log('📨 Testing Real Console Message Capture');
    console.log('=======================================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // First, inject console interceptor and generate multiple messages
            console.log('\n🔧 Step 1: Setting up console interceptor and generating messages...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'execute_console',
                params: { 
                    code: `
                        // Generate multiple console messages
                        console.log("🎯 First test message");
                        console.warn("⚠️ Warning test message"); 
                        console.error("❌ Error test message");
                        console.info("ℹ️ Info test message");
                        
                        // Create a custom event for testing
                        window.dispatchEvent(new CustomEvent('test-event', {detail: 'Test event fired'}));
                        
                        return "Generated 4 console messages";
                    `
                }
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.id === 1) {
                if (response.success) {
                    console.log(`   ✅ Console messages generated: ${response.result?.result || 'Unknown'}`);
                    
                    // Wait longer for messages to be captured by interceptor
                    console.log('\n🔧 Step 2: Waiting 3 seconds for console interceptor...');
                    setTimeout(() => {
                        console.log('\n📜 Step 3: Capturing console logs...');
                        ws.send(JSON.stringify({
                            id: ++messageId,
                            method: 'get_console_logs',
                            params: { 
                                limit: 50
                            }
                        }));
                    }, 3000);
                } else {
                    console.log(`   ❌ Failed to generate messages: ${response.error}`);
                    ws.close();
                    resolve();
                }
            } else if (response.id === 2) {
                if (response.success) {
                    console.log('\n📊 CONSOLE CAPTURE RESULTS:');
                    console.log('============================');
                    
                    const result = response.result;
                    console.log(`🎯 Tab: ${result.tab_title}`);
                    console.log(`🔗 URL: ${result.tab_url}`);
                    console.log(`📊 Method: ${result.method}`);
                    console.log(`📍 Source: ${result.source}`);
                    console.log(`📝 Total: ${result.total_captured || result.logs?.length || 0}`);
                    
                    if (result.logs && result.logs.length > 0) {
                        console.log('\n📋 ALL CAPTURED CONSOLE MESSAGES:');
                        console.log('==================================');
                        result.logs.forEach((log, i) => {
                            const message = log.message || log.text || 'No message';
                            const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'unknown';
                            console.log(`${i + 1}. [${time}] ${log.level.toUpperCase()}: ${message}`);
                            if (log.source && log.source !== 'page_console_cdp') {
                                console.log(`   📍 Source: ${log.source}`);
                            }
                        });
                        
                        // Analyze what we captured
                        const testMessages = result.logs.filter(log => 
                            (log.message || log.text || '').includes('test message') ||
                            (log.message || log.text || '').includes('🎯') ||
                            (log.message || log.text || '').includes('⚠️') ||
                            (log.message || log.text || '').includes('❌') ||
                            (log.message || log.text || '').includes('ℹ️')
                        );
                        
                        if (testMessages.length > 0) {
                            console.log(`\n🎉 SUCCESS: Found ${testMessages.length} test messages!`);
                            testMessages.forEach((msg, i) => {
                                console.log(`   ${i + 1}. ${msg.level}: ${msg.message || msg.text}`);
                            });
                        } else {
                            console.log('\n📝 Analysis: No test messages found');
                            console.log('💡 Possible reasons:');
                            console.log('   - Console interceptor timing issue');
                            console.log('   - Messages not being properly captured');
                            console.log('   - CSP restrictions on console modification');
                            console.log('   - Page context isolation');
                        }
                        
                        // Check for any intercepted console logs
                        const interceptedLogs = result.logs.filter(log => 
                            (log.source || '').includes('intercepted')
                        );
                        
                        if (interceptedLogs.length > 0) {
                            console.log(`\n🔧 Intercepted logs found: ${interceptedLogs.length}`);
                        } else {
                            console.log('\n🔧 No intercepted logs detected');
                        }
                        
                    } else {
                        console.log('\n📋 No console messages captured');
                        console.log('💡 This suggests the console capture needs improvement');
                    }
                } else {
                    console.log(`   ❌ Failed to capture logs: ${response.error}`);
                }
                
                ws.close();
                resolve();
            }
        });
        
        ws.on('close', function close() {
            console.log('\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        // Add timeout
        setTimeout(() => {
            console.log('⏰ Test timeout - closing connection');
            ws.close();
            resolve();
        }, 25000);
    });
}

testRealConsoleMessages().catch(console.error);