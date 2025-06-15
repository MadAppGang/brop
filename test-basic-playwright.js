#!/usr/bin/env node
/**
 * Basic Playwright Test
 * 
 * Simple test to verify current Playwright behavior with our session management.
 */

import { chromium } from 'playwright';

async function testBasicPlaywright() {
  console.log('🎭 Testing Basic Playwright Functionality');
  console.log('='.repeat(50));

  let browser = null;

  try {
    console.log('📡 Connecting to BROP bridge...');
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ Connected successfully');

    console.log('🔧 Creating browser context...');
    const context = await browser.newContext();
    console.log('✅ Browser context created');

    console.log('📄 Creating new page...');
    const page = await context.newPage();
    console.log('✅ Page created successfully!');

    console.log('🌐 Testing navigation...');
    await page.goto('about:blank');
    console.log('✅ Navigation successful');

    console.log('⚡ Testing page evaluation...');
    const result = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        timestamp: Date.now()
      };
    });
    console.log('✅ Page evaluation successful');
    console.log(`   Result: ${JSON.stringify(result, null, 2)}`);

    console.log('');
    console.log('🎉 BASIC PLAYWRIGHT TEST PASSED!');
    console.log('✅ Session management is working correctly');
    console.log('✅ _page undefined error has been resolved');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('_page')) {
      console.error('🚨 _page undefined error still present');
    }
    
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🧹 Browser closed');
    }
  }
}

testBasicPlaywright().catch(error => {
  console.error('💥 Test execution failed:', error.message);
  process.exit(1);
});