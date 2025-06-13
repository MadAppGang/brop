const WebSocket = require('ws');

async function testPopupDisplay() {
    console.log('🧪 Simple Popup Display Test');
    console.log('============================');
    console.log('📋 This script will generate various log entries for popup testing');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        let testCount = 0;
        
        const commands = [
            { name: 'List Tabs', method: 'list_tabs', params: {} },
            { name: 'Get Errors', method: 'get_extension_errors', params: { limit: 3 } },
            { name: 'Create Tab', method: 'create_tab', params: { url: 'https://example.com' } },
            { name: 'Invalid Command', method: 'invalid_test_command', params: {} },
            { name: 'Navigation', method: 'navigate', params: { url: 'https://google.com' } }
        ];
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            console.log('\n📋 Generating log entries...');
            sendNextCommand();
        });
        
        function sendNextCommand() {
            if (testCount >= commands.length) {
                console.log('\n🎉 All commands sent! Log entries generated.');
                console.log('\n📱 Now test the popup:');
                console.log('=====================================');
                console.log('1. 🔍 Open Chrome extension popup (click BROP icon)');
                console.log('2. 📋 Check that you see these method names in the log list:');
                commands.forEach((cmd, i) => {
                    console.log(`   ${i + 1}. "${cmd.method}" (${cmd.name})`);
                });
                console.log('\n3. 🖱️  Click on any log entry to open details window');
                console.log('4. 🔍 Verify in details window:');
                console.log('   - Title shows method name (e.g., "BROP Log Details - list_tabs")');
                console.log('   - Header shows method name');
                console.log('   - "Method:" field shows correct value');
                console.log('   - NO "undefined" or "Unknown" should appear');
                
                console.log('\n✅ Expected Results:');
                console.log('   - All method names display correctly');
                console.log('   - Success/error status shows properly');
                console.log('   - Details window opens with correct information');
                console.log('   - No formatting issues or undefined values');
                
                setTimeout(() => {
                    ws.close();
                    resolve();
                }, 1000);
                return;
            }
            
            const cmd = commands[testCount];
            console.log(`   ${testCount + 1}. Sending "${cmd.method}" (${cmd.name})...`);
            
            ws.send(JSON.stringify({
                id: ++messageId,
                method: cmd.method,
                params: cmd.params
            }));
            
            testCount++;
        }
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            const cmd = commands[testCount - 1];
            
            const status = response.success ? '✅ SUCCESS' : '❌ FAILED';
            console.log(`      ${status}`);
            
            if (!response.success && response.error) {
                console.log(`      Error: ${response.error.substring(0, 50)}...`);
            }
            
            // Send next command after a short delay
            setTimeout(sendNextCommand, 300);
        });
        
        ws.on('close', function close() {
            console.log('\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        // Timeout after 15 seconds
        setTimeout(() => {
            console.log('\n⏰ Test timeout');
            ws.close();
            resolve();
        }, 15000);
    });
}

testPopupDisplay().catch(console.error);