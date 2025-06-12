#!/usr/bin/env node
/**
 * Working BROP + AI Integration Demo
 * Shows how to properly combine BROP, Playwright, and AI
 */

require('dotenv').config({ path: '../.env' });
const { chromium } = require('playwright');
const { checkBROPAvailability } = require('./index');

async function workingIntegrationDemo() {
    console.log('🚀 Working BROP + AI Integration Demo');
    console.log('=' + '='.repeat(45));
    
    console.log('📋 Architecture Overview:');
    console.log('   🎭 Playwright: Browser automation and control');
    console.log('   🔧 BROP: Advanced DOM analysis and simplification');
    console.log('   🤖 AI: Intelligent analysis and decision making');
    console.log('   🔗 Integration: Combining all three for powerful automation');
    
    // Step 1: Verify BROP is available
    console.log('\n📋 Step 1: Verifying BROP Services...');
    const availability = await checkBROPAvailability();
    
    if (!availability.available) {
        console.error('❌ BROP is not available:', availability.error);
        process.exit(1);
    }
    
    console.log('✅ BROP bridge server: ONLINE');
    
    // Test BROP simplified DOM
    const WebSocket = require('ws');
    
    const bropDOMTest = await new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9223');
        let resolved = false;
        
        ws.on('open', () => {
            // First navigate to a page through BROP
            const navMessage = {
                id: 'demo-nav',
                command: {
                    type: 'navigate',
                    url: 'https://example.com'
                }
            };
            ws.send(JSON.stringify(navMessage));
        });
        
        ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                
                if (response.id === 'demo-nav' && response.success) {
                    // Now test simplified DOM
                    setTimeout(() => {
                        const domMessage = {
                            id: 'demo-dom',
                            command: {
                                type: 'get_simplified_dom',
                                max_depth: 4,
                                include_coordinates: true
                            }
                        };
                        ws.send(JSON.stringify(domMessage));
                    }, 2000); // Wait for page load
                    
                } else if (response.id === 'demo-dom') {
                    if (!resolved) {
                        resolved = true;
                        ws.close();
                        resolve({
                            success: response.success,
                            error: response.error,
                            result: response.result
                        });
                    }
                }
            } catch (error) {
                if (!resolved) {
                    resolved = true;
                    ws.close();
                    resolve({ success: false, error: error.message });
                }
            }
        });
        
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                ws.close();
                resolve({ success: false, error: 'timeout' });
            }
        }, 10000);
    });
    
    if (bropDOMTest.success) {
        console.log('✅ BROP simplified DOM: WORKING');
        
        if (bropDOMTest.result) {
            console.log(`   📊 Page: ${bropDOMTest.result.page_title || 'N/A'}`);
            console.log(`   🎯 Interactive elements: ${bropDOMTest.result.total_interactive_elements || 'N/A'}`);
            console.log(`   📋 Structure: ${bropDOMTest.result.page_structure_summary || 'N/A'}`);
        }
    } else {
        console.log(`❌ BROP simplified DOM: FAILED (${bropDOMTest.error})`);
    }
    
    // Step 2: Test independent Playwright automation
    console.log('\n📋 Step 2: Testing Playwright Automation...');
    
    let browser = null;
    let page = null;
    
    try {
        // Launch independent Playwright browser
        browser = await chromium.launch({ 
            headless: false,
            devtools: false 
        });
        
        const context = await browser.newContext();
        page = await context.newPage();
        
        console.log('✅ Playwright browser: LAUNCHED');
        
        // Navigate to test page
        await page.goto('https://example.com', { waitUntil: 'networkidle' });
        
        const pageInfo = {
            title: await page.title(),
            url: page.url()
        };
        
        console.log('✅ Playwright navigation: SUCCESS');
        console.log(`   📄 Title: ${pageInfo.title}`);
        console.log(`   🌐 URL: ${pageInfo.url}`);
        
        // Extract page elements
        const pageElements = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.textContent.trim(),
                href: a.href,
                type: 'link'
            }));
            
            const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
                text: btn.textContent.trim() || btn.value,
                type: 'button'
            }));
            
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
                text: h.textContent.trim(),
                tag: h.tagName.toLowerCase(),
                type: 'heading'
            }));
            
            return {
                links,
                buttons,
                headings,
                pageText: document.body.textContent.substring(0, 300)
            };
        });
        
        console.log('✅ Playwright element extraction: SUCCESS');
        console.log(`   🔗 Links: ${pageElements.links.length}`);
        console.log(`   🔘 Buttons: ${pageElements.buttons.length}`);
        console.log(`   📰 Headings: ${pageElements.headings.length}`);
        
    } catch (playwrightError) {
        console.log(`❌ Playwright test failed: ${playwrightError.message}`);
    }
    
    // Step 3: Test AI Analysis
    console.log('\n📋 Step 3: Testing AI Analysis...');
    
    try {
        const Anthropic = require('@anthropic-ai/sdk');
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        
        // Combine BROP and Playwright data for AI analysis
        const analysisData = {
            brop: bropDOMTest.result,
            playwright: page ? pageElements : null,
            pageTitle: bropDOMTest.result?.page_title || pageElements?.headings?.[0]?.text || 'Unknown'
        };
        
        const aiPrompt = `
Analyze this web page data for automation opportunities:

BROP Analysis:
- Page: ${analysisData.brop?.page_title || 'N/A'}
- Structure: ${analysisData.brop?.page_structure_summary || 'N/A'}
- Interactive elements: ${analysisData.brop?.total_interactive_elements || 'N/A'}

Playwright Analysis:
- Links found: ${analysisData.playwright?.links?.length || 'N/A'}
- Buttons found: ${analysisData.playwright?.buttons?.length || 'N/A'}
- Headings: ${analysisData.playwright?.headings?.length || 'N/A'}

Provide 3 specific automation tasks that could be performed on this page.`;
        
        const aiAnalysis = await anthropic.messages.create({
            model: "claude-3-sonnet-20240229",
            max_tokens: 400,
            messages: [{
                role: "user",
                content: aiPrompt
            }]
        });
        
        console.log('✅ AI analysis: SUCCESS');
        console.log('🤖 AI Automation Recommendations:');
        console.log(aiAnalysis.content[0].text);
        
    } catch (aiError) {
        console.log(`❌ AI analysis failed: ${aiError.message}`);
        
        if (aiError.message.includes('API key')) {
            console.log('   🔑 Check ANTHROPIC_API_KEY in .env file');
        }
    }
    
    // Step 4: Demonstrate Combined Workflow
    console.log('\n📋 Step 4: Combined Workflow Demo...');
    
    if (bropDOMTest.success && page && !aiError) {
        console.log('🎉 FULL INTEGRATION POSSIBLE!');
        console.log('\n🔄 Workflow Example:');
        console.log('   1. 🔧 BROP analyzes page structure and suggests elements');
        console.log('   2. 🎭 Playwright performs precise browser actions');
        console.log('   3. 🤖 AI makes intelligent decisions about next steps');
        console.log('   4. 🔁 Loop continues for complex automation tasks');
        
        // Example combined action
        if (pageElements && pageElements.links.length > 0) {
            const firstLink = pageElements.links[0];
            console.log(`\n📎 Example: Could click link "${firstLink.text}" at ${firstLink.href}`);
            
            // Don't actually click to avoid navigating away
            console.log('   (Action simulation - not actually performed)');
        }
        
    } else {
        console.log('⚠️ PARTIAL INTEGRATION AVAILABLE');
        console.log('   Individual components working, some integration possible');
    }
    
    // Final Assessment
    console.log('\n🎯 Integration Assessment:');
    console.log('=' + '='.repeat(30));
    
    const status = {
        brop: bropDOMTest.success,
        playwright: !!page,
        ai: !aiError
    };
    
    console.log(`🔧 BROP Services: ${status.brop ? '✅ WORKING' : '❌ ISSUES'}`);
    console.log(`🎭 Playwright Automation: ${status.playwright ? '✅ WORKING' : '❌ ISSUES'}`);
    console.log(`🤖 AI Analysis: ${status.ai ? '✅ WORKING' : '❌ ISSUES'}`);
    
    const workingComponents = Object.values(status).filter(Boolean).length;
    
    console.log(`\n📊 Integration Score: ${workingComponents}/3 components working`);
    
    if (workingComponents === 3) {
        console.log('🎉 EXCELLENT: Full AI-powered automation platform ready!');
        console.log('🚀 Ready for production use cases:');
        console.log('   • Intelligent web scraping');
        console.log('   • AI-guided form filling');
        console.log('   • Smart page navigation');
        console.log('   • Automated testing with AI insights');
    } else if (workingComponents >= 2) {
        console.log('✅ GOOD: Strong automation capabilities available');
        console.log('🔧 Minor configuration needed for full integration');
    } else {
        console.log('⚠️ BASIC: Individual components need attention');
    }
    
    // Cleanup
    if (page) {
        try {
            await page.close();
        } catch (error) {
            console.log('⚠️ Page cleanup error:', error.message);
        }
    }
    
    if (browser) {
        try {
            await browser.close();
            console.log('\n🔚 Demo completed successfully');
        } catch (error) {
            console.log('⚠️ Browser cleanup error:', error.message);
        }
    }
}

workingIntegrationDemo().catch(error => {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
});