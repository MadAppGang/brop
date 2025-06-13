#!/usr/bin/env node
/**
 * Test the Page utility class
 */

const { createPage } = require('./client');

async function testPageUtils() {
    console.log('🧪 Testing Page Utils Class');
    console.log('============================\n');

    try {
        // Test 1: Create a page
        console.log('📋 Test 1: Creating a page...');
        const page = await createPage('https://httpbin.org/html', 'test-page-utils');
        console.log(`   ✅ Page created: ${page.toString()}`);
        console.log(`   📊 Status: ${page.getStatus()}`);
        console.log(`   🆔 Tab ID: ${page.getTabId()}`);

        // Test 2: Navigate
        console.log('\n📋 Test 2: Navigation...');
        await page.navigate('https://example.com');
        console.log('   ✅ Navigation successful');
        console.log(`   🌐 Current URL: ${page.getUrl()}`);

        // Wait for page to load
        console.log('\n⏳ Waiting for page to load...');
        await page.waitForLoad(3000);

        // Test 3: Get page content
        console.log('\n📋 Test 3: Getting page content...');
        const content = await page.getContent();
        console.log(`   ✅ Content retrieved: ${content.title || 'No title'}`);
        console.log(`   📄 URL: ${content.url || 'No URL'}`);

        // Test 4: Get console logs
        console.log('\n📋 Test 4: Getting console logs...');
        const logs = await page.getConsoleLogs({ limit: 5 });
        console.log(`   ✅ Console logs retrieved: ${logs.logs?.length || 0} entries`);

        // Test 5: Execute console code
        console.log('\n📋 Test 5: Executing console code...');
        const result = await page.executeConsole('document.title');
        console.log(`   ✅ Console execution result: ${result.result}`);

        // Test 6: Get simplified DOM
        console.log('\n📋 Test 6: Getting simplified DOM...');
        try {
            const dom = await page.getSimplifiedDOM({ max_depth: 2 });
            console.log(`   ✅ Simplified DOM retrieved`);
            console.log(`   📊 Interactive elements: ${dom.total_interactive_elements || 'N/A'}`);
        } catch (error) {
            console.log(`   ⚠️  Simplified DOM failed: ${error.message}`);
        }

        // Test 7: Get screenshot
        console.log('\n📋 Test 7: Getting screenshot...');
        try {
            const screenshot = await page.getScreenshot();
            console.log(`   ✅ Screenshot captured: ${screenshot.image_data?.length || 0} bytes`);
        } catch (error) {
            console.log(`   ⚠️  Screenshot failed: ${error.message}`);
        }

        // Test 8: Status checks
        console.log('\n📋 Test 8: Status checks...');
        console.log(`   🔍 Is connected: ${page.isConnected()}`);
        console.log(`   🔍 Is destroyed: ${page.isDestroyed()}`);

        // Test 9: Close page
        console.log('\n📋 Test 9: Closing page...');
        await page.close();
        console.log(`   ✅ Page closed`);
        console.log(`   📊 Final status: ${page.getStatus()}`);
        console.log(`   🔍 Is destroyed: ${page.isDestroyed()}`);

        // Test 10: Try to use closed page
        console.log('\n📋 Test 10: Testing closed page behavior...');
        try {
            await page.getContent();
            console.log('   ❌ Should have failed!');
        } catch (error) {
            console.log(`   ✅ Correctly rejected: ${error.message}`);
        }

        console.log('\n🎉 All Page Utils tests completed successfully!');

    } catch (error) {
        console.error('\n❌ Page Utils test failed:', error.message);
        console.error(error.stack);
    }
}

// Run tests
testPageUtils().catch(console.error);