const WebSocket = require('ws');

async function testPopupLogs() {
    console.log('🧪 Popup Logs Format Test');
    console.log('==========================');
    console.log('📋 Testing various commands to verify method names appear correctly in popup');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        let currentTest = 0;
        
        const tests = [
            { name: 'list_tabs', method: 'list_tabs', params: {} },
            { name: 'get_extension_errors', method: 'get_extension_errors', params: { limit: 5 } },
            { name: 'create_tab', method: 'create_tab', params: { url: 'https://httpbin.org/html' } },
            { name: 'navigate', method: 'navigate', params: { url: 'https://example.com' } },
            { name: 'invalid_command', method: 'invalid_command_test', params: {} }
        ];
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            runNextTest();
        });
        
        function runNextTest() {
            if (currentTest >= tests.length) {
                console.log('\n🎉 ALL COMMANDS SENT!');
                console.log('📋 Generated log entries for popup testing:');
                tests.forEach((test, i) => {
                    console.log(`   ${i + 1}. ${test.name} (method: "${test.method}")`);
                });
                console.log('\n📱 Now check the Chrome extension popup to verify:');
                console.log('   1. All method names show correctly in the log list');
                console.log('   2. Click on any log entry to see details window');
                console.log('   3. Verify method name appears in details window title and content');
                console.log('   4. No "undefined" or "Unknown" should appear for method names');
                
                ws.close();
                resolve();
                return;
            }
            
            const test = tests[currentTest];
            console.log(`\n🔧 Sending ${currentTest + 1}/${tests.length}: ${test.name}`);
            
            ws.send(JSON.stringify({
                id: ++messageId,
                method: test.method,
                params: test.params
            }));
            
            currentTest++;
        }
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            const test = tests[currentTest - 1];
            
            console.log(`   📥 ${response.success ? '✅ SUCCESS' : '❌ FAILED'}: ${test.name}`);
            if (!response.success) {
                console.log(`      Error: ${response.error?.substring(0, 60)}...`);
            }
            
            // Continue with next test after a short delay
            setTimeout(runNextTest, 500);
        });
        
        ws.on('close', function close() {
            console.log('\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
            ws.close();
            resolve();
        }, 15000);
    });
}

testPopupLogs().catch(console.error);