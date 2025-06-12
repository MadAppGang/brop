#!/usr/bin/env node
/**
 * Comprehensive BROP + Stagehand Integration Test
 * Tests both BROP simplified DOM and Stagehand browser automation
 */

require('dotenv').config({ path: '../.env' });
const { Stagehand } = require('@browserbasehq/stagehand');
const { checkBROPAvailability } = require('./index');
const WebSocket = require('ws');

async function comprehensiveTest() {
    console.log('🚀 Comprehensive BROP + Stagehand Integration Test');
    console.log('=' + '='.repeat(55));
    
    const results = {
        brop: { available: false, simplifiedDOM: false },
        stagehand: { initialized: false, automation: false },
        integration: { status: 'unknown' }
    };
    
    // Test 1: BROP Availability and Simplified DOM
    console.log('📋 Test 1: BROP Services');
    console.log('-'.repeat(25));
    
    try {
        const availability = await checkBROPAvailability();
        results.brop.available = availability.available;
        
        if (availability.available) {
            console.log('✅ BROP bridge server: CONNECTED');
            
            // Test simplified DOM
            const domTest = await new Promise((resolve) => {
                const ws = new WebSocket('ws://localhost:9223');
                let resolved = false;
                
                ws.on('open', () => {
                    const message = {
                        id: 'comprehensive-dom-test',
                        command: {
                            type: 'get_simplified_dom',
                            max_depth: 3,
                            include_hidden: false
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
            
            results.brop.simplifiedDOM = domTest.success;
            console.log(`✅ BROP simplified DOM: ${domTest.success ? 'WORKING' : `FAILED (${domTest.error})`}`);
            
        } else {
            console.log('❌ BROP bridge server: NOT AVAILABLE');
        }
    } catch (error) {
        console.log(`❌ BROP test failed: ${error.message}`);
    }
    
    // Test 2: Stagehand Browser Automation
    console.log('\n📋 Test 2: Stagehand Browser Automation');
    console.log('-'.repeat(35));
    
    let stagehand = null;
    
    try {
        // Initialize Stagehand
        stagehand = new Stagehand({
            env: "LOCAL",
            verbose: 0, // Reduce noise
            headless: false
        });
        
        await stagehand.init();
        results.stagehand.initialized = true;
        console.log('✅ Stagehand initialization: SUCCESS');
        
        // Test browser automation
        const page = stagehand.page;
        
        await page.goto('https://example.com', { 
            waitUntil: 'networkidle0' 
        });
        
        const pageInfo = {
            title: await page.title(),
            url: page.url()
        };
        
        // Test element detection
        const links = await page.$$eval('a', (anchors) => {
            return anchors.map(a => ({
                text: a.textContent.trim(),
                href: a.href
            }));
        });
        
        results.stagehand.automation = true;
        console.log('✅ Browser automation: SUCCESS');
        console.log(`   📄 Page: ${pageInfo.title}`);
        console.log(`   🔗 Links found: ${links.length}`);
        
        // Test screenshot capability
        await page.screenshot({ 
            path: 'comprehensive-test-screenshot.png',
            fullPage: false 
        });
        console.log('✅ Screenshot capability: SUCCESS');
        
    } catch (error) {
        console.log(`❌ Stagehand test failed: ${error.message}`);
    }
    
    // Test 3: Integration Assessment
    console.log('\n📋 Test 3: Integration Assessment');
    console.log('-'.repeat(30));
    
    if (results.brop.available && results.brop.simplifiedDOM && 
        results.stagehand.initialized && results.stagehand.automation) {
        results.integration.status = 'excellent';
        console.log('🎉 Integration Status: EXCELLENT');
        console.log('✅ Both BROP and Stagehand fully operational');
        console.log('✅ Ready for AI-enhanced browser automation');
    } else if (results.stagehand.initialized && results.stagehand.automation) {
        results.integration.status = 'good';
        console.log('✅ Integration Status: GOOD');
        console.log('✅ Stagehand working for browser automation');
        console.log('⚠️  BROP simplified DOM needs attention');
    } else {
        results.integration.status = 'issues';
        console.log('❌ Integration Status: ISSUES DETECTED');
    }
    
    // Final Report
    console.log('\n🎯 Comprehensive Test Results');
    console.log('=' + '='.repeat(35));
    
    console.log('\n📊 Component Status:');
    console.log(`   🔧 BROP Bridge Server: ${results.brop.available ? '✅ ONLINE' : '❌ OFFLINE'}`);
    console.log(`   🌳 BROP Simplified DOM: ${results.brop.simplifiedDOM ? '✅ WORKING' : '❌ ISSUES'}`);
    console.log(`   🎭 Stagehand Framework: ${results.stagehand.initialized ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`   🤖 Browser Automation: ${results.stagehand.automation ? '✅ WORKING' : '❌ FAILED'}`);
    
    console.log('\n🚀 Capabilities Confirmed:');
    if (results.stagehand.automation) {
        console.log('   ✅ Web page navigation and control');
        console.log('   ✅ Element detection and interaction');
        console.log('   ✅ Screenshot and content extraction');
        console.log('   ✅ Browser automation workflows');
    }
    
    if (results.brop.simplifiedDOM) {
        console.log('   ✅ AI-optimized DOM analysis');
        console.log('   ✅ Intelligent element suggestions');
        console.log('   ✅ Page structure understanding');
    }
    
    console.log('\n💡 Use Cases Ready:');
    if (results.integration.status === 'excellent') {
        console.log('   🎯 AI-powered web scraping');
        console.log('   🤖 Intelligent form automation');
        console.log('   📊 Enhanced page analysis');
        console.log('   🔍 Smart element detection');
    } else if (results.integration.status === 'good') {
        console.log('   🎭 Standard browser automation');
        console.log('   📸 Screenshot and content extraction');
        console.log('   🔗 Link and element detection');
    }
    
    console.log('\n📋 Next Steps:');
    if (results.integration.status === 'excellent') {
        console.log('   🎉 System fully operational!');
        console.log('   🚀 Ready for production AI automation');
        console.log('   📚 Explore advanced Stagehand features');
    } else {
        if (!results.brop.simplifiedDOM) {
            console.log('   🔧 Check BROP extension is active in Chrome');
            console.log('   🔄 Ensure extension has been reloaded');
            console.log('   🌐 Navigate to a webpage before testing');
        }
        if (!results.stagehand.automation) {
            console.log('   📦 Update Stagehand: npm update @browserbasehq/stagehand');
            console.log('   🔑 Check API key configuration');
        }
    }
    
    // Clean up
    if (stagehand) {
        try {
            await stagehand.close();
            console.log('\n🔚 Test cleanup completed');
        } catch (error) {
            console.error('⚠️ Cleanup error:', error.message);
        }
    }
    
    return results;
}

comprehensiveTest().then(results => {
    console.log('\n✨ Comprehensive test completed!');
    process.exit(results.integration.status === 'issues' ? 1 : 0);
}).catch(error => {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
});