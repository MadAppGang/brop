const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

async function debugStoredLogs() {
    console.log('🔍 Debug Stored Logs Format');
    console.log('===========================');
    console.log('📋 Checking what logs are actually stored in the extension');
    
    const ws = createBROPConnection();
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            console.log('\n📋 First, let\'s generate a test log entry...');
            
            // Generate a fresh log entry
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'list_tabs',
                params: {}
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            
            if (response.id === 1) {
                console.log('✅ Generated test log entry');
                console.log('\n📋 Now checking stored extension errors (which includes logs)...');
                
                // Check what's actually stored
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_extension_errors',
                        params: { limit: 3 }
                    }));
                }, 500);
                
            } else if (response.id === 2) {
                console.log('\n🔍 RAW STORED DATA ANALYSIS:');
                console.log('============================');
                
                if (response.success && response.result) {
                    // The get_extension_errors doesn't return activity logs, it returns error logs
                    // Let's try to access the activity logs via the popup mechanism
                    console.log('📊 Extension Errors Response:');
                    console.log(JSON.stringify(response.result, null, 2));
                    
                    console.log('\n💡 The popup gets logs via chrome.runtime.sendMessage');
                    console.log('   Let\'s check the extension background script logCall function...');
                    
                } else {
                    console.log('❌ Failed to get stored data:', response.error);
                }
                
                ws.close();
                resolve();
            }
        });
        
        ws.on('close', function close() {
            console.log('\n🔌 Disconnected from bridge');
            console.log('\n🔍 INVESTIGATION FINDINGS:');
            console.log('=========================');
            console.log('The popup "Unknown" issue is likely because:');
            console.log('1. 📊 Extension logs are stored in this.callLogs array');
            console.log('2. 📱 Popup requests logs via chrome.runtime.sendMessage');
            console.log('3. 🔍 Background script returns this.callLogs data');
            console.log('4. ❌ Something in this chain is causing method to be undefined');
            
            console.log('\n🔧 Next steps:');
            console.log('1. Check how logCall() function stores the method field');
            console.log('2. Check how popup requests logs');
            console.log('3. Check how background script responds to log requests');
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
            ws.close();
            resolve();
        }, 10000);
    });
}

debugStoredLogs().catch(console.error);