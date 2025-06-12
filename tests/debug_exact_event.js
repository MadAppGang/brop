#!/usr/bin/env node
/**
 * Debug Exact Event
 * 
 * Capture the exact Target.attachedToTarget event structure
 */

const WebSocket = require('ws');
const { chromium } = require('playwright');

async function debugExactEvent() {
    console.log('🔍 Debug Exact Event Structure');
    console.log('=' + '='.repeat(60));
    
    const monitorWs = new WebSocket('ws://localhost:9222');
    
    monitorWs.on('open', () => {
        console.log('📡 Monitor connected');
    });
    
    monitorWs.on('message', (data) => {
        try {
            const parsed = JSON.parse(data.toString());
            
            // Show Target.attachedToTarget events in detail
            if (parsed.method === 'Target.attachedToTarget') {
                console.log('\n🚨 TARGET.ATTACHEDTOTARGET EVENT:');
                console.log('Full JSON:', JSON.stringify(parsed, null, 2));
                
                // Check for problematic fields
                if (parsed.id !== undefined) {
                    console.log('🚨 PROBLEM: Event has id field:', parsed.id);
                }
                
                if (!parsed.method) {
                    console.log('🚨 PROBLEM: Event missing method field');
                }
                
                if (!parsed.params) {
                    console.log('🚨 PROBLEM: Event missing params field');
                } else {
                    console.log('✅ Event has params:', Object.keys(parsed.params));
                }
            }
            
            // Also check for any message with both method and id
            if (parsed.method && parsed.id !== undefined) {
                console.log('\n🚨 EVENT WITH ID FIELD (ASSERTION CAUSE):');
                console.log('Method:', parsed.method);
                console.log('ID:', parsed.id);
                console.log('Full message:', JSON.stringify(parsed));
            }
            
        } catch (error) {
            console.log(`❌ Parse error: ${error.message}`);
        }
    });
    
    // Give monitor time to connect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n🎭 Triggering Target.attachedToTarget event...');
    
    try {
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        const context = await browser.newContext();
        
        console.log('🎯 Calling newPage() to trigger attachment...');
        const page = await context.newPage();
        console.log('✅ Success!');
        
        await page.close();
        await context.close();
        await browser.close();
        
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
    }
    
    monitorWs.close();
}

async function main() {
    await debugExactEvent();
}

main();