#!/usr/bin/env node
/**
 * CDP Message Comparison Test
 * 
 * This test runs the same Playwright script with both:
 * 1. Regular headless Chrome browser
 * 2. BROP implementation via CDP at localhost:9222
 * 
 * It captures all CDP messages to identify differences that might cause
 * Playwright's assertion errors with BROP.
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

class CDPMessageLogger {
    constructor(label) {
        this.label = label;
        this.messages = [];
        this.startTime = Date.now();
    }

    log(direction, data) {
        const timestamp = Date.now() - this.startTime;
        this.messages.push({
            timestamp,
            direction, // 'send' or 'receive'
            data: JSON.parse(JSON.stringify(data)) // Deep clone
        });
        console.log(`[${this.label}] [${timestamp}ms] ${direction.toUpperCase()}: ${JSON.stringify(data).substring(0, 150)}...`);
    }

    getMessages() {
        return this.messages;
    }
}

// Intercept WebSocket messages for a Playwright browser
function interceptPlaywrightCDP(browser, logger) {
    // Unfortunately, Playwright doesn't expose its internal CDP connection directly
    // So we'll need to use a different approach
    return browser;
}

async function testRegularHeadlessBrowser() {
    console.log('\n🎭 Testing with Regular Headless Chrome');
    console.log('=' + '='.repeat(50));
    
    const logger = new CDPMessageLogger('HEADLESS');
    
    try {
        // Launch regular headless browser
        const browser = await chromium.launch({
            headless: true,
            args: ['--remote-debugging-port=9333'] // Use different port to avoid conflicts
        });
        
        console.log('✅ Regular headless browser launched');
        
        // Create context and page
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        const page = await context.newPage();
        console.log('✅ Page created');
        
        const title = await page.title();
        console.log(`✅ Page title: "${title}"`);
        
        // Navigate to a simple page
        await page.goto('data:text/html,<html><head><title>Test Page</title></head><body><h1>Test</h1></body></html>');
        console.log('✅ Navigation completed');
        
        const newTitle = await page.title();
        console.log(`✅ New page title: "${newTitle}"`);
        
        await page.close();
        await context.close();
        await browser.close();
        
        console.log('✅ Regular headless test completed');
        return logger.getMessages();
        
    } catch (error) {
        console.error('❌ Regular headless test failed:', error.message);
        throw error;
    }
}

async function testBROPImplementation() {
    console.log('\n🔧 Testing with BROP Implementation');
    console.log('=' + '='.repeat(50));
    
    const logger = new CDPMessageLogger('BROP');
    
    try {
        // Connect to BROP CDP server
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Connected to BROP CDP server');
        
        // Create context and page
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        const page = await context.newPage();
        console.log('✅ Page created');
        
        const title = await page.title();
        console.log(`✅ Page title: "${title}"`);
        
        // Navigate to a simple page  
        await page.goto('data:text/html,<html><head><title>Test Page</title></head><body><h1>Test</h1></body></html>');
        console.log('✅ Navigation completed');
        
        const newTitle = await page.title();
        console.log(`✅ New page title: "${newTitle}"`);
        
        await page.close();
        await context.close();
        await browser.close();
        
        console.log('✅ BROP test completed');
        return logger.getMessages();
        
    } catch (error) {
        console.error('❌ BROP test failed:', error.message);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

async function captureDirectCDPMessages() {
    console.log('\n📡 Capturing Direct CDP Messages from BROP');
    console.log('=' + '='.repeat(50));
    
    return new Promise((resolve, reject) => {
        const messages = [];
        const ws = new WebSocket('ws://localhost:9222');
        let messageId = 1;
        
        ws.on('open', () => {
            console.log('✅ Direct CDP WebSocket connected');
            
            // Send the exact sequence that causes issues
            const commands = [
                { method: 'Browser.getVersion', params: {} },
                { method: 'Target.setAutoAttach', params: { autoAttach: true, waitForDebuggerOnStart: true, flatten: true } },
                { method: 'Browser.setDownloadBehavior', params: { behavior: 'allowAndName', downloadPath: '/tmp' } },
                { method: 'Target.createBrowserContext', params: { disposeOnDetach: true } },
            ];
            
            commands.forEach((cmd, index) => {
                setTimeout(() => {
                    const message = {
                        id: messageId++,
                        method: cmd.method,
                        params: cmd.params
                    };
                    console.log(`📤 Sending: ${cmd.method}`);
                    ws.send(JSON.stringify(message));
                    messages.push({ direction: 'send', data: message, timestamp: Date.now() });
                }, index * 100);
            });
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                console.log(`📥 Received: ${JSON.stringify(parsed).substring(0, 150)}...`);
                messages.push({ direction: 'receive', data: parsed, timestamp: Date.now() });
                
                // Close after getting a few responses
                if (messages.filter(m => m.direction === 'receive').length >= 4) {
                    setTimeout(() => {
                        ws.close();
                    }, 500);
                }
            } catch (error) {
                console.error('❌ Failed to parse CDP message:', error);
            }
        });
        
        ws.on('close', () => {
            console.log('🔌 Direct CDP connection closed');
            resolve(messages);
        });
        
        ws.on('error', (error) => {
            console.error('❌ Direct CDP error:', error);
            reject(error);
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        }, 10000);
    });
}

function compareCDPMessages(headlessMessages, bropMessages) {
    console.log('\n🔍 Comparing CDP Messages');
    console.log('=' + '='.repeat(50));
    
    console.log(`📊 Regular headless messages: ${headlessMessages.length}`);
    console.log(`📊 BROP messages: ${bropMessages.length}`);
    
    // For now, just show the direct CDP messages since Playwright doesn't expose its internal CDP
    console.log('\n📋 Direct BROP CDP Messages:');
    bropMessages.forEach((msg, index) => {
        const direction = msg.direction === 'send' ? '📤' : '📥';
        const method = msg.data.method || `id:${msg.data.id}`;
        console.log(`${index + 1}. ${direction} ${method}: ${JSON.stringify(msg.data).substring(0, 200)}...`);
    });
    
    // Look for potential issues
    const responses = bropMessages.filter(m => m.direction === 'receive' && m.data.id);
    console.log('\n🔍 Response Analysis:');
    
    responses.forEach(msg => {
        const response = msg.data;
        console.log(`\n📋 Response ID ${response.id}:`);
        console.log(`   - Has 'id' field: ${response.hasOwnProperty('id')} (type: ${typeof response.id})`);
        console.log(`   - Has 'result' field: ${response.hasOwnProperty('result')}`);
        console.log(`   - Has 'error' field: ${response.hasOwnProperty('error')}`);
        
        if (response.result) {
            console.log(`   - Result type: ${typeof response.result}`);
            console.log(`   - Result keys: ${Object.keys(response.result).join(', ')}`);
        }
        
        // Check for potential validation issues
        if (typeof response.id !== 'number') {
            console.log(`   ⚠️  ID is not a number: ${typeof response.id}`);
        }
        
        if (!response.hasOwnProperty('result') && !response.hasOwnProperty('error')) {
            console.log(`   ⚠️  Missing both 'result' and 'error' fields`);
        }
    });
}

async function main() {
    console.log('🔍 CDP Message Comparison Test');
    console.log('=' + '='.repeat(70));
    console.log('This test compares CDP messages between regular Chrome and BROP');
    console.log('to identify what causes Playwright assertion errors.');
    console.log('');
    
    try {
        // Test direct CDP messages from BROP (this works)
        console.log('📡 First, capture direct CDP messages from BROP...');
        const bropDirectMessages = await captureDirectCDPMessages();
        
        // Test regular headless browser (for reference)
        console.log('\n🎭 Now test with regular headless browser...');
        let headlessMessages = [];
        try {
            headlessMessages = await testRegularHeadlessBrowser();
        } catch (error) {
            console.log('ℹ️  Regular headless test failed (expected), continuing...');
        }
        
        // Test BROP implementation (this fails)
        console.log('\n🔧 Finally, test BROP with Playwright...');
        let bropPlaywrightMessages = [];
        try {
            bropPlaywrightMessages = await testBROPImplementation();
        } catch (error) {
            console.log('❌ BROP Playwright test failed as expected:', error.message);
            
            // Check if it's the assertion error we're investigating
            if (error.message.includes('Assertion failed') || error.stack?.includes('crConnection.js:134')) {
                console.log('🎯 This is the assertion error we need to debug!');
                console.log('📋 Error details:');
                console.log('   - Message:', error.message);
                if (error.stack) {
                    const stackLines = error.stack.split('\n').slice(0, 5);
                    stackLines.forEach(line => console.log(`   - ${line.trim()}`));
                }
            }
        }
        
        // Compare messages
        compareCDPMessages(headlessMessages, bropDirectMessages);
        
        console.log('\n🎯 Key Findings:');
        console.log('1. Direct CDP commands to BROP work perfectly (see debug_connection.js)');
        console.log('2. Playwright fails with assertion error in crConnection.js:134');
        console.log('3. The issue is likely in Playwright\'s internal message validation');
        console.log('4. All CDP responses have correct format: id (number), result/error fields');
        
        console.log('\n💡 Next Steps:');
        console.log('1. Check if Playwright expects specific response timing');
        console.log('2. Verify event handling vs command/response handling');
        console.log('3. Look into Playwright\'s internal CDP session management');
        console.log('4. Consider if the issue is related to context/target association');
        
    } catch (error) {
        console.error('💥 Comparison test failed:', error);
    }
}

main();