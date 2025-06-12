const WebSocket = require('ws');

async function testGenerateLogs() {
    console.log('🎯 Testing Console Log Generation');
    console.log('==================================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // First, execute some console commands to generate logs
            console.log('\n🔧 Step 1: Generating console logs...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'execute_console',
                params: { 
                    code: 'console.log("Test message from BROP!")'
                }
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.id === 1) {
                if (response.success) {
                    console.log(`   ✅ Console command executed: ${response.result?.result || 'Unknown'}`);
                    
                    // Wait a moment, then try to capture the logs
                    console.log('\n🔧 Step 2: Waiting 2 seconds for logs to propagate...');
                    setTimeout(() => {
                        console.log('\n📜 Step 3: Capturing console logs...');
                        ws.send(JSON.stringify({
                            id: ++messageId,
                            method: 'get_console_logs',
                            params: { 
                                limit: 20
                            }
                        }));
                    }, 2000);
                } else {
                    console.log(`   ❌ Failed to execute console command: ${response.error}`);
                    ws.close();
                    resolve();
                }
            } else if (response.id === 2) {
                if (response.success) {
                    console.log('\n📊 CAPTURED LOGS ANALYSIS:');
                    console.log('==========================');
                    
                    const result = response.result;
                    console.log(`🎯 Tab: ${result.tab_title}`);
                    console.log(`🔗 URL: ${result.tab_url}`);
                    console.log(`📊 Method: ${result.method}`);
                    console.log(`📍 Source: ${result.source}`);
                    console.log(`📝 Total: ${result.total_captured || result.logs?.length || 0}`);
                    
                    if (result.logs && result.logs.length > 0) {
                        console.log('\n📋 ALL CAPTURED LOGS:');
                        console.log('=====================');
                        result.logs.forEach((log, i) => {
                            const message = log.message || log.text || 'No message';
                            const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'unknown';
                            console.log(`${i + 1}. [${time}] ${log.level.toUpperCase()}: ${message}`);
                            if (log.source) {
                                console.log(`   📍 Source: ${log.source}`);
                            }
                        });
                        
                        // Check if we captured our test message
                        const hasTestMessage = result.logs.some(log => 
                            (log.message || log.text || '').includes('Test message from BROP')
                        );
                        
                        if (hasTestMessage) {
                            console.log('\n🎉 SUCCESS: Found our test message in the logs!');
                        } else {
                            console.log('\n💡 Note: Test message not found in captured logs');
                            console.log('   This could be due to timing or console capture method');
                        }
                    } else {
                        console.log('\n📋 No logs captured');
                        console.log('💡 This might be because:');
                        console.log('   - Console logs haven\'t propagated yet');
                        console.log('   - Page doesn\'t generate console output');
                        console.log('   - Console capture method needs refinement');
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
        }, 20000);
    });
}

testGenerateLogs().catch(console.error);