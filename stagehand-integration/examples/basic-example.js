#!/usr/bin/env node
/**
 * Basic BROP + Stagehand Integration Example
 * 
 * This example demonstrates how to use Stagehand with BROP as the browser backend.
 * It shows basic navigation, interaction, and data extraction using AI-powered commands.
 */

const { createStagehand, checkBROPAvailability } = require('../index');

async function basicExample() {
    console.log('🚀 BROP + Stagehand Basic Example');
    console.log('=' + '='.repeat(40));
    
    try {
        // Step 1: Check if BROP is available
        console.log('\n📋 Step 1: Checking BROP availability...');
        const availability = await checkBROPAvailability();
        
        if (!availability.available) {
            console.error('❌ BROP is not available:', availability.error);
            console.log('\n💡 Make sure to:');
            console.log('   1. Start the BROP bridge server: cd bridge-server && node bridge_server.js');
            console.log('   2. Load the BROP extension in Chrome');
            console.log('   3. Ensure Chrome is running and accessible');
            process.exit(1);
        }
        
        console.log('✅ BROP is available and ready');
        console.log(`   - CDP Server: ${availability.cdpServer ? '✅' : '❌'}`);
        console.log(`   - Has Context: ${availability.hasContext ? '✅' : '❌'}`);
        console.log(`   - Has Page: ${availability.hasPage ? '✅' : '❌'}`);
        
        // Step 2: Create Stagehand instance with BROP
        console.log('\n📋 Step 2: Creating Stagehand instance with BROP...');
        const stagehand = await createStagehand({
            verbose: true,
            enableAIActions: true,
            enableSmartSelectors: true
        });
        
        console.log('✅ Stagehand instance created successfully');
        
        // Step 3: Check BROP extension status
        console.log('\n📋 Step 3: Checking BROP extension status...');
        const bropStatus = await stagehand.page.checkBROPStatus();
        console.log('🔍 BROP Extension Status:', bropStatus);
        
        if (!bropStatus.hasContentScript) {
            console.warn('⚠️ BROP content script not detected. Enhanced features may not work.');
        }
        
        // Step 4: Navigate to a test page
        console.log('\n📋 Step 4: Navigating to example page...');
        await stagehand.page.goto('https://example.com', { waitUntil: 'networkidle' });
        console.log('✅ Navigation completed');
        
        // Step 5: Get simplified DOM structure
        console.log('\n📋 Step 5: Getting simplified DOM structure...');
        const simplifiedDOM = await stagehand.page.getSimplifiedDOM({
            max_depth: 3,
            include_hidden: false,
            include_coordinates: true
        });
        
        console.log('📊 Page Analysis:');
        console.log(`   - Interactive elements: ${simplifiedDOM.total_interactive_elements}`);
        console.log(`   - Page structure: ${simplifiedDOM.page_structure_summary}`);
        console.log(`   - Suggested selectors: ${simplifiedDOM.suggested_selectors.length}`);
        
        if (simplifiedDOM.suggested_selectors.length > 0) {
            console.log('   - Top suggestions:');
            simplifiedDOM.suggested_selectors.slice(0, 3).forEach((selector, i) => {
                console.log(`     ${i + 1}. ${selector}`);
            });
        }
        
        // Step 6: Try AI-powered observation
        console.log('\n📋 Step 6: Using AI-powered observation...');
        const observation = await stagehand.page.observe('find any links on the page');
        console.log('👁️ Observation Results:');
        console.log(`   - Found ${observation.relevant_elements.length} relevant elements`);
        
        if (observation.relevant_elements.length > 0) {
            console.log('   - Top relevant elements:');
            observation.relevant_elements.slice(0, 3).forEach((element, i) => {
                console.log(`     ${i + 1}. ${element.description} (${element.selector})`);
            });
        }
        
        // Step 7: Try smart element finding
        console.log('\n📋 Step 7: Testing smart element finding...');
        const smartElement = await stagehand.page.findElementSmart('More information', {
            max_depth: 4
        });
        
        if (smartElement) {
            console.log('🎯 Smart element found:');
            console.log(`   - Selector: ${smartElement.selector}`);
            console.log(`   - Description: ${smartElement.description}`);
            console.log(`   - Confidence: ${(smartElement.confidence * 100).toFixed(1)}%`);
            
            // Try to interact with the element
            if (smartElement.confidence > 0.7) {
                console.log('\n📋 Step 8: Interacting with found element...');
                try {
                    await stagehand.page.act('click the More information link');
                    console.log('✅ Successfully clicked the element');
                    
                    // Wait a moment for any navigation
                    await stagehand.page.waitForTimeout(2000);
                    
                    const newUrl = stagehand.page.url();
                    console.log(`   - New URL: ${newUrl}`);
                    
                } catch (error) {
                    console.log(`⚠️ Interaction failed: ${error.message}`);
                }
            }
        } else {
            console.log('⚠️ No smart element found for "More information"');
        }
        
        // Step 8: Extract basic page information
        console.log('\n📋 Step 9: Extracting page information...');
        const extractedData = await stagehand.page.extract({
            title: 'page title',
            heading: 'main heading',
            description: 'page description'
        });
        
        console.log('📊 Extracted Data:');
        Object.entries(extractedData).forEach(([key, value]) => {
            if (value) {
                console.log(`   - ${key}: ${value}`);
            }
        });
        
        // Step 9: Final status check
        console.log('\n📋 Step 10: Final status check...');
        const finalStatus = await stagehand.page.checkBROPStatus();
        console.log('📍 Final Status:');
        console.log(`   - Page URL: ${finalStatus.pageUrl}`);
        console.log(`   - Page Title: ${finalStatus.pageTitle}`);
        console.log(`   - BROP Content Script: ${finalStatus.hasContentScript ? '✅' : '❌'}`);
        
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await stagehand.adapter.close();
        console.log('✅ Cleanup completed');
        
        console.log('\n🎉 Basic example completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('   - Try the advanced example: node examples/advanced-example.js');
        console.log('   - Explore the Stagehand demo: node examples/stagehand-demo.js');
        console.log('   - Check out the API documentation in README.md');
        
    } catch (error) {
        console.error('\n❌ Example failed:', error.message);
        console.error('\n🔍 Troubleshooting:');
        console.error('   1. Ensure BROP bridge server is running');
        console.error('   2. Make sure Chrome has the BROP extension loaded');
        console.error('   3. Check that no other processes are using the same ports');
        console.error('   4. Verify network connectivity to localhost');
        
        process.exit(1);
    }
}

// Run the example if called directly
if (require.main === module) {
    basicExample().catch(console.error);
}

module.exports = basicExample;