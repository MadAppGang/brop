#!/usr/bin/env node
/**
 * Test script to demonstrate tab close notifications and session cleanup
 */

import { BROPCDPClient } from './brop_cdp_client.js';

class TabCloseNotificationTest {
    constructor() {
        this.cdp = new BROPCDPClient({
            webSocketDebuggerUrl: 'ws://localhost:9222'
        });
        this.createdTargets = [];
    }

    async runTest() {
        console.log('🧪 Tab Close Notification Test');
        console.log('==============================');

        try {
            // Connect and get initial browser info
            console.log('📋 Connecting to BROP bridge...');
            const version = await this.cdp.Browser.getVersion();
            console.log(`   Browser: ${version.product}`);

            // Set up event listeners for session management
            console.log('\n🎧 Setting up event listeners...');
            this.setupEventListeners();

            // Create a test tab
            console.log('\n📄 Creating a test tab...');
            const newTarget = await this.cdp.Target.createTarget({ 
                url: 'https://httpbin.org/html' 
            });
            this.createdTargets.push(newTarget.targetId);
            console.log(`   ✅ Created target: ${newTarget.targetId}`);

            // Wait a moment for the tab to be ready
            await this.sleep(2000);

            // Navigate the tab to show session activity
            console.log('\n🌐 Navigating tab to demonstrate session activity...');
            await this.cdp.Page.navigate({ url: 'https://httpbin.org/json' });
            console.log('   ✅ Navigation completed');

            // Wait to see navigation events
            await this.sleep(1000);

            // Programmatically close the tab to test notifications
            console.log('\n🗑️ Programmatically closing the tab...');
            const closeResult = await this.cdp.Target.closeTarget({ 
                targetId: newTarget.targetId 
            });
            console.log(`   ✅ Close result: ${JSON.stringify(closeResult)}`);

            // Wait to see close events
            await this.sleep(2000);

            // Create another tab and close it manually (by removing from targets)
            console.log('\n📄 Creating another test tab for manual close test...');
            const secondTarget = await this.cdp.Target.createTarget({ 
                url: 'https://httpbin.org/get' 
            });
            this.createdTargets.push(secondTarget.targetId);
            console.log(`   ✅ Created second target: ${secondTarget.targetId}`);
            console.log('   📝 You can now manually close this tab in your browser to see close notifications');

            // Wait for potential manual close
            console.log('\n⏰ Waiting 10 seconds for potential manual tab close...');
            await this.sleep(10000);

            console.log('\n✅ Tab Close Notification Test completed successfully!');
            console.log('🎉 Check the bridge server logs to see the session cleanup notifications');

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Make sure the bridge server is running');
            console.error('   2. Make sure the Chrome extension is loaded and connected');
            console.error('   3. Check extension popup shows "Connected" status');
        } finally {
            // Clean up any remaining targets
            for (const targetId of this.createdTargets) {
                try {
                    await this.cdp.Target.closeTarget({ targetId });
                    console.log(`🧹 Cleaned up target: ${targetId}`);
                } catch (error) {
                    // Target might already be closed
                }
            }
            
            this.cdp.reset();
        }
    }

    setupEventListeners() {
        // Listen for target destruction events
        this.cdp.addEventListener('Target.targetDestroyed', (event) => {
            console.log(`📡 🗑️ Target destroyed: ${event.params.targetId}`);
        });

        // Listen for target detachment events
        this.cdp.addEventListener('Target.detachedFromTarget', (event) => {
            console.log(`📡 🔌 Target detached: ${event.params.targetId} (session: ${event.params.sessionId})`);
        });

        // Listen for page navigation events
        this.cdp.addEventListener('Page.frameNavigated', (event) => {
            console.log(`📡 🧭 Frame navigated: ${event.params.frame.url}`);
        });

        // Listen for custom BROP session events
        this.cdp.addEventListener('session_event', (event) => {
            console.log(`📡 🎯 BROP Session Event: ${event.event_type}`);
            console.log(`   Tab ID: ${event.tabId}`);
            console.log(`   Target ID: ${event.targetId}`);
            if (event.sessionId) {
                console.log(`   Session ID: ${event.sessionId}`);
            }
            if (event.reason) {
                console.log(`   Reason: ${event.reason}`);
            }
        });

        console.log('   ✅ Event listeners set up for:');
        console.log('      - Target.targetDestroyed');
        console.log('      - Target.detachedFromTarget');
        console.log('      - Page.frameNavigated');
        console.log('      - Custom BROP session events');
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the test
async function main() {
    const test = new TabCloseNotificationTest();
    await test.runTest();
}

// Handle both Node.js and browser environments
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('test-tab-close-notifications.js')) {
    main().catch(console.error);
}

export { TabCloseNotificationTest };