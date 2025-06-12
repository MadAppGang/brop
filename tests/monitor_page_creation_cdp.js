#!/usr/bin/env node
/**
 * Monitor Page Creation CDP Calls
 * 
 * Connect directly to CDP server and monitor what methods are called
 * when Playwright tries to create a page.
 */

const WebSocket = require('ws');
const { chromium } = require('playwright');

let cdpMessages = [];
let messageCount = 0;

async function monitorCdpCalls() {
    console.log('🔍 Monitor CDP Calls During Page Creation');
    console.log('=' + '='.repeat(60));
    
    // Connect to CDP server to monitor messages
    const cdpWs = new WebSocket('ws://localhost:9222');
    
    cdpWs.on('open', () => {
        console.log('📡 CDP monitor connected');
    });
    
    cdpWs.on('message', (data) => {
        messageCount++;
        try {
            const parsed = JSON.parse(data.toString());
            cdpMessages.push({
                count: messageCount,
                message: parsed,
                timestamp: Date.now(),
                type: parsed.method ? 'event' : 'response'
            });
            
            console.log(`📥 CDP ${messageCount}: ${parsed.method || `Response(${parsed.id})`}`);
            
        } catch (error) {
            console.log(`❌ Parse error: ${error.message}`);
        }
    });
    
    cdpWs.on('error', (error) => {
        console.log(`❌ CDP monitor error: ${error.message}`);
    });
    
    // Give CDP monitor time to connect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n🎭 Starting Playwright page creation...');
    
    try {
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        console.log('🎯 Attempting page creation (watch CDP calls above)...');
        const page = await context.newPage();
        console.log('🎉 Page created successfully!');
        
        await page.close();
        await context.close();
        await browser.close();
        
    } catch (error) {
        console.log(`❌ Playwright failed: ${error.message}`);
    }
    
    cdpWs.close();
    
    // Analyze the CDP calls
    console.log('\n📊 CDP Call Analysis:');
    console.log(`Total messages: ${cdpMessages.length}`);
    
    const methods = cdpMessages
        .filter(m => m.message.method)
        .map(m => m.message.method);
    
    const responses = cdpMessages
        .filter(m => m.message.id && !m.message.method)
        .map(m => ({ id: m.message.id, success: !!m.message.result }));
    
    console.log('\nMethods called:');
    methods.forEach((method, index) => {
        console.log(`  ${index + 1}. ${method}`);
    });
    
    console.log('\nResponses:');
    responses.forEach((resp, index) => {
        console.log(`  ${index + 1}. ID ${resp.id}: ${resp.success ? 'SUCCESS' : 'ERROR'}`);
    });
    
    const failedResponses = responses.filter(r => !r.success);
    if (failedResponses.length > 0) {
        console.log('\n🚨 Failed responses detected:');
        failedResponses.forEach(resp => {
            const msg = cdpMessages.find(m => m.message.id === resp.id);
            if (msg) {
                console.log(`  ID ${resp.id}: ${JSON.stringify(msg.message.error)}`);
            }
        });
    }
}

async function main() {
    console.log('🎯 Monitor Page Creation CDP');
    console.log('=' + '='.repeat(70));
    console.log('Goal: See what CDP methods fail during page creation');
    console.log('');
    
    await monitorCdpCalls();
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Check which CDP methods are missing or failing');
    console.log('2. Implement missing methods in extension');
    console.log('3. Fix any error responses');
}

main();