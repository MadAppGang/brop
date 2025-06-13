#!/usr/bin/env node
/**
 * Example showing how to use the new Page class
 */

const { createPage } = require('./client');

async function examplePageUsage() {
    console.log('🎯 Page Class Usage Example');
    console.log('============================\n');

    let page = null;
    
    try {
        // 1. Create a page - automatically handles tab creation and connection
        console.log('📋 Step 1: Creating page...');
        page = await createPage('https://example.com', 'example-usage');
        console.log(`   ✅ Created: ${page.toString()}`);
        console.log(`   🆔 Tab ID: ${page.getTabId()}`);
        console.log(`   📊 Status: ${page.getStatus()}`);

        // 2. Wait for page to load
        console.log('\n📋 Step 2: Waiting for page load...');
        await page.waitForLoad(2000);
        console.log('   ✅ Page loaded');

        // 3. Get page content - tabId automatically included
        console.log('\n📋 Step 3: Getting page content...');
        const content = await page.getContent();
        console.log(`   ✅ Title: ${content.title}`);
        console.log(`   🌐 URL: ${content.url}`);

        // 4. Execute JavaScript - tabId automatically included
        console.log('\n📋 Step 4: Executing JavaScript...');
        const jsResult = await page.executeConsole(`
            // Generate some console activity
            console.log('Hello from Page class test!');
            console.warn('This is a warning');
            document.body.style.backgroundColor = 'lightblue';
            return {
                title: document.title,
                bodyHeight: document.body.scrollHeight,
                links: document.querySelectorAll('a').length
            };
        `);
        console.log(`   ✅ JS Result:`, jsResult.result);

        // 5. Get console logs - tabId automatically included
        console.log('\n📋 Step 5: Getting console logs...');
        const logs = await page.getConsoleLogs({ limit: 5 });
        console.log(`   ✅ Captured ${logs.logs?.length || 0} console logs`);
        if (logs.logs && logs.logs.length > 0) {
            logs.logs.forEach((log, i) => {
                console.log(`      ${i+1}. ${log.level}: ${log.message || log.text}`);
            });
        }

        // 6. Navigate to different page
        console.log('\n📋 Step 6: Navigating to different page...');
        await page.navigate('https://httpbin.org/html');
        console.log(`   ✅ Navigated to: ${page.getUrl()}`);

        // 7. Get updated content
        console.log('\n📋 Step 7: Getting updated content...');
        const newContent = await page.getContent();
        console.log(`   ✅ New title: ${newContent.title}`);

        // 8. Take screenshot - tabId automatically included
        console.log('\n📋 Step 8: Taking screenshot...');
        const screenshot = await page.getScreenshot();
        console.log(`   ✅ Screenshot: ${screenshot.image_data?.length || 0} bytes`);

        // 9. Try simplified DOM (if available)
        console.log('\n📋 Step 9: Getting simplified DOM...');
        try {
            const dom = await page.getSimplifiedDOM({ max_depth: 2 });
            console.log(`   ✅ DOM elements: ${dom.total_elements || 'N/A'}`);
            console.log(`   🎯 Interactive: ${dom.total_interactive_elements || 'N/A'}`);
        } catch (error) {
            console.log(`   ⚠️  Simplified DOM not available: ${error.message}`);
        }

        // 10. Status checks
        console.log('\n📋 Step 10: Status checks...');
        console.log(`   🔍 Is connected: ${page.isConnected()}`);
        console.log(`   🔍 Is destroyed: ${page.isDestroyed()}`);
        console.log(`   📊 Current status: ${page.getStatus()}`);

        console.log('\n🎉 All operations completed successfully!');

    } catch (error) {
        console.error(`\n❌ Example failed: ${error.message}`);
        console.error(error.stack);
    } finally {
        // 11. Cleanup - always close the page
        if (page && page.isConnected()) {
            console.log('\n🧹 Cleaning up...');
            await page.close();
            console.log('   ✅ Page closed and cleaned up');
            console.log(`   📊 Final status: ${page.getStatus()}`);
        }
    }
}

// Run the example
examplePageUsage().catch(console.error);