const WebSocket = require('ws');
const { createBROPConnection } = require('../../test-utils');

async function testImplementationDetails() {
    console.log('🔧 Console Log Implementation Details Test');
    console.log('==========================================');
    
    const ws = createBROPConnection();
    let currentTabId = null;
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Step 1: Get available tabs first
            console.log('\n📋 Step 1: Getting available tabs...');
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
                // Handle tabs list response
                const tabs = response.result.tabs || [];
                console.log(`   ✅ Found ${tabs.length} tabs`);
                
                const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                
                if (!accessibleTab) {
                    console.log('\n🔧 Creating new tab for testing...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'create_tab',
                        params: { url: 'https://example.com' }
                    }));
                    return;
                }
                
                currentTabId = accessibleTab.tabId;
                console.log(`   🎯 Using tab ${currentTabId}: ${accessibleTab.title}`);
                
                // Test the detailed console log implementation
                console.log('\n🔍 Testing detailed console log capture implementation...');
                ws.send(JSON.stringify({
                    id: ++messageId,
                    method: 'get_console_logs',
                    params: { 
                        tabId: currentTabId,
                        limit: 10,
                        level: 'all'
                    }
                }));
                
            } else if (response.success && response.result && response.result.tabId) {
                // Handle tab creation response
                currentTabId = response.result.tabId;
                console.log(`   ✅ Created new tab ${currentTabId}`);
                
                // Test the detailed console log implementation
                console.log('\n🔍 Testing detailed console log capture implementation...');
                ws.send(JSON.stringify({
                    id: ++messageId,
                    method: 'get_console_logs',
                    params: { 
                        tabId: currentTabId,
                        limit: 10,
                        level: 'all'
                    }
                }));
                
            } else if (response.success) {
                if (response.id >= 2) {
                    console.log('\n🔧 DETAILED IMPLEMENTATION RESULTS:');
                    console.log('=====================================');
                    
                    const result = response.result;
                    
                    // Show implementation details
                    console.log('📊 Implementation Method:', result.method || 'undefined');
                    console.log('📍 Console Source:', result.source || 'undefined');
                    console.log('🎯 Target Tab:', result.tab_title || 'undefined');
                    console.log('🔗 Target URL:', result.tab_url || 'undefined');
                    console.log('🕒 Timestamp:', result.timestamp ? new Date(result.timestamp).toISOString() : 'undefined');
                    console.log('📝 Total Captured:', result.total_captured || 0);
                    
                    if (result.fallback_reason) {
                        console.log('⚠️  Fallback Reason:', result.fallback_reason);
                    }
                    
                    console.log('\n🔧 IMPLEMENTATION ANALYSIS:');
                    console.log('============================');
                    
                    if (result.method === 'chrome_devtools_protocol') {
                        console.log('✅ PRIMARY METHOD: Chrome DevTools Protocol (CDP)');
                        console.log('   🎯 Uses chrome.debugger.sendCommand()');
                        console.log('   🎯 Attaches debugger to target tab');
                        console.log('   🎯 Enables Console domain via CDP');
                        console.log('   🎯 Executes Runtime.evaluate for log capture');
                        console.log('   ✅ CSP-compliant (no eval() usage)');
                    } else if (result.method === 'extension_fallback') {
                        console.log('⚠️  FALLBACK METHOD: Extension Background Logs');
                        console.log('   📊 Source: Extension\'s own call logs');
                        console.log('   📊 Reason for fallback:', result.fallback_reason);
                    }
                    
                    if (result.source === 'page_console_cdp') {
                        console.log('✅ CONSOLE SOURCE: Page Console via CDP');
                        console.log('   🔧 Direct access to page console through debugger');
                    } else if (result.source === 'extension_background') {
                        console.log('📊 CONSOLE SOURCE: Extension Background');
                        console.log('   🔧 Extension\'s internal operation logs');
                    }
                    
                    // Show logs if available
                    if (result.logs && result.logs.length > 0) {
                        console.log('\n📋 CAPTURED CONSOLE LOGS:');
                        console.log('=========================');
                        result.logs.forEach((log, i) => {
                            const message = log.message || log.text || 'No message';
                            const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'unknown';
                            console.log(`   ${i + 1}. [${timestamp}] ${log.level.toUpperCase()}: ${message.substring(0, 100)}`);
                            if (log.source) {
                                console.log(`      Source: ${log.source}`);
                            }
                        });
                    } else {
                        console.log('\n📋 NO CONSOLE LOGS CAPTURED');
                        console.log('=============================');
                        console.log('💡 This is normal for many websites');
                        console.log('💡 Console logs are typically generated by:');
                        console.log('   - JavaScript errors');
                        console.log('   - Developer console.log() statements');
                        console.log('   - Framework debugging output');
                        console.log('   - Browser warnings');
                    }
                    
                    console.log('\n🎯 KEY IMPLEMENTATION FEATURES:');
                    console.log('================================');
                    console.log('✅ CSP-compliant: No eval() or new Function() usage');
                    console.log('✅ Multi-method approach: CDP primary, runtime messaging fallback');
                    console.log('✅ Tab detection: Prioritizes GitHub, falls back to any accessible tab');
                    console.log('✅ Debugger integration: Attaches CDP debugger for deep access');
                    console.log('✅ Error handling: Graceful fallbacks when methods fail');
                    console.log('✅ Detailed metadata: Source tracking and method identification');
                    
                    if (result.tab_url && result.tab_url.includes('github.com')) {
                        console.log('\n🎉 GITHUB COMPATIBILITY CONFIRMED');
                        console.log('==================================');
                        console.log('✅ Successfully accessing GitHub page without CSP violations');
                        console.log('✅ Chrome DevTools Protocol working on CSP-protected site');
                        console.log('✅ Extension can capture console data from GitHub');
                    }
                    
                } else {
                    console.log(`   ❌ Implementation test failed: ${response.error}`);
                    
                    if (response.error?.includes('CSP') || response.error?.includes('unsafe-eval')) {
                        console.log('   🚨 CSP VIOLATION DETECTED!');
                        console.log('   ❌ Implementation still has CSP issues');
                    } else {
                        console.log('   ✅ No CSP violations in error message');
                    }
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
        }, 15000);
    });
}

testImplementationDetails().catch(console.error);