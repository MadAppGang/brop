#!/usr/bin/env node
/**
 * Test Playwright Minimal
 * 
 * Test Playwright with minimal CDP implementation to isolate the issue
 */

const { chromium } = require('playwright');

async function testMinimalPlaywright() {
    console.log('🔍 Test Minimal Playwright');
    console.log('=' + '='.repeat(60));
    
    try {
        console.log('🎭 Step 1: Connect to browser...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        console.log('🎭 Step 2: Get browser version...');
        const version = browser.version();
        console.log(`✅ Browser version: ${version}`);
        
        console.log('🎭 Step 3: Create context...');
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        console.log('🎭 Step 4: Check context pages...');
        const pages = context.pages();
        console.log(`📄 Context has ${pages.length} existing pages`);
        
        if (pages.length > 0) {
            console.log('✅ Using existing page instead of newPage()');
            const page = pages[0];
            
            try {
                console.log('🧪 Testing page operations...');
                
                const url = page.url();
                console.log(`✅ Current URL: ${url}`);
                
                await page.goto('https://example.com');
                console.log('✅ Navigation successful');
                
                const title = await page.title();
                console.log(`✅ Page title: ${title}`);
                
                console.log('🎉 Existing page approach works!');
                
                await context.close();
                await browser.close();
                return { success: true, approach: 'existing_page' };
                
            } catch (pageError) {
                console.log(`❌ Page operations failed: ${pageError.message}`);
                await context.close();
                await browser.close();
                return { success: false, error: pageError.message };
            }
        }
        
        console.log('🎭 Step 5: Try newPage() since no existing pages...');
        try {
            const page = await context.newPage();
            console.log('🎉 newPage() worked!');
            
            await page.goto('https://example.com');
            console.log('✅ Navigation successful');
            
            await page.close();
            await context.close();
            await browser.close();
            return { success: true, approach: 'new_page' };
            
        } catch (newPageError) {
            console.log(`❌ newPage() failed: ${newPageError.message}`);
            
            await context.close();
            await browser.close();
            return { success: false, error: newPageError.message };
        }
        
    } catch (error) {
        console.log(`❌ Browser connection failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('🎯 Test Minimal Playwright');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Test Playwright with different page access approaches');
    console.log('');
    
    const result = await testMinimalPlaywright();
    
    console.log('\n📊 Result:');
    console.log('=' + '='.repeat(50));
    
    if (result.success) {
        console.log(`✅ SUCCESS using ${result.approach}`);
        
        if (result.approach === 'existing_page') {
            console.log('💡 Recommendation: Use existing pages when possible');
            console.log('💡 This avoids the newPage() internal state issue');
        } else {
            console.log('🎉 newPage() is now working correctly!');
        }
    } else {
        console.log(`❌ FAILED: ${result.error}`);
        
        if (result.error?.includes('_page')) {
            console.log('💡 This is the internal Playwright state issue');
            console.log('💡 The solution is to use existing pages or fix Target.attachedToTarget');
        }
    }
    
    return result.success;
}

main();