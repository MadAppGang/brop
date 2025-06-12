#!/usr/bin/env node
/**
 * Debug Stagehand AI configuration issues
 */

require('dotenv').config({ path: '../.env' });

async function debugStagehandAI() {
    console.log('🔍 Debugging Stagehand AI Configuration');
    console.log('=' + '='.repeat(40));
    
    // Check environment and dependencies
    console.log('📋 Environment Check:');
    console.log(`   Node.js: ${process.version}`);
    console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'SET ✅' : 'MISSING ❌'}`);
    
    // Check Stagehand version and dependencies
    const packageJson = require('./package.json');
    console.log(`   Stagehand version: ${packageJson.dependencies['@browserbasehq/stagehand']}`);
    
    // Test Anthropic SDK directly
    console.log('\n📋 Testing Anthropic SDK directly...');
    
    try {
        // Try to import and test Anthropic SDK
        const Anthropic = require('@anthropic-ai/sdk');
        console.log('✅ Anthropic SDK imported successfully');
        
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        
        console.log('✅ Anthropic client created');
        
        // Test a simple API call
        console.log('🧪 Testing simple API call...');
        
        const message = await anthropic.messages.create({
            model: "claude-3-sonnet-20240229",
            max_tokens: 50,
            messages: [
                {
                    role: "user",
                    content: "Say 'Hello, BROP!' in exactly 2 words."
                }
            ]
        });
        
        console.log('✅ Anthropic API call successful!');
        console.log(`   Response: ${message.content[0].text}`);
        
    } catch (anthropicError) {
        console.log(`❌ Anthropic SDK test failed: ${anthropicError.message}`);
        
        if (anthropicError.message.includes('API key')) {
            console.log('   🔑 API key issue detected');
        } else if (anthropicError.message.includes('network') || anthropicError.message.includes('fetch')) {
            console.log('   🌐 Network connectivity issue');
        } else {
            console.log('   📦 SDK configuration or version issue');
        }
    }
    
    // Test Stagehand initialization without AI
    console.log('\n📋 Testing Stagehand without AI...');
    
    try {
        const { Stagehand } = require('@browserbasehq/stagehand');
        
        const stagehand = new Stagehand({
            env: "LOCAL",
            verbose: 0,
            headless: false,
            // Don't specify AI configuration
        });
        
        await stagehand.init();
        console.log('✅ Stagehand initialized without AI');
        
        const page = stagehand.page;
        await page.goto('https://example.com', { waitUntil: 'networkidle0' });
        console.log('✅ Page navigation works');
        
        // Test basic element detection
        const title = await page.title();
        console.log(`   📄 Page title: ${title}`);
        
        // Test if observe method exists but may fail due to AI config
        console.log('\n🧪 Testing observe method availability...');
        
        if (typeof page.observe === 'function') {
            console.log('✅ observe method exists');
            
            try {
                const result = await page.observe({
                    instruction: "Find the main heading"
                });
                console.log('✅ AI observe worked!', result);
            } catch (observeError) {
                console.log(`❌ AI observe failed: ${observeError.message}`);
                
                if (observeError.message.includes('llmClient.createChatCompletion')) {
                    console.log('   🔧 This is the exact issue: createChatCompletion method missing');
                    console.log('   💡 Likely cause: Anthropic SDK version mismatch');
                    console.log('   🔄 Solution: Update SDK versions');
                }
            }
        } else {
            console.log('❌ observe method not available');
        }
        
        await stagehand.close();
        console.log('✅ Stagehand cleanup successful');
        
    } catch (stagehandError) {
        console.log(`❌ Stagehand test failed: ${stagehandError.message}`);
    }
    
    // Check package versions and compatibility
    console.log('\n📋 Package Compatibility Check:');
    
    try {
        const nodeModulesPath = './node_modules/@browserbasehq/stagehand/package.json';
        const stagehandPkg = require(nodeModulesPath);
        console.log(`   Installed Stagehand: v${stagehandPkg.version}`);
        
        // Check if Anthropic is listed as a dependency
        const deps = stagehandPkg.dependencies || {};
        const anthropicDep = deps['@anthropic-ai/sdk'] || deps['anthropic'];
        console.log(`   Stagehand expects Anthropic: ${anthropicDep || 'NOT SPECIFIED'}`);
        
    } catch (error) {
        console.log('   ⚠️ Could not read Stagehand package info');
    }
    
    // Recommendations
    console.log('\n💡 Troubleshooting Recommendations:');
    console.log('1. 🔄 Update Stagehand: npm update @browserbasehq/stagehand');
    console.log('2. 📦 Install latest Anthropic SDK: npm install @anthropic-ai/sdk@latest');
    console.log('3. 🔧 Check Stagehand docs for latest AI configuration');
    console.log('4. 🧪 Test with OpenAI instead: export OPENAI_API_KEY=...');
    
    console.log('\n📋 Alternative Test Options:');
    console.log('✅ Stagehand browser automation (non-AI) works perfectly');
    console.log('✅ BROP simplified DOM working independently');
    console.log('⚠️ AI integration needs SDK compatibility fixes');
}

debugStagehandAI().catch(error => {
    console.error('❌ Debug failed:', error.message);
    process.exit(1);
});