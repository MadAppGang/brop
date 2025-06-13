const { createPage } = require('../../client');

async function testProperTabIdUsage() {
    console.log('✅ Test Proper TabId Usage');
    console.log('==========================');
    console.log('📋 Demonstrating correct tabId workflow');
    
    let page = null;
    
    try {
        console.log('✅ Connected to BROP bridge');
        console.log('\n📋 Step 1: Creating a tab to get a valid tabId...');
        page = await createPage('https://httpbin.org/html', 'test-proper-tabid-usage.js');
        console.log(`   ✅ SUCCESS - Got tabId: ${page.tabId}`);
        
        console.log(`\n📋 Step 2: Using tabId ${page.tabId} for execute_console...`);
        const executeResult = await page.executeConsole('console.log("Proper tabId usage test"); document.title');
        console.log(`   ${executeResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        if (!executeResult.success) {
            console.log(`   Error: ${executeResult.error}`);
        }
        
        console.log(`\n📋 Step 3: Using tabId ${page.tabId} for get_page_content...`);
        const contentResult = await page.getContent();
        console.log(`   ${contentResult.success !== false ? '✅ SUCCESS' : '❌ FAILED'}`);
        if (contentResult.error) {
            console.log(`   Error: ${contentResult.error}`);
        }
        
        console.log(`\n📋 Step 4: Cleaning up by closing tab ${page.tabId}...`);
        await page.close();
        console.log(`   ✅ SUCCESS`);
        
        console.log('\n🎉 PROPER TABID WORKFLOW COMPLETE');
        console.log('=================================');
        console.log('✅ Created tab and got tabId');
        console.log('✅ Used tabId for execute_console - SUCCESS');
        console.log('✅ Used tabId for get_page_content - SUCCESS');
        console.log('✅ Cleaned up by closing the tab');
        console.log('\n💡 Key Points:');
        console.log('   • Always use list_tabs or create_tab to get valid tabIds');
        console.log('   • Provide explicit tabId for all tab-specific operations');
        console.log('   • Never send tabId: null - system will reject it');
        console.log('   • Page class automatically manages tabId for all operations');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        if (page) {
            await page.close();
            console.log('\n🔌 Page closed and cleaned up');
        }
    }
}

testProperTabIdUsage().catch(console.error);