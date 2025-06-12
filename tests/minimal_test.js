#!/usr/bin/env node
/**
 * Minimal test to debug Playwright CDP assertion error
 */

const { chromium } = require('playwright');

async function minimalTest() {
    console.log('🔍 Minimal Playwright CDP Debug Test');
    console.log('=' + '='.repeat(50));
    
    try {
        console.log('📋 Step 1: Connecting to CDP...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Connected successfully');
        
        console.log('📋 Step 2: Getting browser version...');
        // This should work fine
        
        console.log('📋 Step 3: Creating new context...');
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        console.log('📋 Step 4: Creating new page...');
        const page = await context.newPage();
        console.log('✅ Page created');
        
        console.log('📋 Step 5: Getting page title...');
        const title = await page.title();
        console.log(`✅ Page title: "${title}"`);
        
        await page.close();
        await context.close();
        await browser.close();
        
        console.log('✅ Minimal test completed successfully!');
        
    } catch (error) {
        console.error('❌ Minimal test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

minimalTest();