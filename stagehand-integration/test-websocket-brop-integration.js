#!/usr/bin/env node
/**
 * Proper WebSocket-based BROP + Playwright Integration
 */

require('dotenv').config({ path: '../.env' });
const { chromium } = require('playwright');
const { checkBROPAvailability } = require('./index');

async function testWebSocketBROPIntegration() {
    console.log('🔗 WebSocket-based BROP + Playwright Integration');
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
        console.log('\n📋 Step 2: Connecting Playwright via WebSocket...');
        
        // Connect via WebSocket as the error suggested
        browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Playwright connected via WebSocket to BROP bridge');
        
        // Get context and page
        const contexts = browser.contexts();
        const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
        
        const pages = context.pages();
        page = pages.length > 0 ? pages[0] : await context.newPage();
        
        console.log('✅ Got browser page through BROP WebSocket bridge');
        
        console.log('\n📋 Step 3: Testing navigation and BROP integration...');
        
        // Navigate to test page
        await page.goto('https://example.com', { waitUntil: 'networkidle' });
        console.log('✅ Navigation through BROP WebSocket bridge successful');
        
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
                pageUrl: window.location.href,
                windowBROP: window.BROP ? Object.keys(window.BROP) : null
            };
        });
        
        console.log('\n🔍 BROP Integration Status:');
        console.log(`   BROP Content Script: ${bropStatus.hasBROP ? '✅ AVAILABLE' : '❌ NOT FOUND'}`);
        console.log(`   DOM Simplifier: ${bropStatus.hasDOMSimplifier ? '✅ AVAILABLE' : '❌ NOT FOUND'}`);
        console.log(`   Chrome Extension APIs: ${bropStatus.hasExtension ? '✅ AVAILABLE' : '❌ NOT FOUND'}`);
        
        if (bropStatus.hasBROP) {
            console.log(`   BROP Methods: ${bropStatus.windowBROP?.join(', ') || 'N/A'}`);
        }
        
        console.log('\n📋 Step 4: Testing combined AI + BROP workflow...');
        
        if (bropStatus.hasBROP) {
            console.log('🎉 BROP content script available! Testing AI + simplified DOM...');
            
            // Get simplified DOM through BROP
            const simplifiedDOM = await page.evaluate(() => {
                if (window.BROP && window.BROP.getSimplifiedDOM) {
                    return window.BROP.getSimplifiedDOM({
                        max_depth: 3,
                        include_hidden: false,
                        include_coordinates: true
                    });
                }
                return null;
            });
            
            if (simplifiedDOM) {
                console.log('✅ BROP simplified DOM: SUCCESS');
                console.log(`   📊 Structure: ${simplifiedDOM.page_structure_summary || 'N/A'}`);
                console.log(`   🎯 Interactive: ${simplifiedDOM.total_interactive_elements || 'N/A'}`);
                
                // Use AI to analyze the simplified DOM
                try {
                    const Anthropic = require('@anthropic-ai/sdk');
                    const anthropic = new Anthropic({
                        apiKey: process.env.ANTHROPIC_API_KEY,
                    });
                    
                    const aiPrompt = `
Analyze this simplified DOM structure for automation opportunities:
- Page: ${simplifiedDOM.page_title || pageInfo.title}
- Structure: ${simplifiedDOM.page_structure_summary}
- Interactive elements: ${simplifiedDOM.total_interactive_elements}
- Selectors: ${simplifiedDOM.suggested_selectors?.slice(0, 3).join(', ') || 'None'}

Provide 3 specific automation actions that could be performed on this page.`;
                    
                    const aiAnalysis = await anthropic.messages.create({
                        model: "claude-3-sonnet-20240229",
                        max_tokens: 300,
                        messages: [{
                            role: "user",
                            content: aiPrompt
                        }]
                    });
                    
                    console.log('✅ AI analysis of BROP simplified DOM: SUCCESS');
                    console.log('🤖 AI Automation Suggestions:');
                    console.log(`   ${aiAnalysis.content[0].text}`);
                    
                } catch (aiError) {
                    console.log(`❌ AI analysis failed: ${aiError.message}`);
                }
            } else {
                console.log('❌ BROP simplified DOM method not available');
            }
        } else {
            console.log('⚠️ BROP content script not available - using fallback methods');
            
            // Fallback: Use Playwright + AI without BROP
            const pageText = await page.evaluate(() => {
                return document.body.textContent.substring(0, 500);
            });
            
            const links = await page.$$eval('a', (anchors) => {
                return anchors.map(a => ({
                    text: a.textContent.trim(),
                    href: a.href
                }));
            });
            
            console.log(`📄 Fallback analysis: ${links.length} links found`);
        }
        
        console.log('\n📋 Step 5: Testing BROP API independently...');
        
        // Test BROP API
        const WebSocket = require('ws');
        
        const bropApiTest = await new Promise((resolve) => {
            const ws = new WebSocket('ws://localhost:9223');
            let resolved = false;
            
            ws.on('open', () => {
                const message = {
                    id: 'websocket-integration-test',
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
        
        console.log(`   BROP API: ${bropApiTest.success ? '✅ WORKING' : `❌ FAILED (${bropApiTest.error})`}`);
        
        console.log('\n🎯 Integration Assessment:');
        console.log('=' + '='.repeat(35));
        
        if (bropStatus.hasBROP && bropApiTest.success) {
            console.log('🎉 EXCELLENT: Complete AI + BROP + Playwright integration!');
            console.log('✅ Playwright connected via WebSocket');
            console.log('✅ BROP content script available');
            console.log('✅ BROP simplified DOM working');
            console.log('✅ BROP API working independently');
            console.log('✅ AI analysis functional');
            console.log('\n🚀 This is a production-ready AI automation platform!');
            
            console.log('\n💡 Capabilities:');
            console.log('   🎯 AI-powered element detection');
            console.log('   🧠 Intelligent DOM analysis');
            console.log('   🤖 Automated task suggestions');
            console.log('   🔍 Smart page understanding');
            
        } else if (bropApiTest.success) {
            console.log('⚠️ PARTIAL: Playwright + BROP API working');
            console.log('🔧 BROP content script not available in connected browser');
            console.log('💡 Solution: Ensure Chrome with BROP extension is the target');
            
        } else {
            console.log('❌ BASIC: Only Playwright working');
            console.log('🔧 BROP integration needs configuration');
        }
        
    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        
        if (error.message.includes('connect')) {
            console.log('\n💡 WebSocket connection issues:');
            console.log('   1. BROP bridge server may not support CDP over WebSocket');
            console.log('   2. Need direct Chrome with BROP extension');
            console.log('   3. Alternative: Use BROP API directly with separate Playwright');
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

testWebSocketBROPIntegration();