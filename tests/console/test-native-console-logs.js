const WebSocket = require('ws');
const { createBROPConnection } = require('../../test-utils');

async function testNativeConsoleLogs() {
    console.log('🎯 Testing Native Console Log Capture');
    console.log('=====================================');
    console.log('📋 Instructions:');
    console.log('   1. Open your browser DevTools (F12)');
    console.log('   2. Go to the Console tab');
    console.log('   3. Type these commands manually:');
    console.log('      console.log("🎯 Manual test message");');
    console.log('      console.warn("⚠️ Manual warning");');
    console.log('      console.error("❌ Manual error");');
    console.log('   4. Then this test will capture those logs');
    console.log('');
    console.log('⏰ You have 15 seconds to add console messages...');
    console.log('');
    
    const ws = createBROPConnection();
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        let currentTabId = null;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // First get available tabs
            console.log('📋 Getting available tabs...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'list_tabs',
                params: {}
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.id === 1 && response.success) {
                // Handle tabs list
                const tabs = response.result.tabs || [];
                console.log(`📋 Found ${tabs.length} tabs`);
                
                const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                
                if (accessibleTab) {
                    currentTabId = accessibleTab.tabId;
                    console.log(`✅ Using tab ${currentTabId}: ${accessibleTab.title}`);
                    
                    // Give user time to manually add console messages
                    console.log('⏳ Waiting 15 seconds for you to add console messages...');
                    setTimeout(() => {
                        console.log('\n📜 Now capturing console logs...');
                        ws.send(JSON.stringify({
                            id: ++messageId,
                            method: 'get_console_logs',
                            params: { 
                                tabId: currentTabId,
                                limit: 50
                            }
                        }));
                    }, 15000);
                } else {
                    console.log('❌ No accessible tabs found');
                    ws.close();
                    resolve();
                }
            } else if (response.id === 2) {
                if (response.success) {
                    console.log('\n📊 NATIVE CONSOLE LOG RESULTS:');
                    console.log('===============================');
                    
                    const result = response.result;
                    console.log(`🎯 Tab: ${result.tab_title}`);
                    console.log(`🔗 URL: ${result.tab_url}`);
                    console.log(`📊 Method: ${result.method}`);
                    console.log(`📍 Source: ${result.source}`);
                    console.log(`📝 Total: ${result.total_captured || result.logs?.length || 0}`);
                    
                    if (result.logs && result.logs.length > 0) {
                        console.log('\n📋 ALL CAPTURED LOGS:');
                        console.log('======================');
                        result.logs.forEach((log, i) => {
                            const message = log.message || log.text || 'No message';
                            const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'unknown';
                            console.log(`${i + 1}. [${time}] ${log.level.toUpperCase()}: ${message}`);
                            if (log.source && log.source !== 'page_console_cdp') {
                                console.log(`   📍 Source: ${log.source}`);
                            }
                        });
                        
                        // Look for manual test messages
                        const manualMessages = result.logs.filter(log => 
                            (log.message || log.text || '').includes('Manual') ||
                            (log.message || log.text || '').includes('🎯') ||
                            (log.message || log.text || '').includes('⚠️') ||
                            (log.message || log.text || '').includes('❌')
                        );
                        
                        if (manualMessages.length > 0) {
                            console.log(`\n🎉 SUCCESS: Found ${manualMessages.length} manual console messages!`);
                            manualMessages.forEach((msg, i) => {
                                console.log(`   ${i + 1}. ${msg.level}: ${msg.message || msg.text}`);
                            });
                            console.log('\n✅ Console log capture is working for native browser console!');
                        } else {
                            console.log('\n📝 No manual test messages found');
                            console.log('💡 Try running the test again and quickly add console messages:');
                            console.log('   console.log("Test message");');
                            console.log('   console.warn("Test warning");');
                            console.log('   console.error("Test error");');
                        }
                        
                        // Analyze what types of logs we captured
                        const sources = [...new Set(result.logs.map(log => log.source))];
                        console.log(`\n🔧 Log sources detected: ${sources.join(', ')}`);
                        
                        const levels = [...new Set(result.logs.map(log => log.level))];
                        console.log(`🔧 Log levels detected: ${levels.join(', ')}`);
                        
                    } else {
                        console.log('\n📋 No console logs captured');
                        console.log('💡 Possible reasons:');
                        console.log('   - No console messages were added manually');
                        console.log('   - Console capture method needs refinement');
                        console.log('   - Page doesn\'t have active console logging');
                        console.log('\n🔧 Try again and manually add these in DevTools Console:');
                        console.log('   console.log("Hello from DevTools!");');
                        console.log('   console.warn("Warning message");');
                        console.log('   console.error("Error message");');
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
        }, 30000);
    });
}

testNativeConsoleLogs().catch(console.error);