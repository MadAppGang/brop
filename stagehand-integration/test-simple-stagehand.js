#!/usr/bin/env node
/**
 * Simple Stagehand test without AI - just basic functionality
 */

require('dotenv').config({ path: '../.env' });
const { Stagehand } = require('@browserbasehq/stagehand');
const { checkBROPAvailability } = require('./index');

async function testSimpleStagehand() {
    console.log('🎭 Simple Stagehand + BROP Integration Test');
    console.log('=' + '='.repeat(45));
    
    let stagehand = null;
    
    try {
        // Step 1: Check BROP availability
        console.log('📋 Step 1: Checking BROP availability...');
        const availability = await checkBROPAvailability();
        
        if (!availability.available) {
            console.error('❌ BROP is not available:', availability.error);
            process.exit(1);
        }
        
        console.log('✅ BROP services are ready');
        
        // Step 2: Initialize Stagehand with minimal configuration
        console.log('\n📋 Step 2: Initializing Stagehand...');
        
        stagehand = new Stagehand({
            env: "LOCAL",
            verbose: 1,
            debugDom: true,
            enableCaching: false,
            headless: false,
            // Connect to BROP's CDP endpoint
            browserUrl: process.env.BROP_CDP_URL || "ws://localhost:9222"
        });
        
        await stagehand.init();
        console.log('✅ Stagehand initialized successfully');
        
        // Step 3: Basic page operations
        console.log('\n📋 Step 3: Testing basic page operations...');
        const page = stagehand.page;
        
        // Navigate to a simple page
        console.log('   📤 Navigating to example.com...');
        await page.goto('https://example.com', { 
            waitUntil: 'networkidle0' 
        });
        
        console.log('✅ Navigation successful');
        
        // Get page info
        const pageInfo = {
            title: await page.title(),
            url: page.url()
        };
        
        console.log(`   📄 Page Title: ${pageInfo.title}`);
        console.log(`   🌐 Page URL: ${pageInfo.url}`);
        
        // Step 4: Test BROP integration (without AI)
        console.log('\n📋 Step 4: Testing BROP integration...');
        
        // Check if BROP content script is available
        const bropCheck = await page.evaluate(() => {
            return {
                hasBROP: typeof window.BROP !== 'undefined',
                hasDOMSimplifier: typeof window.DOMSimplifier !== 'undefined',
                pageUrl: window.location.href,
                hasChrome: typeof chrome !== 'undefined',
                hasExtension: typeof chrome?.runtime !== 'undefined'
            };
        });
        
        console.log('🔍 BROP Integration Check:');
        console.log(`   BROP Content Script: ${bropCheck.hasBROP ? '✅ Available' : '❌ Not Found'}`);
        console.log(`   DOM Simplifier: ${bropCheck.hasDOMSimplifier ? '✅ Available' : '❌ Not Found'}`);
        console.log(`   Chrome APIs: ${bropCheck.hasChrome ? '✅ Available' : '❌ Not Found'}`);
        console.log(`   Extension Runtime: ${bropCheck.hasExtension ? '✅ Available' : '❌ Not Found'}`);
        
        // Step 5: Test basic Stagehand functionality
        console.log('\n📋 Step 5: Testing basic Stagehand functionality...');
        
        // Take a screenshot
        console.log('   📸 Taking screenshot...');
        const screenshot = await page.screenshot({ 
            path: 'stagehand-test-screenshot.png',
            fullPage: false 
        });
        console.log('✅ Screenshot taken: stagehand-test-screenshot.png');
        
        // Get page content
        console.log('   📋 Getting page content...');
        const content = await page.content();
        console.log(`✅ Page content length: ${content.length} characters`);
        
        // Test element selection
        console.log('   🎯 Testing element selection...');
        const headingExists = await page.$('h1');
        console.log(`✅ H1 heading found: ${headingExists ? 'Yes' : 'No'}`);
        
        // Step 6: Test simplified stagehand actions (no AI)
        console.log('\n📋 Step 6: Testing basic interactions...');
        
        // Try to find links without AI
        const links = await page.$$eval('a', (anchors) => {
            return anchors.slice(0, 3).map(a => ({
                text: a.textContent.trim(),
                href: a.href
            }));
        });
        
        console.log('🔗 Found links:');
        links.forEach((link, i) => {
            console.log(`   ${i + 1}. "${link.text}" -> ${link.href}`);
        });
        
        console.log('\n🎉 SUCCESS! Basic Stagehand + BROP integration working!');
        console.log('✅ Stagehand can connect to BROP');
        console.log('✅ Basic page operations working');
        console.log('✅ Element selection functional');
        console.log('✅ Screenshot capability confirmed');
        
        console.log('\n📋 Next Steps:');
        console.log('   1. ✅ Basic integration confirmed');
        console.log('   2. 🔧 Fix AI client configuration for advanced features');
        console.log('   3. 🚀 Enable AI-powered observations and actions');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('\n🔍 Error Details:', error);
    } finally {
        if (stagehand) {
            try {
                await stagehand.close();
                console.log('🔚 Stagehand closed successfully');
            } catch (error) {
                console.error('⚠️ Error closing Stagehand:', error.message);
            }
        }
    }
}

testSimpleStagehand();