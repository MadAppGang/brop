#!/usr/bin/env node
/**
 * BROP JavaScript CDP Example
 * 
 * This example shows how to use the JavaScript CDP client to control
 * the browser through the BROP extension.
 */

import { BROPCDPClient } from './brop_cdp_client.js';

class BROPJavaScriptExample {
    constructor() {
        // Create CDP client instance
        this.cdp = new BROPCDPClient({
            webSocketDebuggerUrl: 'ws://localhost:9222'
        });
        
        this.targetId = null;
    }

    async runExample() {
        console.log('🚀 BROP JavaScript CDP Example');
        console.log('=' + '='.repeat(50));
        
        try {
            // Test connection and get browser info
            console.log('📋 Getting browser version...');
            const version = await this.cdp.Browser.getVersion();
            console.log(`   Browser: ${version.product}`);
            console.log(`   Protocol: ${version.protocolVersion}`);
            console.log(`   User Agent: ${version.userAgent}`);
            
            // Get available targets (tabs)
            console.log('\n🎯 Getting available targets...');
            const targetsResponse = await this.cdp.Target.getTargets();
            const targets = targetsResponse.targetInfos || [];
            const pageTargets = targets.filter(t => t.type === 'page');
            
            console.log(`   Found ${pageTargets.length} page targets:`);
            pageTargets.forEach((target, index) => {
                console.log(`   ${index + 1}. ${target.title} (${target.url})`);
            });
            
            // Use the first available page target or create one
            if (pageTargets.length > 0) {
                this.targetId = pageTargets[0].targetId;
                console.log(`\n📄 Using existing target: ${this.targetId}`);
                
                // Activate the target tab
                await this.cdp.Target.activateTarget({ targetId: this.targetId });
                console.log('   ✅ Target activated');
            } else {
                console.log('\n📄 No page targets found, creating new tab...');
                const newTarget = await this.cdp.Target.createTarget({ 
                    url: 'about:blank' 
                });
                this.targetId = newTarget.targetId;
                console.log(`   ✅ Created new target: ${this.targetId}`);
            }
            
            // Navigate to a website
            console.log('\n🌐 Navigating to example.com...');
            await this.cdp.Page.navigate({ url: 'https://example.com' });
            console.log('   ✅ Navigation started');
            
            // Wait a moment for page to load
            await this.sleep(3000);
            
            // Get page title using JavaScript evaluation
            console.log('\n🔍 Executing JavaScript to get page info...');
            const titleResult = await this.cdp.Runtime.evaluate({
                expression: 'document.title',
                returnByValue: true
            });
            console.log(`   Page Title: ${titleResult.result.value}`);
            
            // Get page URL
            const urlResult = await this.cdp.Runtime.evaluate({
                expression: 'window.location.href',
                returnByValue: true
            });
            console.log(`   Page URL: ${urlResult.result.value}`);
            
            // Count elements on the page
            const elementCountResult = await this.cdp.Runtime.evaluate({
                expression: 'document.querySelectorAll("*").length',
                returnByValue: true
            });
            console.log(`   Total Elements: ${elementCountResult.result.value}`);
            
            // Get paragraph count
            const paragraphResult = await this.cdp.Runtime.evaluate({
                expression: 'document.querySelectorAll("p").length',
                returnByValue: true
            });
            console.log(`   Paragraphs: ${paragraphResult.result.value}`);
            
            // Take a screenshot
            console.log('\n📸 Taking screenshot...');
            const screenshot = await this.cdp.Page.captureScreenshot({
                format: 'png'
            });
            console.log(`   ✅ Screenshot captured (${screenshot.data.length} bytes base64)`);
            
            // Save screenshot to file
            if (typeof require !== 'undefined') {
                const fs = require('fs');
                const screenshotData = Buffer.from(screenshot.data, 'base64');
                fs.writeFileSync('brop_javascript_screenshot.png', screenshotData);
                console.log('   💾 Screenshot saved as brop_javascript_screenshot.png');
            }
            
            // Demonstrate page interaction
            console.log('\n🖱️  Testing page interaction...');
            try {
                // Try to click on a link (if any)
                const clickResult = await this.cdp.Runtime.evaluate({
                    expression: `
                        const links = document.querySelectorAll('a');
                        if (links.length > 0) {
                            links[0].style.backgroundColor = 'yellow';
                            'Highlighted first link: ' + links[0].textContent;
                        } else {
                            'No links found on page';
                        }
                    `,
                    returnByValue: true
                });
                console.log(`   ${clickResult.result.value}`);
            } catch (error) {
                console.log(`   ⚠️  Page interaction failed: ${error.message}`);
            }
            
            // Test console logging
            console.log('\n📝 Testing console logging...');
            await this.cdp.Runtime.evaluate({
                expression: 'console.log("Hello from BROP JavaScript CDP client!")',
                returnByValue: true
            });
            console.log('   ✅ Console message sent');
            
            console.log('\n✅ BROP JavaScript CDP example completed successfully!');
            console.log('🎉 Browser automation working with native JavaScript!');
            
        } catch (error) {
            console.error('❌ Example failed:', error.message);
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Make sure the bridge server is running (node bridge_server.js)');
            console.error('   2. Make sure the Chrome extension is loaded and connected');
            console.error('   3. Check that the extension popup shows "Bridge Connected"');
            console.error('   4. Verify Chrome is not running with --remote-debugging-port');
        } finally {
            // Clean up connection
            this.cdp.reset();
        }
    }
    
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Demonstrate event listening
    async setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        
        // Listen for console messages
        this.cdp.Runtime.addEventListener('consoleAPICalled', (event) => {
            console.log('📢 Console:', event.params.args.map(arg => arg.value).join(' '));
        });
        
        // Listen for page navigation
        this.cdp.Page.addEventListener('frameNavigated', (event) => {
            console.log('🧭 Navigation:', event.params.frame.url);
        });
        
        // Enable the domains to receive events
        await this.cdp.Runtime.enable();
        await this.cdp.Page.enable();
    }
}

// Run the example
async function main() {
    const example = new BROPJavaScriptExample();
    await example.runExample();
}

// Handle both Node.js and browser environments
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('javascript_example.js')) {
    main().catch(console.error);
}

export { BROPJavaScriptExample };