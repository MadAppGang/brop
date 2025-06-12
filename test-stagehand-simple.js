#!/usr/bin/env node
/**
 * Simple test for BROP Stagehand DOM data
 */

const { BROPStagehand } = require('./stagehand-integration/brop-stagehand-native/brop-stagehand-native');

async function testSimple() {
    console.log('🔍 Simple BROP Stagehand Test');
    console.log('=' + '='.repeat(30));
    
    let stagehand = null;
    
    try {
        stagehand = new BROPStagehand({
            verbose: true,
            // No API key needed for DOM test
        });
        
        await stagehand.init();
        console.log('✅ Connected');
        
        // Navigate to example.com
        await stagehand.navigate('https://example.com');
        console.log('✅ Navigated');
        
        // Test just the DOM retrieval without AI
        console.log('\n📋 Testing DOM retrieval...');
        const domResponse = await stagehand.sendBROPCommand({
            type: 'get_simplified_dom',
            max_depth: 3,
            include_coordinates: true,
            include_text_nodes: true
        });
        
        console.log('📊 DOM Response Structure:');
        console.log('   Success:', domResponse.success);
        console.log('   Result keys:', Object.keys(domResponse.result || {}));
        if (domResponse.result) {
            console.log('   Page title:', domResponse.result.page_title);
            console.log('   Interactive elements:', domResponse.result.total_interactive_elements);
            console.log('   Structure summary:', domResponse.result.page_structure_summary);
            console.log('   Root node exists:', !!domResponse.result.root);
            console.log('   Root node type:', typeof domResponse.result.root);
            
            if (domResponse.result.root) {
                console.log('   Root node keys:', Object.keys(domResponse.result.root));
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        if (stagehand) {
            await stagehand.close();
        }
    }
}

testSimple();