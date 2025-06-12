#!/usr/bin/env node
/**
 * Minimal Puppeteer Test to identify missing CDP methods
 */

const puppeteer = require('puppeteer');

async function testMinimalPuppeteer() {
    console.log('🔍 Testing minimal Puppeteer connection...');
    
    try {
        console.log('1️⃣ Attempting to connect...');
        const browser = await puppeteer.connect({
            browserWSEndpoint: 'ws://localhost:9222',
            defaultViewport: null
        });
        console.log('✅ Connected successfully');
        
        console.log('2️⃣ Attempting to get browser version...');
        const version = await browser.version();
        console.log(`✅ Browser version: ${version}`);
        
        console.log('3️⃣ Attempting to get pages...');
        const pages = await browser.pages();
        console.log(`✅ Found ${pages.length} existing pages`);
        
        console.log('4️⃣ Attempting to create new page...');
        const page = await browser.newPage();
        console.log('✅ New page created successfully!');
        
        console.log('5️⃣ Testing basic page operations...');
        await page.goto('data:text/html,<h1>Test Page</h1>');
        const title = await page.title();
        console.log(`✅ Page title: ${title}`);
        
        await page.close();
        await browser.disconnect();
        
        console.log('🎉 All tests passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack.split('\n')[1]);
        return false;
    }
}

if (require.main === module) {
    testMinimalPuppeteer().catch(console.error);
}