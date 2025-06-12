#!/usr/bin/env node
/**
 * Test Stagehand connecting to BROP bridge instead of launching its own browser
 */

require('dotenv').config({ path: '../.env' });
const { Stagehand } = require('@browserbasehq/stagehand');
const { checkBROPAvailability } = require('./index');

async function testBROPBridgeConnection() {
    console.log('🔗 Testing Stagehand Connection to BROP Bridge');
    console.log('=' + '='.repeat(50));
    
    // First ensure BROP is available
    console.log('📋 Step 1: Checking BROP availability...');
    const availability = await checkBROPAvailability();
    
    if (!availability.available) {
        console.error('❌ BROP is not available:', availability.error);
        console.log('💡 Start BROP bridge server first: cd ../bridge-server && node bridge_server.js');
        process.exit(1);
    }
    
    console.log('✅ BROP bridge server is available');
    
    let stagehand = null;
    
    try {
        console.log('\n📋 Step 2: Connecting Stagehand to BROP bridge...');
        
        // Configure Stagehand to connect to our BROP bridge instead of launching new browser
        stagehand = new Stagehand({
            env: "BROWSERBASE", // Use remote browser connection
            verbose: 1,
            headless: false,
            modelName: "claude-3-sonnet-20240229", // Use Anthropic
            modelClientOptions: {
                apiKey: process.env.ANTHROPIC_API_KEY,
                provider: "anthropic"
            },
            // Connect to BROP's CDP endpoint
            browserbaseSessionCreateParams: {
                // This should connect to our BROP bridge
                projectId: "brop-local", // Custom project
                startUrl: "about:blank"
            },
            // Alternative: try browserWSEndpoint
            browserWSEndpoint: "ws://localhost:9222",
            debugDom: true
        });
        
        console.log('   🔌 Attempting connection to BROP bridge at ws://localhost:9222...');
        
        await stagehand.init();
        console.log('✅ Stagehand connected to BROP bridge!');
        
        console.log('\n📋 Step 3: Testing BROP integration...');
        const page = stagehand.page;
        
        // Navigate to a test page
        await page.goto('https://example.com', { waitUntil: 'networkidle0' });
        console.log('✅ Navigation through BROP bridge successful');
        
        // Check if BROP content script is available
        const bropCheck = await page.evaluate(() => {
            return {
                hasBROP: typeof window.BROP !== 'undefined',
                hasDOMSimplifier: typeof window.DOMSimplifier !== 'undefined',
                hasChrome: typeof chrome !== 'undefined',
                pageUrl: window.location.href,
                userAgent: navigator.userAgent.substring(0, 50) + '...'
            };
        });
        
        console.log('🔍 BROP Integration Check:');
        console.log(`   BROP Content Script: ${bropCheck.hasBROP ? '✅ AVAILABLE' : '❌ NOT FOUND'}`);
        console.log(`   DOM Simplifier: ${bropCheck.hasDOMSimplifier ? '✅ AVAILABLE' : '❌ NOT FOUND'}`);
        console.log(`   Chrome APIs: ${bropCheck.hasChrome ? '✅ AVAILABLE' : '❌ NOT FOUND'}`);
        console.log(`   Page URL: ${bropCheck.pageUrl}`);
        
        console.log('\n📋 Step 4: Testing AI through BROP bridge...');
        
        try {
            const aiResult = await page.observe({
                instruction: "Find all clickable elements on this page"
            });
            
            console.log('✅ AI observation through BROP bridge successful!');
            console.log(`🎯 AI found ${aiResult.length} clickable elements`);
            
            if (aiResult.length > 0) {
                console.log('   Top elements found:');
                aiResult.slice(0, 3).forEach((element, i) => {
                    console.log(`   ${i + 1}. ${element.description}`);
                });
            }
            
        } catch (aiError) {
            console.log(`❌ AI observation failed: ${aiError.message}`);
            
            if (aiError.message.includes('createChatCompletion')) {
                console.log('   🔧 This is still the API client configuration issue');
            }
        }
        
        console.log('\n📋 Step 5: Testing direct BROP simplified DOM...');
        
        // Test BROP simplified DOM independently
        const WebSocket = require('ws');
        
        const domTest = await new Promise((resolve) => {
            const ws = new WebSocket('ws://localhost:9223');
            let resolved = false;
            
            ws.on('open', () => {
                const message = {
                    id: 'bridge-connection-test',
                    command: {
                        type: 'get_simplified_dom',
                        max_depth: 3
                    }
                };
                ws.send(JSON.stringify(message));
            });
            
            ws.on('message', (data) => {
                if (resolved) return;
                resolved = true;
                
                try {
                    const response = JSON.parse(data.toString());
                    ws.close();
                    resolve({
                        success: response.success,
                        error: response.error,
                        hasResult: !!response.result
                    });
                } catch (error) {
                    ws.close();
                    resolve({ success: false, error: error.message });
                }
            });
            
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    ws.close();
                    resolve({ success: false, error: 'timeout' });
                }
            }, 5000);
        });
        
        if (domTest.success) {
            console.log('✅ BROP simplified DOM working independently');
        } else {
            console.log(`❌ BROP simplified DOM failed: ${domTest.error}`);
        }
        
        console.log('\n🎯 Bridge Connection Test Results:');
        console.log('=' + '='.repeat(40));
        
        if (bropCheck.hasBROP) {
            console.log('🎉 SUCCESS: Stagehand connected to BROP-enabled browser!');
            console.log('✅ BROP content script available in Stagehand browser');
            console.log('✅ AI + BROP simplified DOM integration possible');
        } else {
            console.log('⚠️ PARTIAL: Stagehand connected but BROP content script not available');
            console.log('🔧 Possible solutions:');
            console.log('   1. BROP extension not loaded in target browser');
            console.log('   2. Stagehand still launching separate browser instance');
            console.log('   3. Need to configure Stagehand connection parameters');
        }
        
    } catch (error) {
        console.error('❌ Bridge connection test failed:', error.message);
        
        if (error.message.includes('browserWSEndpoint')) {
            console.log('\n💡 Connection issue detected');
            console.log('   Stagehand may not support direct WebSocket connection');
            console.log('   Alternative: Use Playwright directly with BROP bridge');
        } else if (error.message.includes('BROWSERBASE')) {
            console.log('\n💡 Browserbase configuration issue');
            console.log('   Need different connection method for local BROP bridge');
        }
    } finally {
        if (stagehand) {
            try {
                await stagehand.close();
                console.log('\n🔚 Stagehand closed successfully');
            } catch (error) {
                console.error('⚠️ Error closing Stagehand:', error.message);
            }
        }
    }
}

testBROPBridgeConnection();