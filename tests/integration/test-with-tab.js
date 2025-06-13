const { createPage } = require('../../client');

async function testWithRealTab() {
    console.log('🧪 BROP Test with Real Tab');
    console.log('==========================');
    console.log('📋 Creating test tab and running comprehensive tests');
    
    let page = null;
    
    try {
        console.log('\n🔧 Test 1/6: CREATE TAB');
        page = await createPage('https://httpbin.org/html', 'comprehensive-test');
        console.log(`   ✅ Page created: ${page.toString()}`);
        
        console.log('\n🔧 Test 2/6: EXECUTE CONSOLE');
        const executeResult = await page.executeConsole('console.log("Test log from BROP on httpbin"); document.title');
        console.log(`   ✅ Console executed: ${executeResult.result}`);
        
        console.log('\n🔧 Test 3/6: GET CONSOLE LOGS');
        const logs = await page.getConsoleLogs({ limit: 10 });
        const logCount = logs.logs?.length || 0;
        console.log(`   ✅ Retrieved ${logCount} console logs`);
        console.log(`   📊 Method: ${logs.method || 'unknown'}`);
        console.log(`   📍 Source: ${logs.source || 'unknown'}`);
        if (logCount > 0) {
            console.log('   📋 Sample logs:');
            logs.logs.slice(0, 3).forEach((log, i) => {
                const message = log.message || log.text || 'No message';
                console.log(`      ${i + 1}. ${log.level?.toUpperCase()}: ${message.substring(0, 80)}`);
            });
        }
        
        console.log('\n🔧 Test 4/6: GET PAGE CONTENT');
        const content = await page.getContent({ include_metadata: true });
        console.log(`   ✅ Page content retrieved: ${content.title || 'Unknown'}`);
        console.log(`   🔗 URL: ${content.url || 'Unknown'}`);
        console.log(`   📝 Content length: ${content.content?.length || 0} chars`);
        
        console.log('\n🔧 Test 5/6: GET SCREENSHOT');
        const screenshot = await page.getScreenshot({ format: 'png' });
        const imageSize = screenshot.imageData?.length || 0;
        console.log(`   ✅ Screenshot captured: ${imageSize} bytes`);
        
        console.log('\n🔧 Test 6/6: NAVIGATE TAB');
        await page.navigate('https://example.com');
        console.log(`   ✅ Navigated to: https://example.com`);
        
        // Get content from new page
        const newContent = await page.getContent();
        console.log(`   ✅ New page content: ${newContent.title || 'Unknown'}`);
        
        console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
        
    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        console.log('\n💡 Common causes:');
        console.log('   - Network connectivity issues');
        console.log('   - Chrome extension not loaded');
        console.log('   - Bridge server not running');
        console.log('   - Target website blocking requests');
    } finally {
        // Cleanup
        if (page) {
            await page.close();
            console.log('\n🧹 Test tab closed and cleaned up');
        }
    }
}

testWithRealTab().catch(console.error);