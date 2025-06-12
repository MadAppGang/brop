const WebSocket = require('ws');

async function testSimpleDebug() {
    console.log('🔧 Simple Debug Test');
    console.log('====================');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Test with simple get_console_logs command
            console.log('\n🔧 Testing get_console_logs command...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'get_console_logs',
                params: { limit: 3 }
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.success) {
                console.log('🎉 SUCCESS: Command processed successfully');
                if (response.result?.logs) {
                    console.log(`📊 Retrieved ${response.result.logs.length} logs`);
                    console.log('📋 First few logs:');
                    response.result.logs.slice(0, 3).forEach((log, i) => {
                        console.log(`   ${i + 1}. ${JSON.stringify(log).substring(0, 100)}`);
                    });
                }
            } else {
                console.log(`❌ Error: ${response.error}`);
            }
            
            ws.close();
            resolve();
        });
        
        ws.on('close', function close() {
            console.log('🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
            console.log('⏰ Test timeout');
            ws.close();
            resolve();
        }, 10000);
    });
}

testSimpleDebug().catch(console.error);