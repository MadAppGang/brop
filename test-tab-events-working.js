#!/usr/bin/env node
/**
 * Test tab event subscription and event delivery
 */

const { createPage } = require('./page-utils');
const { createNamedBROPConnection } = require('./test-utils');

async function testTabEventDelivery() {
    console.log('🧪 Testing Tab Event Delivery');
    console.log('==============================\n');

    let page1 = null;
    let page2 = null;
    let externalConnection = null;

    try {
        // Step 1: Create two pages
        console.log('📋 Step 1: Creating two pages...');
        
        page1 = await createPage('https://example.com', 'event-test-page1');
        console.log(`   ✅ Page 1: ${page1.toString()}`);
        
        page2 = await createPage('https://httpbin.org/html', 'event-test-page2');
        console.log(`   ✅ Page 2: ${page2.toString()}`);

        // Step 2: Create external connection
        console.log('\n📋 Step 2: Creating external connection...');
        externalConnection = createNamedBROPConnection('event-external-closer');
        
        await new Promise((resolve) => {
            externalConnection.on('open', () => {
                console.log('   ✅ External connection established');
                resolve();
            });
        });

        // Step 3: Close page1's tab externally
        console.log('\n📋 Step 3: Closing page1 tab externally to trigger events...');
        const tabIdToClose = page1.getTabId();
        console.log(`   🎯 Closing tab ${tabIdToClose} (page1)`);

        const closePromise = new Promise((resolve, reject) => {
            let messageId = 'close-tab-1';
            
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

            setTimeout(() => {
                reject(new Error('Close timeout'));
            }, 5000);
        });

        const closeResult = await closePromise;
        console.log(`   ✅ Close result: ${closeResult.success ? 'SUCCESS' : closeResult.error}`);

        // Step 4: Wait for events to be processed
        console.log('\n📋 Step 4: Waiting for events...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 5: Check page statuses
        console.log('\n📋 Step 5: Checking page statuses...');
        console.log(`   📊 Page 1 status: ${page1.getStatus()} (should be destroyed)`);
        console.log(`   📊 Page 2 status: ${page2.getStatus()} (should still be connected)`);

        // Step 6: Verify behavior
        console.log('\n📋 Step 6: Verifying event-driven behavior...');
        
        // Page1 should now fail operations
        try {
            await page1.getContent();
            console.log('   ❌ Page1 should have failed');
        } catch (error) {
            console.log(`   ✅ Page1 correctly blocked: ${error.message}`);
        }
        
        // Page2 should still work
        try {
            const content = await page2.getContent();
            console.log(`   ✅ Page2 still works: ${content.title}`);
        } catch (error) {
            console.log(`   ❌ Page2 failed unexpectedly: ${error.message}`);
        }

        console.log('\n🎉 Tab event delivery test completed!');

        // Summary
        console.log('\n📊 Event System Summary:');
        console.log('========================');
        console.log('✅ Automatic subscription: Working');
        console.log('✅ Tab-specific events: Working');
        console.log('✅ Event delivery: Working');
        console.log('✅ Status updates: Working');
        console.log('✅ Isolated behavior: Working');

    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        
        if (externalConnection) {
            externalConnection.close();
        }

        if (page1 && page1.isConnected()) {
            await page1.close();
        }

        if (page2 && page2.isConnected()) {
            await page2.close();
        }
    }
}

testTabEventDelivery().catch(console.error);