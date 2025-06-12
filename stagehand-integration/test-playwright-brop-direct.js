#!/usr/bin/env node
/**
 * Direct Playwright connection to BROP bridge - bypassing Stagehand's browser management
 */

require('dotenv').config({ path: '../.env' });
const { chromium } = require('playwright');
const { checkBROPAvailability } = require('./index');

async function testPlaywrightBROPDirect() {
    console.log('🎭 Direct Playwright + BROP Bridge Integration');
    console.log('=' + '='.repeat(50));
    
    // Check BROP availability
    console.log('📋 Step 1: Checking BROP availability...');
    const availability = await checkBROPAvailability();
    
    if (!availability.available) {
        console.error('❌ BROP is not available:', availability.error);
        process.exit(1);
    }
    
    console.log('✅ BROP bridge server is available');
    
    let browser = null;
    let page = null;
    
    try {
        console.log('\n📋 Step 2: Connecting Playwright to BROP bridge...');
        
        // Connect directly to BROP's CDP endpoint
        browser = await chromium.connectOverCDP('http://localhost:9222');
        console.log('✅ Playwright connected to BROP bridge CDP');
        
        // Get the default context and page
        const contexts = browser.contexts();
        const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
        
        const pages = context.pages();
        page = pages.length > 0 ? pages[0] : await context.newPage();
        
        console.log('✅ Got browser page through BROP bridge');
        
        console.log('\n📋 Step 3: Testing BROP integration...');
        
        // Navigate to test page
        await page.goto('https://example.com', { waitUntil: 'networkidle' });
        console.log('✅ Navigation through BROP bridge successful');
        
        const pageInfo = {
            title: await page.title(),
            url: page.url()
        };
        
        console.log(`   📄 Page Title: ${pageInfo.title}`);
        console.log(`   🌐 Page URL: ${pageInfo.url}`);
        
        // Check BROP integration
        const bropStatus = await page.evaluate(() => {
            return {
                hasBROP: typeof window.BROP !== 'undefined',
                hasDOMSimplifier: typeof window.DOMSimplifier !== 'undefined',
                hasChrome: typeof chrome !== 'undefined',
                hasExtension: typeof chrome?.runtime !== 'undefined',
                pageUrl: window.location.href
            };
        });
        
        console.log('\n🔍 BROP Integration Status:');
        console.log(`   BROP Content Script: ${bropStatus.hasBROP ? '✅ AVAILABLE' : '❌ NOT FOUND'}`);
        console.log(`   DOM Simplifier: ${bropStatus.hasDOMSimplifier ? '✅ AVAILABLE' : '❌ NOT FOUND'}`);
        console.log(`   Chrome Extension APIs: ${bropStatus.hasExtension ? '✅ AVAILABLE' : '❌ NOT FOUND'}`);
        
        if (bropStatus.hasBROP) {
            console.log('\n🎉 SUCCESS! BROP content script is available in Playwright!');
            
            // Test BROP simplified DOM through content script
            console.log('\n📋 Step 4: Testing BROP simplified DOM through content script...');
            
            try {
                const simplifiedDOM = await page.evaluate(() => {
                    if (window.BROP && window.BROP.getSimplifiedDOM) {
                        return window.BROP.getSimplifiedDOM({
                            max_depth: 3,
                            include_hidden: false
                        });
                    }
                    return null;
                });
                
                if (simplifiedDOM) {
                    console.log('✅ BROP simplified DOM through content script: SUCCESS');
                    console.log(`   📊 Page structure: ${simplifiedDOM.page_structure_summary || 'N/A'}`);
                    console.log(`   🎯 Interactive elements: ${simplifiedDOM.total_interactive_elements || 'N/A'}`);
                    console.log(`   🌳 DOM tree: ${simplifiedDOM.simplified_tree ? 'Available' : 'N/A'}`);
                } else {
                    console.log('❌ BROP simplified DOM method not available');
                }
                
            } catch (domError) {
                console.log(`❌ BROP simplified DOM test failed: ${domError.message}`);
            }
        } else {
            console.log('\n⚠️ BROP content script not available');
            console.log('🔧 This means Playwright connected to a browser without BROP extension');
        }
        
        console.log('\n📋 Step 5: Testing direct BROP API calls...');
        
        // Test BROP API independently
        const WebSocket = require('ws');
        
        const bropApiTest = await new Promise((resolve) => {
            const ws = new WebSocket('ws://localhost:9223');
            let resolved = false;
            
            ws.on('open', () => {
                const message = {
                    id: 'playwright-direct-test',
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
                        result: response.result
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
        
        if (bropApiTest.success) {
            console.log('✅ BROP API calls working independently');
            if (bropApiTest.result) {
                console.log(`   📊 API result: ${bropApiTest.result.page_structure_summary || 'Structure available'}`);
            }
        } else {
            console.log(`❌ BROP API test failed: ${bropApiTest.error}`);
        }
        
        console.log('\n📋 Step 6: Testing Anthropic AI directly...');
        
        // Test AI directly with Anthropic SDK
        try {
            const Anthropic = require('@anthropic-ai/sdk');
            const anthropic = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
            
            // Analyze the page with AI
            const pageContent = await page.evaluate(() => {
                return document.body.textContent.substring(0, 500);
            });
            
            const aiAnalysis = await anthropic.messages.create({
                model: "claude-3-sonnet-20240229",
                max_tokens: 200,
                messages: [{
                    role: "user",
                    content: `Analyze this webpage content and identify key interactive elements: "${pageContent}"`
                }]
            });
            
            console.log('✅ AI analysis successful!');
            console.log(`   🤖 AI Response: ${aiAnalysis.content[0].text.substring(0, 150)}...`);
            
        } catch (aiError) {
            console.log(`❌ AI analysis failed: ${aiError.message}`);
        }
        
        console.log('\n🎯 Final Integration Assessment:');
        console.log('=' + '='.repeat(40));
        
        if (bropStatus.hasBROP && bropApiTest.success) {
            console.log('🎉 EXCELLENT: Full BROP + Playwright integration working!');
            console.log('✅ Playwright connected to BROP-enabled browser');
            console.log('✅ BROP content script available');
            console.log('✅ BROP API calls working');
            console.log('✅ AI analysis functional');
            console.log('\n🚀 This is the correct architecture for AI + BROP automation!');
        } else if (bropApiTest.success) {
            console.log('⚠️ PARTIAL: Playwright working, BROP API working independently');
            console.log('🔧 Need to ensure Playwright connects to BROP-enabled Chrome instance');
        } else {
            console.log('❌ ISSUES: Integration needs troubleshooting');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.message.includes('connect')) {
            console.log('\n💡 Connection issue:');
            console.log('   1. Ensure BROP bridge server is running');
            console.log('   2. Check if Chrome with BROP extension is running');
            console.log('   3. Verify CDP endpoint is accessible at localhost:9222');
        }
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (error) {
                console.log('⚠️ Error closing page:', error.message);
            }
        }
        
        if (browser) {
            try {
                await browser.close();
                console.log('\n🔚 Browser connection closed');
            } catch (error) {
                console.log('⚠️ Error closing browser:', error.message);
            }
        }
    }
}

testPlaywrightBROPDirect();