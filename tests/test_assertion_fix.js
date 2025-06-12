#!/usr/bin/env node
/**
 * Test Assertion Fix
 * 
 * Verify that the separate endpoints architecture resolves the 
 * Playwright assertion error (crConnection.js:134)
 */

const { chromium } = require('playwright');

async function testPlaywrightAssertionFix() {
    console.log('🔍 Test Playwright Assertion Fix');
    console.log('=' + '='.repeat(60));
    
    try {
        console.log('🎭 Connecting Playwright to BROP...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected successfully');
        
        console.log('📝 Creating browser context...');
        const context = await browser.newContext();
        console.log('✅ Context created successfully');
        
        console.log('🎯 Attempting newPage() (this was failing before)...');
        try {
            const page = await context.newPage();
            console.log('🎉 newPage() succeeded! Assertion issue is resolved!');
            
            console.log('🧪 Testing basic page operations...');
            
            // Test navigation
            console.log('📡 Testing navigation...');
            await page.goto('data:text/html,<h1>Assertion Fix Test</h1><p>Success!</p>');
            console.log('✅ Navigation completed');
            
            // Test basic page info (these don't require script execution)
            const title = await page.title();
            console.log(`✅ Page title: "${title}"`);
            
            const url = page.url();
            console.log(`✅ Page URL: ${url.substring(0, 50)}...`);
            
            // Clean up
            await page.close();
            console.log('✅ Page closed');
            
            await context.close();
            console.log('✅ Context closed');
            
            await browser.close();
            console.log('✅ Browser closed');
            
            return { success: true, error: null };
            
        } catch (pageError) {
            console.log(`❌ newPage() still failing: ${pageError.message}`);
            
            // Clean up on error
            try { await context.close(); } catch (e) {}
            try { await browser.close(); } catch (e) {}
            
            return { success: false, error: pageError.message };
        }
        
    } catch (error) {
        console.log(`❌ Playwright connection failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testDirectCdpStillWorks() {
    console.log('\n🔍 Verify Direct CDP Still Works');
    console.log('=' + '='.repeat(60));
    
    try {
        const WebSocket = require('ws');
        const ws = new WebSocket('ws://localhost:9222');
        
        let success = false;
        
        await new Promise((resolve, reject) => {
            ws.on('open', () => {
                console.log('✅ Direct CDP connection established');
                
                // Test target creation
                ws.send(JSON.stringify({
                    id: 1,
                    method: 'Target.createTarget',
                    params: { url: 'data:text/html,<h1>Direct CDP Test</h1>' }
                }));
            });
            
            ws.on('message', (data) => {
                const response = JSON.parse(data.toString());
                
                if (response.id === 1 && response.result?.targetId) {
                    console.log(`✅ Direct CDP target creation: ${response.result.targetId}`);
                    success = true;
                    ws.close();
                }
            });
            
            ws.on('close', () => resolve());
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Timeout')), 5000);
        });
        
        return success;
        
    } catch (error) {
        console.log(`❌ Direct CDP failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🎯 Test Assertion Fix');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Verify that separate endpoints solve the assertion issue');
    console.log('');
    
    const playwrightResult = await testPlaywrightAssertionFix();
    const directCdpResult = await testDirectCdpStillWorks();
    
    console.log('\n📊 Final Results:');
    console.log('=' + '='.repeat(50));
    console.log(`Playwright newPage(): ${playwrightResult.success ? '✅ WORKS' : '❌ FAILED'}`);
    console.log(`Direct CDP: ${directCdpResult ? '✅ WORKS' : '❌ FAILED'}`);
    
    if (playwrightResult.success) {
        console.log('\n🎉 SUCCESS: Separate endpoints architecture solved the assertion issue!');
        console.log('✅ Playwright can now use newPage() without crConnection.js:134 assertion error');
        console.log('✅ BROP now properly mimics real Chrome CDP behavior');
        console.log('✅ Each page gets its own WebSocket endpoint');
    } else {
        console.log('\n🔍 ANALYSIS: Assertion issue still present');
        console.log(`❌ Error: ${playwrightResult.error}`);
        
        if (playwrightResult.error?.includes('_page')) {
            console.log('💡 This is still the internal Playwright state issue');
        } else if (playwrightResult.error?.includes('assert')) {
            console.log('💡 This is still the CDP assertion error');
        }
    }
    
    return playwrightResult.success;
}

main();