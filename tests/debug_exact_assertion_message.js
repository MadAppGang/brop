#!/usr/bin/env node
/**
 * Debug Exact Assertion Message
 * 
 * Patch Playwright's assertion function to capture the exact message
 * that causes the assertion error.
 */

const WebSocket = require('ws');

async function interceptAssertionMessage() {
    console.log('🔍 Intercept Assertion Message');
    console.log('=' + '='.repeat(60));
    
    // Connect directly to our CDP server and monitor all messages
    const ws = new WebSocket('ws://localhost:9222');
    let messageCount = 0;
    const messages = [];
    
    ws.on('open', () => {
        console.log('📡 Connected to CDP server');
        console.log('🎯 Starting message monitoring...');
        
        // Send some basic commands to trigger the assertion
        const commands = [
            { id: 1, method: 'Browser.getVersion', params: {} },
            { id: 2, method: 'Target.createTarget', params: { url: 'about:blank' } }
        ];
        
        commands.forEach((cmd, index) => {
            setTimeout(() => {
                console.log(`📤 Sending: ${cmd.method} (id: ${cmd.id})`);
                ws.send(JSON.stringify(cmd));
            }, index * 1000);
        });
    });
    
    ws.on('message', (data) => {
        messageCount++;
        try {
            const parsed = JSON.parse(data.toString());
            messages.push({ count: messageCount, message: parsed, timestamp: Date.now() });
            
            console.log(`📥 Message ${messageCount}:`);
            console.log(`   Type: ${parsed.method ? 'Event' : 'Response'}`);
            console.log(`   Content: ${JSON.stringify(parsed)}`);
            
            // Check for potentially problematic messages
            if (parsed.id !== undefined) {
                console.log(`   🎯 HAS ID: ${parsed.id}`);
                
                if (!parsed.result && !parsed.error) {
                    console.log(`   🚨 SUSPICIOUS: Has ID but no result/error!`);
                }
                
                if (parsed.method) {
                    console.log(`   🚨 PROBLEMATIC: Event with ID field! This WILL cause assertion error!`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Parse error: ${error.message}`);
        }
    });
    
    ws.on('close', () => {
        console.log('\n📊 Message Analysis Complete');
        
        const eventsWithId = messages.filter(m => m.message.id !== undefined && m.message.method !== undefined);
        const responsesWithoutResult = messages.filter(m => 
            m.message.id !== undefined && 
            m.message.method === undefined && 
            !m.message.result && 
            !m.message.error
        );
        
        console.log(`Total messages: ${messages.length}`);
        console.log(`Events with ID (WILL cause assertion): ${eventsWithId.length}`);
        console.log(`Responses without result/error: ${responsesWithoutResult.length}`);
        
        if (eventsWithId.length > 0) {
            console.log('\n🚨 FOUND ASSERTION CAUSE: Events with ID fields:');
            eventsWithId.forEach(msg => {
                console.log(`   ${msg.count}. ${msg.message.method} (id: ${msg.message.id})`);
            });
        }
        
        if (responsesWithoutResult.length > 0) {
            console.log('\n🚨 SUSPICIOUS: Responses without result/error:');
            responsesWithoutResult.forEach(msg => {
                console.log(`   ${msg.count}. ID ${msg.message.id}: ${JSON.stringify(msg.message)}`);
            });
        }
    });
    
    ws.on('error', (error) => {
        console.log(`❌ Connection error: ${error.message}`);
    });
    
    // Close after 5 seconds
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    }, 5000);
}

async function main() {
    console.log('🎯 Debug Exact Assertion Message');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find the exact message causing assert(!object.id) to fail');
    console.log('');
    
    await interceptAssertionMessage();
    
    console.log('\n🔧 Next Steps:');
    console.log('1. If events have ID fields: Fix event structure in bridge');
    console.log('2. If responses are malformed: Fix response generation');
    console.log('3. If timing issues: Investigate callback management');
}

main();