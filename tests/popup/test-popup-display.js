const { createPage, createNamedBROPConnection } = require('../../client');

async function testPopupDisplay() {
    console.log('🧪 Simple Popup Display Test');
    console.log('============================');
    console.log('📋 This script will generate various log entries for popup testing');
    
    let page = null;
    let ws = null;
    
    try {
        // First generate some logs with low-level commands
        console.log('\n📋 Step 1: Testing connection commands...');
        ws = createNamedBROPConnection('popup-display-test');
        
        await new Promise((resolve, reject) => {
            ws.on('open', () => {
                console.log('✅ Connected to BROP bridge');
                resolve();
            });
            ws.on('error', reject);
        });
        
        // Test list_tabs and get_extension_errors
        const listTabsResult = await sendCommand(ws, 'list_tabs', {});
        console.log(`   ✅ list_tabs: Found ${listTabsResult.tabs ? listTabsResult.tabs.length : 0} tabs`);
        
        const errorsResult = await sendCommand(ws, 'get_extension_errors', { limit: 3 });
        console.log(`   ✅ get_extension_errors: ${errorsResult.errors ? errorsResult.errors.length : 0} errors`);
        
        // Step 2: Use Page class for tab management
        console.log('\n📋 Step 2: Testing Page class operations...');
        page = await createPage('https://example.com', 'popup-display-page');
        console.log(`   ✅ Page created: ${page.toString()}`);
        
        // Get page content
        const content = await page.getContent();
        console.log(`   ✅ get_page_content: ${content.title}`);
        
        // Navigate
        await page.navigate('https://httpbin.org/html');
        console.log(`   ✅ navigate: Successfully navigated`);
        
        // Get console logs
        const logs = await page.getConsoleLogs({ limit: 5 });
        console.log(`   ✅ get_console_logs: ${logs.logs ? logs.logs.length : 0} logs`);
        
        console.log('\n🎉 All commands executed! Log entries generated.');
        
        console.log('\n📱 Now test the popup:');
        console.log('=====================================');
        console.log('1. 🔍 Open Chrome extension popup (click BROP icon)');
        console.log('2. 📋 Check that you see these method names in the log list:');
        console.log('   - "list_tabs" (List Tabs)');
        console.log('   - "get_extension_errors" (Get Errors)');
        console.log('   - "create_tab" (Create Tab)');
        console.log('   - "get_page_content" (Get Page Content)');
        console.log('   - "navigate" (Navigation)');
        console.log('   - "get_console_logs" (Get Console Logs)');
        console.log('\n3. 🖱️  Click on any log entry to open details window');
        console.log('4. 🔍 Verify in details window:');
        console.log('   - Title shows method name (e.g., "BROP Log Details - list_tabs")');
        console.log('   - Header shows method name');
        console.log('   - "Method:" field shows correct value');
        console.log('   - NO "undefined" or "Unknown" should appear');
        
        console.log('\n✅ Expected Results:');
        console.log('   - All method names display correctly');
        console.log('   - Success/error status shows properly');
        console.log('   - Details window opens with correct information');
        console.log('   - No formatting issues or undefined values');
        
    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        if (page) {
            await page.close();
            console.log('   ✅ Page closed');
        }
        if (ws) {
            ws.close();
            console.log('   ✅ Connection closed');
        }
    }
}

// Helper function to send commands with promises
function sendCommand(ws, method, params) {
    return new Promise((resolve, reject) => {
        const id = Date.now().toString();
        
        const message = {
            id,
            method,
            params
        };
        
        const timeout = setTimeout(() => {
            reject(new Error(`Command timeout: ${method}`));
        }, 10000);
        
        const messageHandler = (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.id === id) {
                    clearTimeout(timeout);
                    ws.off('message', messageHandler);
                    if (response.success) {
                        resolve(response.result);
                    } else {
                        reject(new Error(response.error || 'Command failed'));
                    }
                }
            } catch (error) {
                // Ignore parse errors for other messages
            }
        };
        
        ws.on('message', messageHandler);
        ws.send(JSON.stringify(message));
    });
}

testPopupDisplay().catch(console.error);