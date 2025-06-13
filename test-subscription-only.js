#!/usr/bin/env node
/**
 * Test only the subscription functionality without tab events
 */

const { createNamedBROPConnection } = require('./test-utils');

async function testSubscriptionOnly() {
    console.log('🧪 Testing Tab Event Subscription Commands');
    console.log('=========================================\n');

    let connection = null;

    try {
        // Create connection
        console.log('📋 Step 1: Creating connection...');
        connection = createNamedBROPConnection('subscription-test');
        
        await new Promise((resolve) => {
            connection.on('open', () => {
                console.log('   ✅ Connection established');
                resolve();
            });
        });

        // Test subscription command
        console.log('\n📋 Step 2: Testing subscription command...');
        const subscribeResult = await new Promise((resolve, reject) => {
            const message = {
                id: 'test-subscribe',
                method: 'subscribe_tab_events',
                params: { 
                    tabId: 12345,
                    events: ['tab_closed', 'tab_removed', 'tab_updated']
                }
            };

            connection.send(JSON.stringify(message));

            connection.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === 'test-subscribe') {
                        resolve(response);
                    }
                } catch (error) {
                    reject(error);
                }
            });

            setTimeout(() => {
                reject(new Error('Subscribe timeout'));
            }, 5000);
        });

        if (subscribeResult.success) {
            console.log('   ✅ Subscription succeeded:', subscribeResult.result);
        } else {
            console.log('   ❌ Subscription failed:', subscribeResult.error);
        }

        // Test unsubscription command
        console.log('\n📋 Step 3: Testing unsubscription command...');
        const unsubscribeResult = await new Promise((resolve, reject) => {
            const message = {
                id: 'test-unsubscribe',
                method: 'unsubscribe_tab_events',
                params: { tabId: 12345 }
            };

            connection.send(JSON.stringify(message));

            connection.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === 'test-unsubscribe') {
                        resolve(response);
                    }
                } catch (error) {
                    reject(error);
                }
            });

            setTimeout(() => {
                reject(new Error('Unsubscribe timeout'));
            }, 5000);
        });

        if (unsubscribeResult.success) {
            console.log('   ✅ Unsubscription succeeded:', unsubscribeResult.result);
        } else {
            console.log('   ❌ Unsubscription failed:', unsubscribeResult.error);
        }

        console.log('\n🎉 Subscription commands test completed!');

    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
    } finally {
        if (connection) {
            connection.close();
        }
    }
}

testSubscriptionOnly().catch(console.error);