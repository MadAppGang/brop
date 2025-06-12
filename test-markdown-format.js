#!/usr/bin/env node
/**
 * Test markdown format for simplified DOM
 */

const { BROPStagehand } = require('./stagehand-integration/brop-stagehand-native/brop-stagehand-native');

async function testMarkdownFormat() {
    console.log('📝 Testing Markdown Format for Simplified DOM');
    console.log('=' + '='.repeat(45));
    
    let stagehand = null;
    
    try {
        stagehand = new BROPStagehand({
            verbose: true
        });
        
        await stagehand.init();
        console.log('✅ Connected to BROP');
        
        // Navigate to example.com
        await stagehand.navigate('https://example.com');
        console.log('✅ Navigated to example.com');
        
        // Test different formats
        console.log('\n📋 Testing Tree Format...');
        const treeFormat = await stagehand.sendBROPCommand({
            type: 'get_simplified_dom',
            max_depth: 3,
            format: 'tree'
        });
        console.log('   Tree format keys:', Object.keys(treeFormat.result || {}));
        
        console.log('\n📋 Testing HTML Format...');
        const htmlFormat = await stagehand.sendBROPCommand({
            type: 'get_simplified_dom',
            max_depth: 3,
            format: 'html'
        });
        console.log('   HTML format keys:', Object.keys(htmlFormat.result || {}));
        if (htmlFormat.result?.simplified_html) {
            console.log('   Simplified HTML length:', htmlFormat.result.simplified_html.length);
        }
        
        console.log('\n📋 Testing Markdown Format...');
        const markdownFormat = await stagehand.sendBROPCommand({
            type: 'get_simplified_dom',
            max_depth: 3,
            format: 'markdown'
        });
        console.log('   Markdown format keys:', Object.keys(markdownFormat.result || {}));
        if (markdownFormat.result?.simplified_markdown) {
            console.log('   Simplified markdown length:', markdownFormat.result.simplified_markdown.length);
            console.log('   Simplified markdown preview:', markdownFormat.result.simplified_markdown.substring(0, 200) + '...');
        }
        if (markdownFormat.result?.markdown_content) {
            console.log('   Full markdown length:', markdownFormat.result.markdown_content.length);
            console.log('   Full markdown preview:', markdownFormat.result.markdown_content.substring(0, 200) + '...');
        }
        
        console.log('\n🎯 Format Comparison:');
        console.log('   Tree format: Traditional nested object structure');
        console.log('   HTML format: Clean HTML representation');
        console.log('   Markdown format: AI-friendly markdown text');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (stagehand) {
            await stagehand.close();
        }
    }
}

testMarkdownFormat();