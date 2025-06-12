#!/usr/bin/env node
/**
 * Debug All Messages
 * 
 * Capture ALL messages around the time of assertion error
 */

const WebSocket = require('ws');
const { chromium } = require('playwright');

async function debugAllMessages() {
    console.log('🔍 Debug All Messages Around Assertion Error');
    console.log('=' + '='.repeat(60));
    
    const monitorWs = new WebSocket('ws://localhost:9222');
    const messages = [];
    
    monitorWs.on('open', () => {
        console.log('📡 Monitor connected');
    });
    
    monitorWs.on('message', (data) => {
        try {
            const parsed = JSON.parse(data.toString());
            const timestamp = Date.now();
            messages.push({ timestamp, message: parsed });
            
            console.log(`📥 ${new Date().toISOString()}: ${parsed.method || `Response(${parsed.id})`}`);
            
            // Check for any problematic messages
            if (parsed.id !== undefined && parsed.method !== undefined) {
                console.log(`🚨 EVENT WITH ID: ${parsed.method} (id: ${parsed.id})`);
            }
            
            if (parsed.id !== undefined && !parsed.method && !parsed.result && !parsed.error) {
                console.log(`🚨 MALFORMED RESPONSE: ID ${parsed.id} with no result/error`);
            }
            
        } catch (error) {
            console.log(`❌ Parse error: ${error.message}`);
        }
    });
    
    // Give monitor time to connect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n🎭 Starting Playwright test...');
    
    try {
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        const context = await browser.newContext();
        
        console.log('🎯 About to call newPage()...');
        const page = await context.newPage();
        console.log('✅ Success!');
        
        await page.close();
        await context.close();
        await browser.close();
        
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        
        // Show messages around the failure
        console.log('\n📊 Messages captured:');
        messages.slice(-10).forEach((msg, i) => {
            const msgStr = JSON.stringify(msg.message);
            console.log(`${i+1}. ${msgStr.substring(0, 100)}...`);
            
            if (msg.message.id !== undefined && msg.message.method !== undefined) {
                console.log(`   🚨 This message has both method and id - ASSERTION CAUSE!`);
            }
        });
    }
    
    monitorWs.close();
}

async function main() {
    await debugAllMessages();
}

main();