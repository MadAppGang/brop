#!/usr/bin/env node
/**
 * Shows how tab lifecycle currently works in BROP
 * (reactive detection vs proactive subscription)
 */

const { createPage, createNamedBROPConnection } = require('./client');

async function showCurrentTabLifecycle() {
    console.log('🔍 Current Tab Lifecycle Detection in BROP');
    console.log('==========================================\n');

    let page = null;
    let monitor = null;

    try {
        // 1. Create a page
        console.log('📋 Step 1: Creating page...');
        page = await createPage('https://example.com', 'lifecycle-demo');
        console.log(`   ✅ ${page.toString()}`);

        // 2. Create a monitoring connection to listen for any broadcasts
        console.log('\n📋 Step 2: Creating monitoring connection...');
        monitor = createNamedBROPConnection('lifecycle-monitor');
        
        const monitorReady = new Promise((resolve) => {
            monitor.on('open', () => {
                console.log('   ✅ Monitor connection established');
                resolve();
            });
        });

        await monitorReady;

        // 3. Set up message listener to catch any broadcasts
        console.log('\n📋 Step 3: Listening for broadcasts...');
        const broadcasts = [];
        
        monitor.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                // Check if this looks like an event broadcast
                if (message.event_type || message.type === 'event' || !message.id) {
                    broadcasts.push(message);
                    console.log(`   📡 Broadcast received:`, message);
                }
            } catch (error) {
                // Ignore parse errors
            }
        });

        // 4. Perform some operations to see if events are generated
        console.log('\n📋 Step 4: Performing operations to trigger events...');
        
        // Get page content
        const content = await page.getContent();
        console.log(`   ✅ Got content: ${content.title}`);
        
        // Wait to see if any events were broadcast
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 5. Close tab externally via different connection
        console.log('\n📋 Step 5: Closing tab externally...');
        const closer = createNamedBROPConnection('tab-closer');
        
        const closeReady = new Promise((resolve) => {
            closer.on('open', resolve);
        });
        await closeReady;

        const tabId = page.getTabId();
        const closeResult = await new Promise((resolve) => {
            const message = {
                id: 'close-test',
                method: 'close_tab',
                params: { tabId }
            };

            closer.send(JSON.stringify(message));
            closer.on('message', (data) => {
                const response = JSON.parse(data.toString());
                if (response.id === 'close-test') {
                    resolve(response);
                }
            });
        });

        console.log(`   ✅ Close result: ${closeResult.success ? 'SUCCESS' : closeResult.error}`);

        // 6. Wait for potential broadcast events
        console.log('\n📋 Step 6: Waiting for broadcast events...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 7. Try to use the page to see reactive detection
        console.log('\n📋 Step 7: Testing reactive detection...');
        try {
            await page.getContent();
            console.log('   ❌ Should have failed!');
        } catch (error) {
            console.log(`   ✅ Reactive detection worked: ${error.message}`);
            console.log(`   📊 Page status after detection: ${page.getStatus()}`);
        }

        // 8. Summary of findings
        console.log('\n📊 Current Tab Lifecycle Summary:');
        console.log('==================================');
        console.log(`📡 Broadcasts received: ${broadcasts.length}`);
        if (broadcasts.length > 0) {
            console.log('📋 Broadcast types:');
            broadcasts.forEach((broadcast, i) => {
                console.log(`   ${i+1}. ${broadcast.event_type || broadcast.type || 'unknown'}`);
            });
        } else {
            console.log('❌ No broadcast events detected');
        }

        console.log('\n🔍 How Tab Lifecycle Currently Works:');
        console.log('=====================================');
        console.log('1. ❌ No proactive event subscription');
        console.log('2. ❌ No automatic tab lifecycle broadcasts');
        console.log('3. ✅ Reactive detection via operation failures');
        console.log('4. ✅ Error message analysis for closure detection');
        console.log('5. ✅ Status management after detection');

        console.log('\n💡 To Implement Proactive Events:');
        console.log('=================================');
        console.log('1. Add tab_events subscription to BROP protocol');
        console.log('2. Chrome extension monitors chrome.tabs.onRemoved');
        console.log('3. Chrome extension monitors chrome.tabs.onUpdated');
        console.log('4. Bridge server broadcasts events to subscribed clients');
        console.log('5. Page class subscribes and updates status immediately');

        closer.close();

    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
    } finally {
        console.log('\n🧹 Cleaning up...');
        if (monitor) monitor.close();
        if (page && page.isConnected()) {
            await page.close();
        }
    }
}

showCurrentTabLifecycle().catch(console.error);