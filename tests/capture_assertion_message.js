#!/usr/bin/env node
/**
 * Capture Assertion Message
 * 
 * Monitor CDP messages to capture the exact message that causes
 * the assertion error.
 */

const WebSocket = require('ws');
const { chromium } = require('playwright');

async function captureAssertionMessage() {
    console.log('🔍 Capture Assertion Message');
    console.log('=' + '='.repeat(60));
    
    // Connect as a monitor to see all messages
    const monitorWs = new WebSocket('ws://localhost:9222');
    const messages = [];
    
    monitorWs.on('open', () => {
        console.log('📡 Monitor connected to CDP server');
    });
    
    monitorWs.on('message', (data) => {
        try {
            const parsed = JSON.parse(data.toString());
            messages.push({ timestamp: Date.now(), message: parsed });
            
            console.log(`📥 Message: ${parsed.method || `Response(${parsed.id})`}`);
            
            // Check for problematic messages
            if (parsed.id !== undefined && !parsed.result && !parsed.error) {
                console.log(`🚨 SUSPICIOUS: Message has ID but no result/error!`);
                console.log(`   Full message: ${JSON.stringify(parsed)}`);
            }
            
            if (parsed.method && parsed.id !== undefined) {
                console.log(`🚨 ASSERTION CAUSE: Event with ID field!`);
                console.log(`   Method: ${parsed.method}, ID: ${parsed.id}`);
                console.log(`   Full message: ${JSON.stringify(parsed)}`);
            }
            
        } catch (error) {
            console.log(`❌ Parse error: ${error.message}`);
        }
    });
    
    monitorWs.on('error', (error) => {
        console.log(`❌ Monitor error: ${error.message}`);
    });
    
    // Give monitor time to connect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n🎭 Starting Playwright test...');
    
    try {
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        console.log('🎯 Attempting newPage() - watch for assertion error...');
        const page = await context.newPage();
        console.log('🎉 newPage() succeeded!');
        
        await page.close();
        await context.close();
        await browser.close();
        
    } catch (error) {
        console.log(`❌ Playwright failed: ${error.message}`);
        
        if (error.message.includes('Assertion error')) {
            console.log('\n📊 Analyzing captured messages...');
            
            const eventsWithId = messages.filter(m => 
                m.message.method && m.message.id !== undefined
            );
            
            const badResponses = messages.filter(m => 
                m.message.id !== undefined && 
                !m.message.method &&
                !m.message.result &&
                !m.message.error
            );
            
            console.log(`Found ${eventsWithId.length} events with ID fields (assertion causes)`);
            console.log(`Found ${badResponses.length} malformed responses`);
            
            if (eventsWithId.length > 0) {
                console.log('\n🚨 Events with ID fields (will cause assertion):');
                eventsWithId.forEach((msg, i) => {
                    console.log(`  ${i+1}. ${msg.message.method} (id: ${msg.message.id})`);
                });
            }
            
            if (badResponses.length > 0) {
                console.log('\n🚨 Malformed responses:');
                badResponses.forEach((msg, i) => {
                    console.log(`  ${i+1}. ID ${msg.message.id}: ${JSON.stringify(msg.message)}`);
                });
            }
        }
    }
    
    monitorWs.close();
}

async function main() {
    console.log('🎯 Capture Assertion Message');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find the exact message causing assert(!object.id) to fail');
    console.log('');
    
    await captureAssertionMessage();
    
    console.log('\n🔧 Analysis:');
    console.log('The assertion fails when Playwright receives:');
    console.log('1. An event (has method) that also has an id field');
    console.log('2. A response (has id) that Playwright doesn\'t recognize');
    console.log('3. Malformed messages that confuse the session handling');
}

main();