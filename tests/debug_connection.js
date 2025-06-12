#!/usr/bin/env node
/**
 * Debug Playwright CDP connection to isolate the assertion error
 */

const WebSocket = require('ws');

async function debugConnection() {
    console.log('🔍 Debug CDP Connection');
    console.log('=' + '='.repeat(40));
    
    const ws = new WebSocket('ws://localhost:9222');
    let messageId = 1;
    
    ws.on('open', () => {
        console.log('✅ WebSocket connected');
        
        // Send the same sequence of commands that Playwright sends
        console.log('\n📤 Sending Browser.getVersion...');
        ws.send(JSON.stringify({
            id: messageId++,
            method: 'Browser.getVersion',
            params: {}
        }));
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('📥 Received:', JSON.stringify(message, null, 2));
            
            if (message.id === 1) {
                // After Browser.getVersion, send Target.setAutoAttach
                console.log('\n📤 Sending Target.setAutoAttach...');
                ws.send(JSON.stringify({
                    id: messageId++,
                    method: 'Target.setAutoAttach',
                    params: {
                        autoAttach: true,
                        waitForDebuggerOnStart: true,
                        flatten: true
                    }
                }));
            } else if (message.id === 2) {
                // After Target.setAutoAttach, send Browser.setDownloadBehavior
                console.log('\n📤 Sending Browser.setDownloadBehavior...');
                ws.send(JSON.stringify({
                    id: messageId++,
                    method: 'Browser.setDownloadBehavior',
                    params: {
                        behavior: 'allowAndName',
                        downloadPath: '/tmp'
                    }
                }));
            } else if (message.id === 3) {
                // After Browser.setDownloadBehavior, send Target.createBrowserContext
                console.log('\n📤 Sending Target.createBrowserContext...');
                ws.send(JSON.stringify({
                    id: messageId++,
                    method: 'Target.createBrowserContext',
                    params: {
                        disposeOnDetach: true
                    }
                }));
            } else if (message.id === 4) {
                // After Target.createBrowserContext, send Target.createTarget
                console.log('\n📤 Sending Target.createTarget...');
                ws.send(JSON.stringify({
                    id: messageId++,
                    method: 'Target.createTarget',
                    params: {
                        url: 'about:blank',
                        browserContextId: message.result.browserContextId
                    }
                }));
            } else if (message.id === 5) {
                // After Target.createTarget, send Browser.getWindowForTarget
                console.log('\n📤 Sending Browser.getWindowForTarget...');
                ws.send(JSON.stringify({
                    id: messageId++,
                    method: 'Browser.getWindowForTarget',
                    params: {}
                }));
            } else if (message.id === 6) {
                // After Browser.getWindowForTarget - this is where Playwright fails
                console.log('\n✅ All commands completed successfully!');
                console.log('🎉 No assertion error in direct CDP test!');
                
                // Test a few more commands that might be causing issues
                console.log('\n📤 Testing additional commands...');
                
                // Send Page.enable
                ws.send(JSON.stringify({
                    id: messageId++,
                    method: 'Page.enable',
                    params: {}
                }));
            } else if (message.id === 7) {
                // Send Runtime.enable
                ws.send(JSON.stringify({
                    id: messageId++,
                    method: 'Runtime.enable',
                    params: {}
                }));
            } else if (message.id === 8) {
                console.log('\n✅ Additional commands also successful!');
                console.log('📋 Summary: Direct CDP commands work fine');
                console.log('⚠️  The issue might be in Playwright\'s event handling or session management');
                
                setTimeout(() => {
                    ws.close();
                }, 1000);
            }
            
            // Handle events
            if (message.method) {
                console.log(`📡 Event received: ${message.method}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to parse message:', error);
            console.error('Raw message:', data.toString());
        }
    });
    
    ws.on('close', () => {
        console.log('\n🔌 WebSocket disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('🚫 WebSocket error:', error);
    });
}

debugConnection();