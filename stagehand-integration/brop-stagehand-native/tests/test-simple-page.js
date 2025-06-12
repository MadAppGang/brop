#!/usr/bin/env node
/**
 * Test BROP Stagehand with a simple test page
 */

require('dotenv').config({ path: '../../.env' });
const { BROPStagehand } = require('../brop-stagehand-native');

async function testSimplePage() {
    console.log('🧪 Testing BROP Stagehand with Simple Page');
    console.log('=' + '='.repeat(45));
    
    let stagehand = null;
    
    try {
        // Initialize BROP Stagehand
        console.log('📋 Step 1: Initializing BROP Stagehand...');
        
        stagehand = new BROPStagehand({
            verbose: true,
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        await stagehand.init();
        console.log('✅ BROP Stagehand initialized');
        
        // Test with a very simple HTML page
        console.log('\\n📋 Step 2: Navigating to simple test page...');
        await stagehand.navigate('data:text/html,<html><head><title>Test Page</title></head><body><h1>Hello World</h1><button id="test-btn">Click Me</button><input type="text" placeholder="Enter text"><a href="#link">Test Link</a></body></html>');
        
        const currentPage = stagehand.getCurrentPage();
        console.log(`✅ Navigation completed: ${currentPage.title}`);
        
        // Test observation without AI first - direct DOM call
        console.log('\\n📋 Step 3: Testing direct simplified DOM call...');
        
        try {
            const domResult = await stagehand.sendBROPCommand({
                type: 'get_simplified_dom',
                max_depth: 3,
                include_invisible: false
            });
            
            console.log('🔍 Direct DOM Result:');
            console.log(`   Success: ${domResult.success}`);
            if (domResult.success && domResult.result) {
                console.log(`   Page Title: ${domResult.result.page_title || 'N/A'}`);
                console.log(`   Interactive Elements: ${domResult.result.total_interactive_elements || 0}`);
                console.log(`   Structure Summary: ${domResult.result.page_structure_summary || 'N/A'}`);
                console.log(`   Simplified Tree: ${JSON.stringify(domResult.result.simplified_tree || {}, null, 2)}`);
                console.log(`   Suggested Selectors: ${(domResult.result.suggested_selectors || []).join(', ')}`);
            } else {
                console.log(`   Error: ${domResult.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.log(`   ❌ Direct DOM call failed: ${error.message}`);
        }
        
        // Test observation with AI
        console.log('\\n📋 Step 4: Testing AI-powered observation...');
        
        try {
            const observations = await stagehand.observe('Find all interactive elements like buttons, links, and inputs');
            console.log(`✅ AI observation completed: ${observations.length} elements found`);
            
            if (observations.length > 0) {
                console.log('   🔍 Found elements:');
                observations.forEach((obs, i) => {
                    console.log(`      ${i + 1}. ${obs.description || obs.text} (${obs.action_type})`);
                });
            }
        } catch (error) {
            console.log(`   ❌ AI observation failed: ${error.message}`);
        }
        
        // Test action
        console.log('\\n📋 Step 5: Testing simple action...');
        
        try {
            const actionResult = await stagehand.act('Click the button');
            console.log(`✅ Action test: ${actionResult.success ? 'SUCCESS' : 'FAILED'}`);
            if (actionResult.success) {
                console.log(`   🎯 Action: ${actionResult.action}`);
            }
        } catch (error) {
            console.log(`   ❌ Action test failed: ${error.message}`);
        }
        
        // Test extraction
        console.log('\\n📋 Step 6: Testing data extraction...');
        
        try {
            const extractedData = await stagehand.extract('Extract all text content and interactive elements', {
                type: "object",
                properties: {
                    page_title: { type: "string" },
                    main_text: { type: "string" },
                    buttons: {
                        type: "array",
                        items: { type: "string" }
                    },
                    links: {
                        type: "array", 
                        items: { type: "string" }
                    }
                }
            });
            
            console.log('✅ Data extraction completed');
            console.log(`   📊 Extracted: ${JSON.stringify(extractedData.data, null, 2)}`);
        } catch (error) {
            console.log(`   ❌ Data extraction failed: ${error.message}`);
        }
        
        console.log('\\n🎯 Simple Page Test Results:');
        console.log('=' + '='.repeat(35));
        console.log('✅ This test helps isolate DOM simplification issues');
        console.log('✅ If this works, the issue is with complex page handling');
        console.log('✅ If this fails, the issue is with basic DOM processing');
        
    } catch (error) {
        console.error('❌ Simple page test failed:', error.message);
    } finally {
        if (stagehand) {
            await stagehand.close();
            console.log('\\n🔚 Test cleanup completed');
        }
    }
}

testSimplePage();