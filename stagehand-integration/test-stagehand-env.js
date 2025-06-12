#!/usr/bin/env node
/**
 * Test Stagehand with proper environment variable configuration
 */

require('dotenv').config({ path: '../.env' });
const { Stagehand } = require('@browserbasehq/stagehand');

async function testStagehandWithEnv() {
    console.log('🔧 Stagehand Environment Configuration Test');
    console.log('=' + '='.repeat(45));
    
    // Check environment variables
    console.log('📋 Environment Variables:');
    console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'SET ✅' : 'MISSING ❌'}`);
    
    // Set the correct environment variable that Stagehand expects
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
    
    let stagehand = null;
    
    try {
        console.log('\n📋 Step 1: Initializing Stagehand with environment...');
        
        // Initialize with minimal config - let Stagehand use environment variables
        stagehand = new Stagehand({
            env: "LOCAL",
            verbose: 1,
            headless: false,
            modelName: "claude-3-sonnet-20240229",
            modelClientOptions: {
                apiKey: process.env.ANTHROPIC_API_KEY
            }
        });
        
        await stagehand.init();
        console.log('✅ Stagehand initialized');
        
        console.log('\n📋 Step 2: Testing page navigation...');
        const page = stagehand.page;
        
        await page.goto('https://example.com', { 
            waitUntil: 'networkidle0' 
        });
        
        console.log('✅ Navigation successful');
        console.log(`   📄 Title: ${await page.title()}`);
        console.log(`   🌐 URL: ${page.url()}`);
        
        console.log('\n📋 Step 3: Testing AI functionality...');
        
        try {
            // Test the observe method which uses AI
            const result = await stagehand.page.observe({
                instruction: "Find all links on this page"
            });
            
            console.log('✅ AI observation successful!');
            console.log('🤖 AI successfully analyzed the page');
            
            if (result && result.length > 0) {
                console.log(`🎯 Found ${result.length} elements`);
                result.slice(0, 3).forEach((element, i) => {
                    console.log(`   ${i + 1}. ${element.description || element.text || 'Element'}`);
                });
            }
            
        } catch (aiError) {
            console.log(`❌ AI observation failed: ${aiError.message}`);
            
            if (aiError.message.includes('No LLM API key')) {
                console.log('\n🔧 Trying alternative API key configuration...');
                
                // Try setting the environment variable directly
                process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
                console.log('   Set ANTHROPIC_API_KEY environment variable');
                
                // Also try the OpenAI format in case Stagehand expects that
                process.env.OPENAI_API_KEY = process.env.ANTHROPIC_API_KEY;
                console.log('   Set OPENAI_API_KEY as fallback');
                
                console.log('   ℹ️  You may need to restart the test for env vars to take effect');
            }
        }
        
        console.log('\n📋 Step 4: Testing basic automation...');
        
        // Test basic element interaction without AI
        const links = await page.$$eval('a', (anchors) => {
            return anchors.map(a => ({
                text: a.textContent.trim(),
                href: a.href
            }));
        });
        
        console.log(`🔗 Found ${links.length} links (non-AI method)`);
        links.slice(0, 2).forEach((link, i) => {
            console.log(`   ${i + 1}. "${link.text}" -> ${link.href}`);
        });
        
        console.log('\n🎯 Test Results:');
        console.log('✅ Stagehand initialization: SUCCESS');
        console.log('✅ Browser control: SUCCESS');
        console.log('✅ Page navigation: SUCCESS');
        console.log('✅ Element detection (non-AI): SUCCESS');
        console.log(`🤖 AI integration: ${aiError ? 'CONFIGURATION ISSUE' : 'SUCCESS'}`);
        
        if (aiError) {
            console.log('\n💡 To fix AI integration:');
            console.log('   1. Ensure ANTHROPIC_API_KEY is set correctly');
            console.log('   2. Check Stagehand version compatibility');
            console.log('   3. Verify API key has correct permissions');
            console.log('   4. Try updating Stagehand: npm update @browserbasehq/stagehand');
        }
        
        console.log('\n📋 BROP Integration Status:');
        console.log('🎭 Stagehand: Fully functional for browser automation');
        console.log('🔧 Basic features: Working without AI dependency');
        console.log('🤖 AI features: Need configuration fixes');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.stack) {
            console.error('\n🔍 Stack trace:');
            console.error(error.stack.split('\n').slice(0, 5).join('\n'));
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

testStagehandWithEnv();