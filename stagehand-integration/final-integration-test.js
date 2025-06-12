#!/usr/bin/env node
/**
 * Final Integration Test - BROP + Playwright + AI
 */

require('dotenv').config({ path: '../.env' });
const { chromium } = require('playwright');
const { checkBROPAvailability } = require('./index');

async function finalIntegrationTest() {
    console.log('🎯 Final BROP + Playwright + AI Integration Test');
    console.log('=' + '='.repeat(50));
    
    let browser = null;
    let page = null;
    let pageElements = null;
    let aiError = null;
    
    try {
        // Step 1: Test BROP Services
        console.log('📋 Step 1: Testing BROP Services...');
        
        const availability = await checkBROPAvailability();
        if (!availability.available) {
            throw new Error(`BROP not available: ${availability.error}`);
        }
        
        console.log('✅ BROP bridge server: CONNECTED');
        
        // Test BROP simplified DOM
        const WebSocket = require('ws');
        
        const bropTest = await new Promise((resolve) => {
            const ws = new WebSocket('ws://localhost:9223');
            let resolved = false;
            
            ws.on('open', () => {
                const message = {
                    id: 'final-test',
                    command: {
                        type: 'get_simplified_dom',
                        max_depth: 3,
                        include_coordinates: true
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
                        result: response.result,
                        error: response.error
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
        
        console.log(`✅ BROP simplified DOM: ${bropTest.success ? 'WORKING' : `FAILED (${bropTest.error})`}`);
        
        // Step 2: Test Playwright
        console.log('\n📋 Step 2: Testing Playwright Browser Automation...');
        
        browser = await chromium.launch({ 
            headless: false,
            devtools: false 
        });
        
        const context = await browser.newContext();
        page = await context.newPage();
        
        await page.goto('https://example.com', { waitUntil: 'networkidle' });
        
        const pageInfo = {
            title: await page.title(),
            url: page.url()
        };
        
        pageElements = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.textContent.trim(),
                href: a.href
            }));
            
            const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
                text: h.textContent.trim(),
                tag: h.tagName.toLowerCase()
            }));
            
            return {
                links,
                headings,
                pageText: document.body.textContent.substring(0, 200)
            };
        });
        
        console.log('✅ Playwright automation: WORKING');
        console.log(`   📄 Page: ${pageInfo.title}`);
        console.log(`   🔗 Links: ${pageElements.links.length}`);
        console.log(`   📰 Headings: ${pageElements.headings.length}`);
        
        // Step 3: Test AI Integration
        console.log('\n📋 Step 3: Testing AI Integration...');
        
        try {
            const Anthropic = require('@anthropic-ai/sdk');
            const anthropic = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
            
            const combinedData = {
                pageTitle: pageInfo.title,
                pageUrl: pageInfo.url,
                bropData: bropTest.result,
                playwrightData: pageElements
            };
            
            const aiPrompt = `Analyze this web page for automation opportunities:

Page: ${combinedData.pageTitle}
URL: ${combinedData.pageUrl}

BROP Analysis:
${combinedData.bropData ? `- Structure: ${combinedData.bropData.page_structure_summary || 'N/A'}
- Interactive elements: ${combinedData.bropData.total_interactive_elements || 'N/A'}` : '- BROP data unavailable'}

Playwright Analysis:
- Links found: ${combinedData.playwrightData.links.length}
- Headings found: ${combinedData.playwrightData.headings.length}
- Page text preview: "${combinedData.playwrightData.pageText.substring(0, 100)}..."

Provide 2 specific automation actions possible on this page.`;
            
            const aiResponse = await anthropic.messages.create({
                model: "claude-3-sonnet-20240229",
                max_tokens: 300,
                messages: [{
                    role: "user", 
                    content: aiPrompt
                }]
            });
            
            console.log('✅ AI analysis: WORKING');
            console.log('🤖 AI Automation Recommendations:');
            console.log(aiResponse.content[0].text);
            
        } catch (error) {
            aiError = error;
            console.log(`❌ AI analysis: FAILED (${error.message})`);
        }
        
        // Step 4: Integration Assessment
        console.log('\n📋 Step 4: Integration Assessment...');
        
        const components = {
            brop: bropTest.success,
            playwright: !!pageElements,
            ai: !aiError
        };
        
        const workingCount = Object.values(components).filter(Boolean).length;
        
        console.log('\n🎯 Component Status:');
        console.log(`   🔧 BROP Services: ${components.brop ? '✅ WORKING' : '❌ FAILED'}`);
        console.log(`   🎭 Playwright: ${components.playwright ? '✅ WORKING' : '❌ FAILED'}`);
        console.log(`   🤖 AI Integration: ${components.ai ? '✅ WORKING' : '❌ FAILED'}`);
        
        console.log(`\n📊 Integration Score: ${workingCount}/3`);
        
        if (workingCount === 3) {
            console.log('\n🎉 EXCELLENT: Full AI-Enhanced Automation Platform!');
            console.log('🚀 Production-Ready Capabilities:');
            console.log('   ✓ BROP simplified DOM analysis');
            console.log('   ✓ Playwright browser control');
            console.log('   ✓ AI-powered decision making');
            console.log('   ✓ Combined intelligent automation');
            
            console.log('\n💡 Ready Use Cases:');
            console.log('   🎯 AI-guided web scraping');
            console.log('   📝 Intelligent form automation');
            console.log('   🔍 Smart content extraction');
            console.log('   🤖 Adaptive testing workflows');
            
        } else if (workingCount === 2) {
            console.log('\n✅ GOOD: Strong automation capabilities available');
            console.log('🔧 One component needs configuration for full integration');
            
        } else {
            console.log('\n⚠️ PARTIAL: Core automation working, integration needs work');
        }
        
        // Demonstrate working workflow
        if (components.playwright && pageElements.links.length > 0) {
            console.log('\n🔄 Workflow Example:');
            const link = pageElements.links[0];
            console.log(`   1. 🔍 Detected link: "${link.text}"`);
            console.log(`   2. 🎯 Target URL: ${link.href}`);
            console.log(`   3. 🎭 Could automate: page.click('text="${link.text}"')`);
            
            if (components.ai) {
                console.log(`   4. 🤖 AI would analyze result and suggest next action`);
            }
            
            if (components.brop) {
                console.log(`   5. 🔧 BROP would provide enhanced DOM context`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        // Cleanup
        if (page) {
            try {
                await page.close();
            } catch (error) {
                console.log('⚠️ Page cleanup error');
            }
        }
        
        if (browser) {
            try {
                await browser.close();
                console.log('\n🔚 Test completed');
            } catch (error) {
                console.log('⚠️ Browser cleanup error');
            }
        }
    }
}

finalIntegrationTest();