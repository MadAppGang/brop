#!/usr/bin/env node
/**
 * Debug Page Creation Issue
 * 
 * Focus specifically on the page creation process to understand
 * why browserContext.newPage() fails with "_page" property error.
 */

const { chromium } = require('playwright');

async function debugPageCreation() {
    console.log('🔍 Debug Page Creation Process');
    console.log('=' + '='.repeat(60));
    
    try {
        console.log('🎭 Step 1: Connect to browser...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected successfully');
        
        console.log('🎭 Step 2: Create browser context...');
        const context = await browser.newContext();
        console.log('✅ Context created successfully');
        console.log('Context type:', typeof context);
        console.log('Context constructor:', context.constructor.name);
        
        console.log('🎭 Step 3: Attempt to create page...');
        console.log('About to call context.newPage()...');
        
        try {
            const page = await context.newPage();
            console.log('🎉 Page created successfully!');
            console.log('Page type:', typeof page);
            console.log('Page constructor:', page.constructor.name);
            
            await page.close();
            console.log('✅ Page closed successfully');
            
        } catch (pageError) {
            console.log('❌ Page creation failed:');
            console.log('Error message:', pageError.message);
            console.log('Error stack:', pageError.stack);
            
            // Try to get more details about the context object
            console.log('\n🔍 Context object inspection:');
            console.log('Context keys:', Object.keys(context));
            console.log('Context._page:', context._page);
            console.log('Context._pages:', context._pages);
        }
        
        await context.close();
        console.log('✅ Context closed successfully');
        
        await browser.close();
        console.log('✅ Browser closed successfully');
        
    } catch (error) {
        console.log('❌ Process failed:', error.message);
        console.log('Error stack:', error.stack);
    }
}

async function main() {
    console.log('🎯 Debug Page Creation Issue');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Understand why context.newPage() fails with _page property error');
    console.log('');
    
    await debugPageCreation();
    
    console.log('\n🔧 Analysis:');
    console.log('If _page is undefined, it suggests:');
    console.log('1. Context initialization is incomplete');
    console.log('2. Missing CDP method implementation for page creation');
    console.log('3. Internal Playwright state management issue');
}

main();