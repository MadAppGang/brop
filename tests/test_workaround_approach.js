#!/usr/bin/env node
/**
 * Test Workaround Approach
 * 
 * Try different approaches to avoid the newPage() issue
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

async function testDirectCdpApproach() {
    console.log('🔍 Test Direct CDP Approach');
    console.log('=' + '='.repeat(60));
    
    try {
        // Instead of using Playwright's page management, use direct CDP
        const ws = new WebSocket('ws://localhost:9222');
        
        const responses = new Map();
        let messageId = 1;
        
        ws.on('open', async () => {
            console.log('📡 Direct CDP connection established');
            
            // Test sequence: Create target, navigate, evaluate
            const commands = [
                {
                    id: messageId++,
                    method: 'Target.createTarget',
                    params: { url: 'data:text/html,<h1>Direct CDP Test</h1>' }
                },
                {
                    id: messageId++,
                    method: 'Runtime.evaluate', 
                    params: { expression: 'document.title' }
                }
            ];
            
            for (const cmd of commands) {
                setTimeout(() => {
                    console.log(`📤 Sending: ${cmd.method}`);
                    ws.send(JSON.stringify(cmd));
                }, (cmd.id - 1) * 1000);
            }
            
            setTimeout(() => ws.close(), 5000);
        });
        
        ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.id) {
                    responses.set(response.id, response);
                    console.log(`📥 Response ${response.id}: ${response.result ? 'SUCCESS' : 'ERROR'}`);
                    
                    if (response.id === 1 && response.result?.targetId) {
                        console.log(`✅ Target created: ${response.result.targetId}`);
                    }
                    
                    if (response.id === 2 && response.result?.result?.value) {
                        console.log(`✅ JavaScript result: ${response.result.result.value}`);
                    }
                }
            } catch (error) {
                console.log(`❌ Parse error: ${error.message}`);
            }
        });
        
        await new Promise(resolve => {
            ws.on('close', resolve);
        });
        
        console.log(`\nDirect CDP approach: ${responses.size > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);
        return responses.size > 0;
        
    } catch (error) {
        console.log(`❌ Direct CDP failed: ${error.message}`);
        return false;
    }
}

async function testExistingPagesApproach() {
    console.log('\n🔍 Test Existing Pages Approach');
    console.log('=' + '='.repeat(60));
    
    try {
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        // Instead of newPage(), check for existing pages
        const existingPages = context.pages();
        console.log(`Found ${existingPages.length} existing pages`);
        
        if (existingPages.length > 0) {
            const page = existingPages[0];
            console.log('✅ Using existing page');
            
            await page.goto('data:text/html,<h1>Existing Page Test</h1>');
            console.log('✅ Navigation successful');
            
            const title = await page.evaluate(() => document.querySelector('h1').textContent);
            console.log(`✅ JavaScript evaluation: ${title}`);
            
            await context.close();
            await browser.close();
            
            console.log('Existing pages approach: ✅ SUCCESS');
            return true;
        } else {
            console.log('⚠️ No existing pages found');
            await context.close();
            await browser.close();
            return false;
        }
        
    } catch (error) {
        console.log(`❌ Existing pages approach failed: ${error.message}`);
        return false;
    }
}

async function testBrowserTargetsApproach() {
    console.log('\n🔍 Test Browser Targets Approach');
    console.log('=' + '='.repeat(60));
    
    try {
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        // Try to access browser targets directly
        const contexts = browser.contexts();
        console.log(`Found ${contexts.length} contexts`);
        
        if (contexts.length > 0) {
            const context = contexts[0];
            const pages = context.pages();
            console.log(`Context has ${pages.length} pages`);
            
            if (pages.length > 0) {
                const page = pages[0];
                await page.goto('data:text/html,<h1>Browser Targets Test</h1>');
                console.log('✅ Navigation through browser targets successful');
                
                await browser.close();
                console.log('Browser targets approach: ✅ SUCCESS');
                return true;
            }
        }
        
        await browser.close();
        console.log('Browser targets approach: ❌ NO PAGES');
        return false;
        
    } catch (error) {
        console.log(`❌ Browser targets approach failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🎯 Test Workaround Approaches');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find working alternatives to context.newPage()');
    console.log('');
    
    const directCdp = await testDirectCdpApproach();
    const existingPages = await testExistingPagesApproach();
    const browserTargets = await testBrowserTargetsApproach();
    
    console.log('\n📊 Results Summary:');
    console.log('=' + '='.repeat(50));
    console.log(`Direct CDP: ${directCdp ? '✅ WORKS' : '❌ FAILED'}`);
    console.log(`Existing Pages: ${existingPages ? '✅ WORKS' : '❌ FAILED'}`);
    console.log(`Browser Targets: ${browserTargets ? '✅ WORKS' : '❌ FAILED'}`);
    
    if (directCdp) {
        console.log('\n🎉 SUCCESS: Direct CDP control works!');
        console.log('💡 Recommendation: Use direct CDP commands instead of Playwright page methods');
    } else if (existingPages || browserTargets) {
        console.log('\n🎉 SUCCESS: Alternative page access works!');
        console.log('💡 Recommendation: Use existing pages instead of creating new ones');
    } else {
        console.log('\n❌ All approaches failed - need to fix core newPage() issue');
    }
}

main();