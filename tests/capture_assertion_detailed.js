#!/usr/bin/env node
/**
 * Capture Assertion Detailed
 * 
 * Show full message content to find exactly what has id fields
 */

const WebSocket = require('ws');
const { chromium } = require('playwright');

async function captureDetailed() {
    console.log('🔍 Capture Detailed Messages');
    console.log('=' + '='.repeat(60));
    
    const monitorWs = new WebSocket('ws://localhost:9222');
    const problematicMessages = [];
    
    monitorWs.on('open', () => {
        console.log('📡 Monitor connected');
    });
    
    monitorWs.on('message', (data) => {
        try {
            const parsed = JSON.parse(data.toString());
            
            // Show every message with full details
            console.log(`\n📥 ${parsed.method || `Response(${parsed.id})`}:`);
            console.log(`   Full: ${JSON.stringify(parsed)}`);
            
            // Check for assertion-causing patterns
            if (parsed.id !== undefined && parsed.method !== undefined) {
                console.log(`🚨 ASSERTION CAUSE: Event with ID!`);
                console.log(`   Method: ${parsed.method}, ID: ${parsed.id}`);
                problematicMessages.push({
                    type: 'event_with_id',
                    message: parsed
                });
            }
            
            if (parsed.id !== undefined && !parsed.result && !parsed.error && !parsed.method) {
                console.log(`🚨 MALFORMED: ID without result/error/method!`);
                problematicMessages.push({
                    type: 'malformed_response',
                    message: parsed
                });
            }
            
        } catch (error) {
            console.log(`❌ Parse error: ${error.message}`);
        }
    });
    
    // Small test - just connect and try newPage
    setTimeout(async () => {
        try {
            console.log('\n🎭 Quick Playwright test...');
            const browser = await chromium.connectOverCDP('ws://localhost:9222');
            const context = await browser.newContext();
            
            console.log('🎯 Calling newPage()...');
            const page = await context.newPage();
            console.log('✅ Success!');
            
            await page.close();
            await context.close();
            await browser.close();
            
        } catch (error) {
            console.log(`❌ Failed: ${error.message}`);
            
            setTimeout(() => {
                console.log('\n📊 Problematic Messages Found:');
                problematicMessages.forEach((pm, i) => {
                    console.log(`${i+1}. ${pm.type}: ${JSON.stringify(pm.message)}`);
                });
                
                monitorWs.close();
            }, 1000);
            return;
        }
        
        setTimeout(() => {
            monitorWs.close();
        }, 1000);
        
    }, 2000);
    
    await new Promise(resolve => {
        monitorWs.on('close', resolve);
    });
}

async function main() {
    await captureDetailed();
}

main();