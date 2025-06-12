#!/usr/bin/env node
/**
 * BROP Node.js CDP Example
 * 
 * This example shows how to use the BROP CDP client in Node.js
 * to control the browser through the BROP extension.
 */

const WebSocket = require('ws');
const fs = require('fs');

// Make WebSocket available globally for our CDP client
global.WebSocket = WebSocket;

// Simple CDP client implementation for Node.js
class NodeBROPCDPClient {
    constructor(wsUrl = 'ws://localhost:9222') {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.pendingRequests = new Map();
        this.nextRequestId = 0;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.on('open', () => {
                console.log('🔗 Connected to BROP bridge server');
                resolve();
            });
            
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse message:', error);
                }
            });
            
            this.ws.on('close', () => {
                console.log('🔌 Disconnected from BROP bridge server');
            });
            
            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });
        });
    }

    async sendCommand(method, params = {}) {
        const id = this.nextRequestId++;
        const message = { id, method, params };
        
        console.log(`📤 ${method}`);
        this.ws.send(JSON.stringify(message));
        
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Timeout waiting for ${method}`));
                }
            }, 10000);
        });
    }

    handleMessage({ id, result, error, method, params }) {
        if (id !== undefined && this.pendingRequests.has(id)) {
            const { resolve, reject } = this.pendingRequests.get(id);
            this.pendingRequests.delete(id);
            
            if (error) {
                console.log(`📥 ERROR: ${error.message}`);
                reject(new Error(error.message));
            } else {
                console.log(`📥 SUCCESS`);
                resolve(result);
            }
        }
        
        if (method) {
            console.log(`📡 Event: ${method}`);
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

class BROPNodeExample {
    constructor() {
        this.cdp = new NodeBROPCDPClient();
    }

    async runExample() {
        console.log('🚀 BROP Node.js CDP Example');
        console.log('=' + '='.repeat(50));
        
        try {
            // Connect to the bridge server
            await this.cdp.connect();
            
            // Get browser version
            console.log('\n📋 Getting browser version...');
            const version = await this.cdp.sendCommand('Browser.getVersion');
            console.log(`   Browser: ${version.product}`);
            console.log(`   Protocol: ${version.protocolVersion}`);
            
            // Get available targets
            console.log('\n🎯 Getting available targets...');
            const targetsResponse = await this.cdp.sendCommand('Target.getTargets');
            const targets = targetsResponse.targetInfos || [];
            const pageTargets = targets.filter(t => t.type === 'page');
            
            console.log(`   Found ${pageTargets.length} page targets:`);
            pageTargets.forEach((target, index) => {
                console.log(`   ${index + 1}. ${target.title} (${target.url})`);
            });
            
            // Use first available target or create new one
            let targetId;
            if (pageTargets.length > 0) {
                targetId = pageTargets[0].targetId;
                console.log(`\n📄 Using existing target: ${targetId}`);
            } else {
                console.log('\n📄 Creating new target...');
                const newTarget = await this.cdp.sendCommand('Target.createTarget', {
                    url: 'about:blank'
                });
                targetId = newTarget.targetId;
                console.log(`   Created target: ${targetId}`);
            }
            
            // Navigate to a website
            console.log('\n🌐 Navigating to example.com...');
            await this.cdp.sendCommand('Page.navigate', { 
                url: 'https://example.com' 
            });
            
            // Wait for page to load
            console.log('   ⏳ Waiting for page to load...');
            await this.sleep(3000);
            
            // Get page title
            console.log('\n🔍 Getting page information...');
            const titleResult = await this.cdp.sendCommand('Runtime.evaluate', {
                expression: 'document.title',
                returnByValue: true
            });
            console.log(`   Title: ${titleResult.result.value}`);
            
            // Get URL
            const urlResult = await this.cdp.sendCommand('Runtime.evaluate', {
                expression: 'window.location.href',
                returnByValue: true
            });
            console.log(`   URL: ${urlResult.result.value}`);
            
            // Count paragraphs
            const paragraphResult = await this.cdp.sendCommand('Runtime.evaluate', {
                expression: 'document.querySelectorAll("p").length',
                returnByValue: true
            });
            console.log(`   Paragraphs: ${paragraphResult.result.value}`);
            
            // Take screenshot
            console.log('\n📸 Taking screenshot...');
            const screenshot = await this.cdp.sendCommand('Page.captureScreenshot', {
                format: 'png'
            });
            
            // Save screenshot
            const screenshotData = Buffer.from(screenshot.data, 'base64');
            fs.writeFileSync('brop_node_screenshot.png', screenshotData);
            console.log(`   💾 Screenshot saved as brop_node_screenshot.png (${screenshotData.length} bytes)`);
            
            // Test JavaScript execution
            console.log('\n📝 Testing JavaScript execution...');
            await this.cdp.sendCommand('Runtime.evaluate', {
                expression: 'console.log("Hello from BROP Node.js client!")',
                returnByValue: true
            });
            console.log('   ✅ Console message sent');
            
            // Highlight first link on page
            console.log('\n🖱️  Testing page interaction...');
            const interactionResult = await this.cdp.sendCommand('Runtime.evaluate', {
                expression: `
                    const links = document.querySelectorAll('a');
                    if (links.length > 0) {
                        links[0].style.backgroundColor = 'yellow';
                        links[0].style.padding = '2px';
                        'Highlighted first link: "' + links[0].textContent.trim() + '"';
                    } else {
                        'No links found on page';
                    }
                `,
                returnByValue: true
            });
            console.log(`   ${interactionResult.result.value}`);
            
            console.log('\n✅ BROP Node.js example completed successfully!');
            console.log('🎉 Browser automation working with Node.js!');
            
        } catch (error) {
            console.error('❌ Example failed:', error.message);
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Make sure the bridge server is running');
            console.error('   2. Make sure the Chrome extension is loaded and connected');
            console.error('   3. Check that ws://localhost:9222 is accessible');
        } finally {
            this.cdp.close();
        }
    }
    
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the example
async function main() {
    const example = new BROPNodeExample();
    await example.runExample();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { BROPNodeExample, NodeBROPCDPClient };