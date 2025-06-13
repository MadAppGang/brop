#!/usr/bin/env node
/**
 * Simple test to verify tab event subscription functionality
 */

const { createPage } = require('./client');

async function testSimpleSubscription() {
    console.log('🧪 Testing Simple Tab Event Subscription');
    console.log('=======================================\n');

    let page = null;

    try {
        // Create a page (should automatically subscribe to events)
        console.log('📋 Creating page with automatic subscription...');
        page = await createPage('https://example.com', 'simple-subscription-test');
        
        console.log(`   ✅ Page created: ${page.toString()}`);
        console.log(`   🆔 Tab ID: ${page.getTabId()}`);
        console.log(`   📊 Status: ${page.getStatus()}`);
        console.log(`   🔔 Events subscribed: ${page.eventsSubscribed}`);

        // Test normal functionality
        console.log('\n📋 Testing normal page operations...');
        const content = await page.getContent();
        console.log(`   ✅ Content retrieved: ${content.title}`);

        console.log('\n🎉 Simple subscription test completed successfully!');

    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        if (error.message.includes('Chrome extension not connected')) {
            console.log('\n💡 The Chrome extension needs to be loaded and connected to the bridge server.');
            console.log('   Please make sure the BROP Chrome extension is installed and active.');
        }
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        if (page && page.isConnected()) {
            await page.close();
            console.log('   ✅ Page closed');
        }
    }
}

testSimpleSubscription().catch(console.error);