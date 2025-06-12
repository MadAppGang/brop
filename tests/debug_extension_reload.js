#!/usr/bin/env node
/**
 * Debug Extension Reload
 * 
 * This test helps verify that the extension is actually reloaded with the latest code
 * by checking timestamps and specific values in events.
 */

const WebSocket = require('ws');

async function debugExtensionReload() {
    console.log('🔄 Debug Extension Reload');
    console.log('=' + '='.repeat(50));
    console.log('This test helps verify the extension is using the latest code.');
    console.log('');
    
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9222');
        let messageId = 1;
        
        ws.on('open', () => {
            console.log('✅ Connected to BROP CDP server');
            
            // Send Browser.getVersion to get extension info
            console.log('📤 Getting browser version and extension info...');
            ws.send(JSON.stringify({
                id: messageId++,
                method: 'Browser.getVersion',
                params: {}
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                
                if (parsed.id === 1) {
                    console.log('📥 Browser version response:');
                    console.log(`   Product: ${parsed.result?.product}`);
                    console.log(`   User Agent: ${parsed.result?.userAgent}`);
                    console.log(`   Protocol Version: ${parsed.result?.protocolVersion}`);
                    
                    // Send Target.setAutoAttach
                    console.log('\n📤 Setting auto-attach (this should trigger events)...');
                    ws.send(JSON.stringify({
                        id: messageId++,
                        method: 'Target.setAutoAttach',
                        params: {
                            autoAttach: true,
                            waitForDebuggerOnStart: true, // This is what Playwright sends
                            flatten: true
                        }
                    }));
                } else if (parsed.id === 2) {
                    console.log('✅ Target.setAutoAttach response received');
                    
                    // Create a target to trigger the attachment event
                    console.log('\n📤 Creating target to trigger attachment...');
                    ws.send(JSON.stringify({
                        id: messageId++,
                        method: 'Target.createTarget',
                        params: {
                            url: 'about:blank',
                            browserContextId: 'default'
                        }
                    }));
                } else if (parsed.id === 3) {
                    console.log('✅ Target.createTarget response received');
                    console.log(`   Created target: ${parsed.result?.targetId}`);
                    
                    // Wait for events then close
                    setTimeout(() => {
                        console.log('\n🔌 Closing connection...');
                        ws.close();
                    }, 1000);
                } else if (parsed.method === 'Target.attachedToTarget') {
                    console.log('\n📡 TARGET ATTACHED EVENT:');
                    console.log(`   sessionId: ${parsed.params?.sessionId}`);
                    console.log(`   targetId: ${parsed.params?.targetInfo?.targetId}`);
                    console.log(`   🎯 waitingForDebugger: ${parsed.params?.waitingForDebugger} (should be false)`);
                    
                    if (parsed.params?.waitingForDebugger === true) {
                        console.log('   ❌ PROBLEM: waitingForDebugger is true!');
                        console.log('   ❌ This will cause Playwright assertion error');
                        console.log('   💡 Extension may not be reloaded with latest code');
                    } else {
                        console.log('   ✅ Good: waitingForDebugger is false');
                    }
                } else if (parsed.method) {
                    console.log(`📡 Event: ${parsed.method}`);
                }
                
            } catch (error) {
                console.log('❌ Parse error:', error.message);
            }
        });
        
        ws.on('close', () => {
            console.log('🔌 Connection closed');
            resolve();
        });
        
        ws.on('error', (error) => {
            console.log('❌ Connection error:', error.message);
            resolve();
        });
    });
}

async function main() {
    console.log('🎯 Extension Reload Debug Test');
    console.log('=' + '='.repeat(60));
    console.log('Instructions:');
    console.log('1. Go to chrome://extensions/');
    console.log('2. Find the BROP extension');
    console.log('3. Click the reload button (↻)');
    console.log('4. Wait for extension to reconnect to bridge');
    console.log('5. Run this test');
    console.log('');
    console.log('Press Enter when extension is reloaded...');
    
    // Wait for user input
    process.stdin.setRawMode(true);
    process.stdin.resume();
    await new Promise(resolve => {
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            resolve();
        });
    });
    
    await debugExtensionReload();
    
    console.log('\n💡 Next Steps:');
    console.log('If waitingForDebugger is still true:');
    console.log('1. Extension may not be fully reloaded');
    console.log('2. There may be a different code path setting this value');
    console.log('3. The issue might be in Target.setAutoAttach parameter handling');
}

main();