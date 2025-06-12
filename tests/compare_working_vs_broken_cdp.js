#!/usr/bin/env node
/**
 * Compare Working vs Broken CDP
 * 
 * Compare Playwright with real Chrome (working) vs BROP (broken)
 * to find exactly what's different.
 */

const { chromium } = require('playwright');

async function testWorkingPlaywright() {
    console.log('🔍 Test Working Playwright (Real Chrome)');
    console.log('=' + '='.repeat(60));
    
    try {
        // Launch real Chrome - this should work
        const browser = await chromium.launch({ headless: true });
        console.log('✅ Real Chrome launched');
        
        const context = await browser.newContext();
        console.log('✅ Real Chrome context created');
        console.log('   Context type:', typeof context);
        console.log('   Context pages:', context.pages().length);
        
        // This should work with real Chrome
        const page = await context.newPage();
        console.log('✅ Real Chrome newPage() SUCCESS!');
        console.log('   Page type:', typeof page);
        console.log('   Page URL:', await page.url());
        
        // Test navigation
        await page.goto('data:text/html,<h1>Working Chrome Test</h1>');
        console.log('✅ Navigation works');
        
        const title = await page.evaluate(() => document.querySelector('h1').textContent);
        console.log('✅ JavaScript evaluation works:', title);
        
        await page.close();
        await context.close();
        await browser.close();
        
        return true;
        
    } catch (error) {
        console.log('❌ Real Chrome failed:', error.message);
        console.log('Stack:', error.stack);
        return false;
    }
}

async function testBrokenPlaywright() {
    console.log('\n🔍 Test Broken Playwright (BROP)');
    console.log('=' + '='.repeat(60));
    
    try {
        // Connect to BROP - this connection works
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ BROP connection established');
        
        const context = await browser.newContext();
        console.log('✅ BROP context created');
        console.log('   Context type:', typeof context);
        console.log('   Context pages:', context.pages().length);
        
        // This fails with BROP
        console.log('🎯 Attempting newPage() with BROP...');
        const page = await context.newPage();
        console.log('✅ BROP newPage() SUCCESS! (unexpected)');
        
        await page.close();
        await context.close();
        await browser.close();
        
        return true;
        
    } catch (error) {
        console.log('❌ BROP newPage() failed:', error.message);
        
        // Get more details about the error
        if (error.message.includes('_page')) {
            console.log('🔍 This is the _page property error we need to fix');
        }
        
        try {
            // Try to still clean up
            const browser2 = await chromium.connectOverCDP('ws://localhost:9222');
            const context2 = await browser2.newContext();
            await context2.close();
            await browser2.close();
        } catch (cleanupError) {
            console.log('⚠️  Cleanup failed:', cleanupError.message);
        }
        
        return false;
    }
}

async function analyzeTheoryBehindFailure() {
    console.log('\n🔍 Analyze Theory Behind Failure');
    console.log('=' + '='.repeat(60));
    
    console.log('💡 Working Theory:');
    console.log('1. Real Chrome CDP sends events/responses that initialize internal state');
    console.log('2. BROP missing these critical events/responses');
    console.log('3. Playwright creates objects but they\'re not fully initialized');
    console.log('4. When newPage() tries to access ._page property, it\'s undefined');
    console.log('');
    
    console.log('🔍 Key Differences:');
    console.log('Real Chrome:');
    console.log('  - Sends Target.targetCreated events automatically');
    console.log('  - Sends Runtime.executionContextCreated events');
    console.log('  - Sends Page.frameNavigated events');
    console.log('  - Has proper session management');
    console.log('');
    console.log('BROP:');
    console.log('  - Only responds to explicit commands');
    console.log('  - No automatic event generation');
    console.log('  - May have session routing issues');
    console.log('  - Frame objects not properly linked to pages');
    console.log('');
    
    console.log('🎯 Likely Root Cause:');
    console.log('Playwright expects automatic events when targets are created,');
    console.log('but BROP only sends responses to explicit commands.');
    console.log('The Frame objects get created but never get their ._page property set');
    console.log('because the initialization sequence is incomplete.');
    console.log('');
    
    console.log('🔧 Potential Solutions:');
    console.log('1. Add automatic event broadcasting when targets are created');
    console.log('2. Ensure Target.targetCreated events are sent');
    console.log('3. Send Runtime.executionContextCreated events');
    console.log('4. Fix session management to match Chrome\'s behavior');
    console.log('5. Restore event broadcasting but fix session routing');
}

async function main() {
    console.log('🎯 Compare Working vs Broken CDP');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find exactly why BROP newPage() fails vs real Chrome');
    console.log('');
    
    const realChromeWorks = await testWorkingPlaywright();
    const bropWorks = await testBrokenPlaywright();
    
    console.log('\n📊 Results Summary:');
    console.log('=' + '='.repeat(50));
    console.log(`Real Chrome newPage(): ${realChromeWorks ? '✅ WORKS' : '❌ FAILS'}`);
    console.log(`BROP newPage(): ${bropWorks ? '✅ WORKS' : '❌ FAILS'}`);
    
    if (realChromeWorks && !bropWorks) {
        await analyzeTheoryBehindFailure();
        
        console.log('\n🔧 Next Steps:');
        console.log('1. Re-enable event broadcasting in bridge server');
        console.log('2. Fix session routing to prevent assertion errors');
        console.log('3. Ensure Target.targetCreated events are sent automatically');
        console.log('4. Add Runtime.executionContextCreated events');
    } else if (bropWorks) {
        console.log('\n🎉 BROP is now working! The issue has been resolved.');
    } else {
        console.log('\n❌ Both systems failing - broader Playwright setup issue');
    }
}

main();