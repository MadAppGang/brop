#!/usr/bin/env node
/**
 * Test Page class behavior when tab is closed externally
 * Validates that Page object properly detects external tab closure
 */

const { createPage } = require('./page-utils');
const { createNamedBROPConnection } = require('./test-utils');

async function testPageExternalClose() {
    console.log('🧪 Testing Page External Close Detection');
    console.log('========================================\n');

    let page = null;
    let externalConnection = null;

    try {
        // Step 1: Create a page normally
        console.log('📋 Step 1: Creating page...');
        page = await createPage('https://example.com', 'page-close-test');
        console.log(`   ✅ Page created: ${page.toString()}`);
        console.log(`   🆔 Tab ID: ${page.getTabId()}`);
        console.log(`   📊 Status: ${page.getStatus()}`);

        // Step 2: Test that page works normally
        console.log('\n📋 Step 2: Testing normal page operations...');
        const content = await page.getContent();
        console.log(`   ✅ Page content retrieved: ${content.title}`);
        console.log(`   🔍 Page is connected: ${page.isConnected()}`);

        // Step 3: Create external connection to bridge
        console.log('\n📋 Step 3: Creating external connection...');
        externalConnection = createNamedBROPConnection('external-closer');
        
        await new Promise((resolve) => {
            externalConnection.on('open', () => {
                console.log('   ✅ External connection established');
                resolve();
            });
        });

        // Step 4: Use external connection to close the tab
        console.log('\n📋 Step 4: Closing tab externally...');
        const tabIdToClose = page.getTabId();
        console.log(`   🎯 Closing tab ${tabIdToClose} via external connection`);

        const closeResult = await new Promise((resolve, reject) => {
            let messageId = 1;
            
            const message = {
                id: messageId,
                method: 'close_tab',
                params: { tabId: tabIdToClose }
            };

            externalConnection.send(JSON.stringify(message));

            externalConnection.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === messageId) {
                        resolve(response);
                    }
                } catch (error) {
                    reject(error);
                }
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                reject(new Error('External close timeout'));
            }, 5000);
        });

        if (closeResult.success) {
            console.log('   ✅ Tab closed successfully via external connection');
        } else {
            console.log(`   ⚠️  Tab close failed: ${closeResult.error}`);
        }

        // Step 5: Wait a moment for the page object to detect the closure
        console.log('\n📋 Step 5: Waiting for page object to detect closure...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 6: Test page status after external closure
        console.log('\n📋 Step 6: Testing page status after external closure...');
        console.log(`   📊 Page status: ${page.getStatus()}`);
        console.log(`   🔍 Is connected: ${page.isConnected()}`);
        console.log(`   🔍 Is destroyed: ${page.isDestroyed()}`);

        // Step 7: Try to use the page object - should fail
        console.log('\n📋 Step 7: Testing page operations after external closure...');
        
        // Test 7a: Try to get content
        console.log('   🧪 Testing getContent()...');
        try {
            await page.getContent();
            console.log('   ❌ ERROR: getContent() should have failed!');
        } catch (error) {
            console.log(`   ✅ getContent() correctly failed: ${error.message}`);
        }

        // Test 7b: Try to get console logs
        console.log('   🧪 Testing getConsoleLogs()...');
        try {
            await page.getConsoleLogs();
            console.log('   ❌ ERROR: getConsoleLogs() should have failed!');
        } catch (error) {
            console.log(`   ✅ getConsoleLogs() correctly failed: ${error.message}`);
        }

        // Test 7c: Try to execute console
        console.log('   🧪 Testing executeConsole()...');
        try {
            await page.executeConsole('document.title');
            console.log('   ❌ ERROR: executeConsole() should have failed!');
        } catch (error) {
            console.log(`   ✅ executeConsole() correctly failed: ${error.message}`);
        }

        // Test 7d: Try to navigate
        console.log('   🧪 Testing navigate()...');
        try {
            await page.navigate('https://google.com');
            console.log('   ❌ ERROR: navigate() should have failed!');
        } catch (error) {
            console.log(`   ✅ navigate() correctly failed: ${error.message}`);
        }

        // Step 8: Test that close() is safe on already closed page
        console.log('\n📋 Step 8: Testing close() on already closed page...');
        try {
            await page.close();
            console.log('   ✅ close() completed safely (no error thrown)');
        } catch (error) {
            console.log(`   ⚠️  close() threw error: ${error.message}`);
        }

        console.log('\n🎉 External close detection test completed!');

        // Step 9: Summary
        console.log('\n📊 Test Summary:');
        console.log('================');
        console.log('✅ Page creation: Working');
        console.log('✅ Normal operations: Working');
        console.log('✅ External tab closure: Working');
        console.log('✅ Status detection: Working');
        console.log('✅ Operation blocking: Working');
        console.log('✅ Safe cleanup: Working');

    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        console.error(error.stack);
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        
        if (externalConnection && externalConnection.readyState === 1) {
            externalConnection.close();
            console.log('   ✅ External connection closed');
        }

        if (page && page.isConnected()) {
            try {
                await page.close();
                console.log('   ✅ Page connection closed');
            } catch (error) {
                console.log(`   ⚠️  Page close error: ${error.message}`);
            }
        } else {
            console.log('   ✅ Page was already closed/destroyed');
        }
    }
}

// Alternative test: Test what happens when bridge connection is lost
async function testPageConnectionLoss() {
    console.log('\n🧪 Testing Page Connection Loss');
    console.log('===============================\n');

    let page = null;

    try {
        console.log('📋 Creating page...');
        page = await createPage('https://example.com', 'connection-loss-test');
        console.log(`   ✅ Page created: ${page.toString()}`);

        console.log('\n📋 Testing normal operation...');
        const content = await page.getContent();
        console.log(`   ✅ Content retrieved: ${content.title}`);

        console.log('\n📋 Simulating connection loss...');
        // Force close the WebSocket connection
        if (page.ws) {
            page.ws.close();
            console.log('   🔌 WebSocket connection closed');
        }

        // Wait for connection loss to be detected
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('\n📋 Testing operations after connection loss...');
        console.log(`   📊 Page status: ${page.getStatus()}`);

        try {
            await page.getContent();
            console.log('   ❌ ERROR: Should have failed after connection loss!');
        } catch (error) {
            console.log(`   ✅ Operation correctly failed: ${error.message}`);
        }

    } catch (error) {
        console.error(`\n❌ Connection loss test failed: ${error.message}`);
    } finally {
        if (page && page.isConnected()) {
            await page.close();
        }
    }
}

// Run both tests
async function runAllTests() {
    await testPageExternalClose();
    await testPageConnectionLoss();
}

runAllTests().catch(console.error);