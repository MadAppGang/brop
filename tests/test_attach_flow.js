#!/usr/bin/env node
/**
 * Test Attach Flow
 * 
 * Test the exact flow Playwright uses to attach to targets
 */

const WebSocket = require('ws');
const { chromium } = require('playwright');

async function testAttachFlow() {
    console.log('🔍 Test Target Attach Flow');
    console.log('=' + '='.repeat(60));
    
    const monitorWs = new WebSocket('ws://localhost:9222');
    const commands = [];
    const events = [];
    
    monitorWs.on('open', () => {
        console.log('📡 Monitor connected');
    });
    
    monitorWs.on('message', (data) => {
        try {
            const parsed = JSON.parse(data.toString());
            
            if (parsed.method) {
                events.push(parsed);
                console.log(`📥 EVENT: ${parsed.method}`);
            } else if (parsed.id) {
                commands.push(parsed);
                console.log(`📥 RESPONSE: ID ${parsed.id} - ${parsed.result ? 'SUCCESS' : 'ERROR'}`);
                
                // Check for Target.attachToTarget responses
                if (parsed.result && parsed.result.sessionId) {
                    console.log(`🎯 ATTACH RESPONSE: sessionId = ${parsed.result.sessionId}`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Parse error: ${error.message}`);
        }
    });
    
    // Give monitor time to connect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n🎭 Testing Playwright attach flow...');
    
    try {
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        console.log('🎯 Attempting newPage() - should trigger Target.attachToTarget...');
        const page = await context.newPage();
        console.log('🎉 newPage() succeeded!');
        
        await page.close();
        await context.close();
        await browser.close();
        
    } catch (error) {
        console.log(`❌ Playwright failed: ${error.message}`);
    }
    
    monitorWs.close();
    
    console.log('\n📊 Analysis:');
    console.log(`Events received: ${events.length}`);
    console.log(`Command responses: ${commands.length}`);
    
    // Look for attach-related commands
    const attachCommands = commands.filter(cmd => 
        cmd.result && cmd.result.sessionId
    );
    
    if (attachCommands.length > 0) {
        console.log('\n🎯 Attach commands found:');
        attachCommands.forEach(cmd => {
            console.log(`  sessionId: ${cmd.result.sessionId}`);
        });
    } else {
        console.log('\n⚠️ No Target.attachToTarget calls detected');
        console.log('This might be why newPage() fails - no session attachment');
    }
}

async function main() {
    await testAttachFlow();
}

main();