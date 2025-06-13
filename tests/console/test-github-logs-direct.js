const WebSocket = require('ws');
const { createBROPConnection } = require('../../test-utils');

async function testGitHubLogsDirect() {
    console.log('📜 Testing GitHub Console Logs (Direct Capture)');
    console.log('===============================================');
    
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
                
                // Look for GitHub tab first, then any accessible tab
                const githubTab = tabs.find(tab => tab.accessible && tab.url.includes('github.com'));
                const accessibleTab = githubTab || tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                
                if (!accessibleTab) {
                    console.log('\n🔧 Creating new GitHub tab for testing...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'create_tab',
                        params: { url: 'https://github.com' }
                    }));
                    return;
                }
                
                currentTabId = accessibleTab.tabId;
                console.log(`   🎯 Using tab ${currentTabId}: ${accessibleTab.title}`);
                
                if (githubTab) {
                    console.log('   🎉 Found existing GitHub tab!');
                } else {
                    console.log('   📍 Navigating to GitHub...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'navigate',
                        params: {
                            tabId: currentTabId,
                            url: 'https://github.com'
                        }
                    }));
                    return;
                }
                
                // Wait a moment then capture logs from current page
                setTimeout(() => {
                    console.log('\n📜 Capturing console logs from GitHub tab...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_console_logs',
                        params: { 
                            tabId: currentTabId,
                            limit: 10,
                            source: 'page_console'
                        }
                    }));
                }, 1000);
                
            } else if (response.success && response.result && response.result.tabId) {
                // Handle tab creation response
                currentTabId = response.result.tabId;
                console.log(`   ✅ Created new GitHub tab ${currentTabId}`);
                
                // Wait for navigation then capture logs
                setTimeout(() => {
                    console.log('\n📜 Capturing console logs from new GitHub tab...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_console_logs',
                        params: { 
                            tabId: currentTabId,
                            limit: 10,
                            source: 'page_console'
                        }
                    }));
                }, 3000);
                
            } else if (response.success && response.id >= 2) {
                if (response.success) {
                    console.log(`   📊 Retrieved: ${response.result?.logs?.length || 0} console logs`);
                    console.log(`   📊 Source: ${response.result?.source || 'unknown'}`);
                    console.log(`   🌐 Page: ${response.result?.tab_title || 'unknown'}`);
                    console.log(`   🔗 URL: ${response.result?.tab_url || 'unknown'}`);
                    
                    if (response.result?.logs?.length > 0) {
                        console.log('\n   📋 GitHub Console Logs Captured:');
                        response.result.logs.forEach((log, i) => {
                            const message = log.message || log.text || 'No message';
                            console.log(`   ${i + 1}. [${log.timestamp || log.level}] ${log.level}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
                        });
                        console.log('\n🎉 SUCCESS: CSP-compliant console log capture working!');
                    } else {
                        console.log('   ℹ️  No console logs found on current page');
                        if (response.result?.fallback_reason) {
                            console.log(`   📝 Reason: ${response.result.fallback_reason}`);
                        }
                    }
                } else {
                    console.log(`   ❌ Failed: ${response.error}`);
                    if (response.error?.includes('CSP') || response.error?.includes('unsafe-eval')) {
                        console.log('   🚨 CSP violation still present!');
                    } else if (response.error?.includes('chrome://')) {
                        console.log('   💡 Try switching to GitHub tab and run again');
                    } else {
                        console.log('   ✅ No CSP violations detected');
                    }
                }
                
                    console.log('\n✅ Console log capture test completed!');
                    ws.close();
                    resolve();
                } else if (!response.success) {
                    console.log(`   ❌ Failed: ${response.error}`);
                    if (response.error?.includes('CSP') || response.error?.includes('unsafe-eval')) {
                        console.log('   🚨 CSP violation still present!');
                    } else if (response.error?.includes('chrome://')) {
                        console.log('   💡 Try switching to GitHub tab and run again');
                    } else {
                        console.log('   ✅ No CSP violations detected');
                    }
                    
                    console.log('\n❌ Console log capture test failed!');
                    ws.close();
                    resolve();
                }
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

testGitHubLogsDirect().catch(console.error);