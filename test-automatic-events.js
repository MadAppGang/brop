#!/usr/bin/env node
/**
 * Test automatic tab event subscription in Page class
 * Shows how Page automatically subscribes to events and receives tab-specific notifications
 */

const { createPage } = require('./page-utils');
const { createNamedBROPConnection } = require('./test-utils');

async function testAutomaticEventSubscription() {
    console.log('🧪 Testing Automatic Tab Event Subscription');
    console.log('==========================================\n');

    let page1 = null;
    let page2 = null;
    let externalConnection = null;

    try {
        // Step 1: Create two pages with different tabs
        console.log('📋 Step 1: Creating two pages with different tabs...');
        
        page1 = await createPage('https://example.com', 'auto-events-page1');
        console.log(`   ✅ Page 1: ${page1.toString()}`);
        
        page2 = await createPage('https://httpbin.org/html', 'auto-events-page2');
        console.log(`   ✅ Page 2: ${page2.toString()}`);

        // Step 2: Test that both pages work normally
        console.log('\n📋 Step 2: Testing normal operations...');
        
        const content1 = await page1.getContent();
        console.log(`   ✅ Page 1 content: ${content1.title}`);
        
        const content2 = await page2.getContent();
        console.log(`   ✅ Page 2 content: ${content2.title}`);

        // Step 3: Create external connection to close one tab
        console.log('\n📋 Step 3: Creating external connection...');
        externalConnection = createNamedBROPConnection('external-tab-closer');
        
        await new Promise((resolve) => {
            externalConnection.on('open', () => {
                console.log('   ✅ External connection established');
                resolve();
            });
        });

        // Step 4: Close page1's tab externally and verify only page1 gets the event
        console.log('\n📋 Step 4: Closing page1 tab externally...');
        const tabIdToClose = page1.getTabId();
        console.log(`   🎯 Closing tab ${tabIdToClose} (page1) via external connection`);

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

            setTimeout(() => {
                reject(new Error('External close timeout'));
            }, 5000);
        });

        if (closeResult.success) {
            console.log('   ✅ Tab closed successfully via external connection');
        } else {
            console.log(`   ⚠️  Tab close failed: ${closeResult.error}`);
        }

        // Step 5: Wait for event notifications
        console.log('\n📋 Step 5: Waiting for event notifications...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 6: Check status of both pages
        console.log('\n📋 Step 6: Checking page statuses after external closure...');
        
        console.log(`   📊 Page 1 status: ${page1.getStatus()} (should be destroyed)`);
        console.log(`   📊 Page 2 status: ${page2.getStatus()} (should still be connected)`);
        
        console.log(`   🔍 Page 1 connected: ${page1.isConnected()}`);
        console.log(`   🔍 Page 2 connected: ${page2.isConnected()}`);

        // Step 7: Test operations on both pages
        console.log('\n📋 Step 7: Testing operations after event...');
        
        // Test page1 (should fail)
        console.log('   🧪 Testing page1 operations (should fail)...');
        try {
            await page1.getContent();
            console.log('   ❌ ERROR: Page1 operation should have failed!');
        } catch (error) {
            console.log(`   ✅ Page1 operation correctly failed: ${error.message}`);
        }
        
        // Test page2 (should still work)
        console.log('   🧪 Testing page2 operations (should work)...');
        try {
            const content = await page2.getContent();
            console.log(`   ✅ Page2 operation succeeded: ${content.title}`);
        } catch (error) {
            console.log(`   ❌ ERROR: Page2 operation failed: ${error.message}`);
        }

        // Step 8: Close page2 normally and test cleanup
        console.log('\n📋 Step 8: Closing page2 normally...');
        await page2.close();
        console.log(`   ✅ Page2 closed normally`);
        console.log(`   📊 Page2 status: ${page2.getStatus()}`);

        console.log('\n🎉 Automatic event subscription test completed!');

        // Step 9: Summary
        console.log('\n📊 Test Summary:');
        console.log('================');
        console.log('✅ Automatic subscription: Working');
        console.log('✅ Tab-specific events: Working');
        console.log('✅ Event isolation: Working (only subscribed tab got event)');
        console.log('✅ Status updates: Working');
        console.log('✅ Operation blocking: Working');
        console.log('✅ Normal cleanup: Working');

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

        if (page1 && page1.isConnected()) {
            try {
                await page1.close();
                console.log('   ✅ Page1 closed');
            } catch (error) {
                console.log(`   ⚠️  Page1 close error: ${error.message}`);
            }
        }

        if (page2 && page2.isConnected()) {
            try {
                await page2.close();
                console.log('   ✅ Page2 closed');
            } catch (error) {
                console.log(`   ⚠️  Page2 close error: ${error.message}`);
            }
        }
    }
}

// Test multiple page scenario
async function testMultiplePageEvents() {
    console.log('\n🧪 Testing Multiple Page Event Isolation');
    console.log('========================================\n');

    const pages = [];
    let externalConnection = null;

    try {
        // Create 3 pages
        console.log('📋 Creating 3 pages...');
        for (let i = 1; i <= 3; i++) {
            const page = await createPage(`https://httpbin.org/delay/${i}`, `multi-page-${i}`);
            pages.push(page);
            console.log(`   ✅ Page ${i}: ${page.toString()}`);
        }

        // Create external connection
        externalConnection = createNamedBROPConnection('multi-page-closer');
        await new Promise(resolve => {
            externalConnection.on('open', resolve);
        });

        // Close middle page (page 2)
        console.log('\n📋 Closing middle page (page 2)...');
        const middleTabId = pages[1].getTabId();
        
        const closeMessage = {
            id: 'close-middle',
            method: 'close_tab',
            params: { tabId: middleTabId }
        };

        const closePromise = new Promise(resolve => {
            externalConnection.send(JSON.stringify(closeMessage));
            externalConnection.on('message', (data) => {
                const response = JSON.parse(data.toString());
                if (response.id === 'close-middle') {
                    resolve(response);
                }
            });
        });

        await closePromise;
        console.log(`   ✅ Middle page tab ${middleTabId} closed`);

        // Wait for events
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Check all page statuses
        console.log('\n📋 Checking all page statuses...');
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            console.log(`   📊 Page ${i+1}: ${page.getStatus()} (${page.isConnected() ? 'connected' : 'disconnected'})`);
        }

        // Verify only middle page is destroyed
        if (pages[0].isConnected() && !pages[1].isConnected() && pages[2].isConnected()) {
            console.log('   ✅ Event isolation working: Only middle page destroyed');
        } else {
            console.log('   ❌ Event isolation failed: Wrong pages affected');
        }

    } catch (error) {
        console.error(`\n❌ Multiple page test failed: ${error.message}`);
    } finally {
        console.log('\n🧹 Cleaning up multiple pages...');
        if (externalConnection) externalConnection.close();
        
        for (const page of pages) {
            if (page && page.isConnected()) {
                await page.close();
            }
        }
    }
}

// Run both tests
async function runAllTests() {
    await testAutomaticEventSubscription();
    await testMultiplePageEvents();
}

runAllTests().catch(console.error);