#!/usr/bin/env node
/**
 * Debug Playwright Internals
 * 
 * Trace exactly what Playwright does and where it fails in the page creation process
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

async function interceptAllTraffic() {
    const messages = [];
    
    // Intercept WebSocket traffic
    const originalWebSocket = global.WebSocket;
    global.WebSocket = class extends originalWebSocket {
        constructor(url, protocols) {
            console.log(`🔌 New WebSocket connection to: ${url}`);
            super(url, protocols);
            
            const originalSend = this.send;
            this.send = function(data) {
                console.log(`📤 WS SEND: ${data}`);
                messages.push({ direction: 'send', data: data.toString(), timestamp: Date.now() });
                return originalSend.call(this, data);
            };
            
            this.addEventListener('message', (event) => {
                console.log(`📥 WS RECV: ${event.data}`);
                messages.push({ direction: 'recv', data: event.data.toString(), timestamp: Date.now() });
            });
        }
    };
    
    return messages;
}

async function debugPlaywrightInternals() {
    console.log('🔍 DEBUGGING PLAYWRIGHT INTERNALS');
    console.log('=' + '='.repeat(70));
    
    const messages = await interceptAllTraffic();
    
    try {
        console.log('\n1️⃣ Connecting to BROP...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        console.log('\n2️⃣ Creating context...');
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        // Detailed inspection of context before page creation
        console.log('\n3️⃣ Context inspection (DETAILED):');
        console.log('Context type:', typeof context);
        console.log('Context constructor:', context.constructor.name);
        console.log('Context._page:', context._page);
        console.log('Context._pages:', context._pages);
        
        // Check internal connection state
        if (context._connection) {
            console.log('Connection exists:', true);
            console.log('Connection type:', context._connection.constructor.name);
            console.log('Connection._url:', context._connection._url);
            console.log('Connection._transport exists:', !!context._connection._transport);
            
            if (context._connection._transport) {
                console.log('Transport type:', context._connection._transport.constructor.name);
                console.log('Transport readyState:', context._connection._transport.readyState);
            } else {
                console.log('❌ NO TRANSPORT in connection');
            }
            
            // Check if connection has _onMessage handler
            console.log('Connection has _onMessage:', typeof context._connection._onMessage);
            console.log('Connection has _sessions:', !!context._connection._sessions);
            
            if (context._connection._sessions) {
                console.log('Active sessions:', Object.keys(context._connection._sessions));
            }
        }
        
        // Check browser connection
        if (context._browser && context._browser._connection) {
            console.log('Browser connection exists:', true);
            console.log('Browser connection type:', context._browser._connection.constructor.name);
            console.log('Browser connection has transport:', !!context._browser._connection._transport);
        }
        
        console.log('\n4️⃣ Attempting page creation with error catching...');
        
        try {
            // Add event listeners to catch any internal events
            context.on('page', (page) => {
                console.log('🎉 Context page event fired!');
            });
            
            // Try to catch any errors during the process
            const pagePromise = context.newPage();
            console.log('📋 newPage() called, waiting for result...');
            
            const page = await pagePromise;
            console.log('🎉 SUCCESS! Page created:', page.constructor.name);
            
            await page.close();
            
        } catch (error) {
            console.log('\n❌ PAGE CREATION FAILED');
            console.log('Error message:', error.message);
            console.log('Error stack:');
            console.log(error.stack);
            
            // Check context state after error
            console.log('\n5️⃣ Context state after error:');
            console.log('Context._pages:', context._pages);
            console.log('Context._page:', context._page);
            
            if (context._connection) {
                console.log('Connection still exists:', true);
                console.log('Transport still missing:', !context._connection._transport);
                
                if (context._connection._sessions) {
                    console.log('Sessions after error:', Object.keys(context._connection._sessions));
                }
            }
        }
        
        await context.close();
        await browser.close();
        
    } catch (error) {
        console.log('💥 Critical error:', error.message);
        console.log(error.stack);
    }
    
    console.log('\n📊 CAPTURED WEBSOCKET TRAFFIC:');
    console.log('=' + '='.repeat(50));
    messages.forEach((msg, index) => {
        console.log(`${index + 1}. [${msg.direction.toUpperCase()}] ${msg.data}`);
    });
    
    console.log('\n💡 ANALYSIS:');
    const sendMessages = messages.filter(m => m.direction === 'send');
    const recvMessages = messages.filter(m => m.direction === 'recv');
    
    console.log(`Total messages sent: ${sendMessages.length}`);
    console.log(`Total messages received: ${recvMessages.length}`);
    
    const targetCreateSent = sendMessages.find(m => m.data.includes('Target.createTarget'));
    const targetAttachSent = sendMessages.find(m => m.data.includes('Target.attachToTarget'));
    const targetCreatedRecv = recvMessages.find(m => m.data.includes('Target.targetCreated'));
    const targetAttachedRecv = recvMessages.find(m => m.data.includes('Target.attachedToTarget'));
    
    console.log('Target.createTarget sent:', !!targetCreateSent);
    console.log('Target.attachToTarget sent:', !!targetAttachSent);
    console.log('Target.targetCreated received:', !!targetCreatedRecv);
    console.log('Target.attachedToTarget received:', !!targetAttachedRecv);
}

if (require.main === module) {
    debugPlaywrightInternals().catch(console.error);
}