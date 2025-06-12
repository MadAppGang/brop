#!/usr/bin/env node
/**
 * Test Puppeteer Page Creation with timeout and detailed logging
 */

const puppeteer = require('puppeteer');

async function testPuppeteerPageCreation() {
    console.log('🔍 Testing Puppeteer page creation with timeout...');
    
    try {
        console.log('1️⃣ Connecting to BROP...');
        const browser = await puppeteer.connect({
            browserWSEndpoint: 'ws://localhost:9222',
            defaultViewport: null
        });
        console.log('✅ Connected successfully');
        
        console.log('2️⃣ Getting browser version...');
        const version = await browser.version();
        console.log(`✅ Version: ${version}`);
        
        console.log('3️⃣ Getting existing pages...');
        const pages = await browser.pages();
        console.log(`✅ Found ${pages.length} pages`);
        
        console.log('4️⃣ Attempting page creation with 10s timeout...');
        
        const pagePromise = browser.newPage();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Page creation timeout after 10 seconds')), 10000);
        });
        
        try {
            const page = await Promise.race([pagePromise, timeoutPromise]);
            console.log('🎉 Page created successfully!');
            
            console.log('5️⃣ Testing basic page operations...');
            await page.goto('data:text/html,<h1>Success!</h1>');
            const title = await page.title();
            console.log(`✅ Page title: ${title}`);
            
            await page.close();
            console.log('✅ Page closed');
            
        } catch (pageError) {
            console.log('❌ Page creation failed:', pageError.message);
            
            // Try to get more info about existing pages after failure
            try {
                const pagesAfterError = await browser.pages();
                console.log(`Pages after error: ${pagesAfterError.length}`);
            } catch (error) {
                console.log('❌ Cannot get pages after error:', error.message);
            }
        }
        
        await browser.disconnect();
        console.log('✅ Disconnected');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

if (require.main === module) {
    testPuppeteerPageCreation().catch(console.error);
}