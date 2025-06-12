#!/usr/bin/env node
/**
 * Test Alternative Page Creation
 * 
 * Since newPage() fails with internal Playwright state issues,
 * let's try different approaches to get a working page.
 */

const { chromium } = require('playwright');

async function testAlternativeApproaches() {
    console.log('🔍 Test Alternative Page Creation Approaches');
    console.log('=' + '='.repeat(60));
    
    try {
        console.log('🎭 Setting up browser connection...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        console.log('🎭 Creating context...');
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        // Approach 1: Try to use existing pages
        console.log('\n📋 Approach 1: Check existing pages');
        const existingPages = context.pages();
        console.log(`Found ${existingPages.length} existing pages`);
        
        if (existingPages.length > 0) {
            console.log('✅ Using existing page');
            const page = existingPages[0];
            console.log('Page URL:', await page.url());
            console.log('Page title:', await page.title());
            
            // Test basic operations
            await page.goto('data:text/html,<h1>Test Page</h1>');
            console.log('✅ Navigation successful');
            
            const title = await page.evaluate(() => document.querySelector('h1').textContent);
            console.log('✅ JavaScript evaluation successful:', title);
            
            await context.close();
            await browser.close();
            return true;
        }
        
        // Approach 2: Try with different context options
        console.log('\n📋 Approach 2: Try different context options');
        await context.close();
        
        const context2 = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            ignoreHTTPSErrors: true
        });
        console.log('✅ Context with options created');
        
        try {
            const page = await context2.newPage();
            console.log('🎉 newPage() worked with different context options!');
            await page.close();
        } catch (error) {
            console.log('❌ Still failed:', error.message);
        }
        
        await context2.close();
        
        // Approach 3: Try direct CDP connection to specific target
        console.log('\n📋 Approach 3: Direct target connection');
        
        // Get browser targets
        const targets = await browser.targets();
        console.log(`Found ${targets.length} targets`);
        
        for (const target of targets) {
            console.log(`Target: ${target.type()} - ${target.url()}`);
        }
        
        await browser.close();
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        console.log('Stack:', error.stack);
        return false;
    }
}

async function testDirectCdpSession() {
    console.log('\n🔍 Test Direct CDP Session');
    console.log('=' + '='.repeat(60));
    
    try {
        // Try connecting to a specific target endpoint
        const browser = await chromium.connectOverCDP('ws://localhost:9222/page/1');
        console.log('✅ Connected to specific page target');
        
        const context = await browser.newContext();
        console.log('✅ Context created for specific target');
        
        const page = await context.newPage();
        console.log('🎉 Page created for specific target!');
        
        await page.goto('data:text/html,<h1>Direct CDP Test</h1>');
        console.log('✅ Navigation successful');
        
        await page.close();
        await context.close();
        await browser.close();
        
        return true;
        
    } catch (error) {
        console.log('❌ Direct CDP failed:', error.message);
        return false;
    }
}

async function main() {
    console.log('🎯 Test Alternative Page Creation');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find working alternatives to context.newPage()');
    console.log('');
    
    const approach1 = await testAlternativeApproaches();
    const approach2 = await testDirectCdpSession();
    
    console.log('\n📊 Results Summary:');
    console.log(`Alternative approaches: ${approach1 ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Direct CDP session: ${approach2 ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (approach1 || approach2) {
        console.log('\n🎉 Found working alternative!');
        console.log('💡 Recommendation: Use existing pages or direct target connection');
    } else {
        console.log('\n🔧 All approaches failed - need to fix core page creation issue');
    }
}

main();