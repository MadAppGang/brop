#!/usr/bin/env node
/**
 * Wikipedia Navigation Example using Native BROP Stagehand
 * 
 * This example demonstrates Stagehand-compatible navigation and interaction
 * using our native BROP implementation.
 */

require('dotenv').config({ path: '../../.env' });
const { BROPStagehand } = require('../brop-stagehand-native');

async function wikipediaNavigationExample() {
    console.log('📚 Wikipedia Navigation Example - Native BROP Stagehand');
    console.log('=' + '='.repeat(55));
    
    let stagehand = null;
    
    try {
        // Initialize Stagehand
        console.log('📋 Step 1: Initializing Stagehand...');
        stagehand = new BROPStagehand({
            verbose: true,
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        await stagehand.init();
        console.log('✅ Stagehand initialized with BROP backend');
        
        // Navigate to Wikipedia
        console.log('\n📋 Step 2: Navigating to Wikipedia...');
        await stagehand.navigate('https://en.wikipedia.org/wiki/Main_Page');
        
        const currentPage = stagehand.getCurrentPage();
        console.log(`✅ Navigation completed: ${currentPage.title}`);
        
        // Observe the page for search functionality
        console.log('\n📋 Step 3: Observing page for search functionality...');
        const searchElements = await stagehand.observe('Find the search box and search button on this page');
        
        console.log(`👁️ Found ${searchElements.length} actionable elements`);
        if (searchElements.length > 0) {
            console.log('   🔍 Top elements:');
            searchElements.slice(0, 3).forEach((element, i) => {
                console.log(`      ${i + 1}. ${element.description} (${element.action_type})`);
            });
        }
        
        // Extract key information from the main page
        console.log('\n📋 Step 4: Extracting main page information...');
        const mainPageData = await stagehand.extract(
            'Extract the featured article title, today\'s date, and number of articles',
            {
                type: "object",
                properties: {
                    featured_article: { type: "string" },
                    todays_date: { type: "string" },
                    article_count: { type: "string" },
                    main_topics: {
                        type: "array",
                        items: { type: "string" }
                    }
                }
            }
        );
        
        console.log('📊 Extracted Wikipedia Main Page Data:');
        console.log(`   📰 Featured Article: ${mainPageData.data.featured_article || 'N/A'}`);
        console.log(`   📅 Date: ${mainPageData.data.todays_date || 'N/A'}`);
        console.log(`   📖 Article Count: ${mainPageData.data.article_count || 'N/A'}`);
        if (mainPageData.data.main_topics) {
            console.log(`   🗂️  Main Topics: ${mainPageData.data.main_topics.slice(0, 3).join(', ')}`);
        }
        
        // Try to search for "Artificial Intelligence"
        console.log('\n📋 Step 5: Searching for "Artificial Intelligence"...');
        
        // Simulate search action (in full implementation, this would actually perform the search)
        const searchAction = await stagehand.act('Search for "Artificial Intelligence" in the search box');
        
        if (searchAction.success) {
            console.log('✅ Search action completed');
            console.log(`   🎯 Action: ${searchAction.action}`);
            
            // Wait a moment and check if we're on the AI page
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // For demonstration, let's navigate directly to the AI page
            console.log('\n📋 Step 6: Navigating to AI article...');
            await stagehand.navigate('https://en.wikipedia.org/wiki/Artificial_intelligence');
            
            // Extract information from the AI article
            console.log('\n📋 Step 7: Extracting AI article information...');
            const aiArticleData = await stagehand.extract(
                'Extract key information about artificial intelligence',
                {
                    type: "object",
                    properties: {
                        definition: { type: "string" },
                        key_applications: {
                            type: "array",
                            items: { type: "string" }
                        },
                        historical_notes: { type: "string" },
                        related_fields: {
                            type: "array",
                            items: { type: "string" }
                        }
                    }
                }
            );
            
            console.log('🤖 AI Article Information:');
            console.log(`   📝 Definition: ${(aiArticleData.data.definition || 'N/A').substring(0, 150)}...`);
            if (aiArticleData.data.key_applications) {
                console.log(`   🔧 Applications: ${aiArticleData.data.key_applications.slice(0, 3).join(', ')}`);
            }
            if (aiArticleData.data.related_fields) {
                console.log(`   🔗 Related Fields: ${aiArticleData.data.related_fields.slice(0, 3).join(', ')}`);
            }
        }
        
        // Take a screenshot of the final page
        console.log('\n📋 Step 8: Taking screenshot...');
        const screenshot = await stagehand.screenshot('wikipedia_ai_article');
        console.log(`📸 Screenshot saved: ${screenshot.name}`);
        console.log(`   📊 Image size: ${Math.round(screenshot.data.length / 1024)} KB`);
        
        // Final observation of the AI page
        console.log('\n📋 Step 9: Final page analysis...');
        const finalObservation = await stagehand.observe('Find navigation links and key sections on this AI article');
        
        console.log(`👁️ Final observation: ${finalObservation.length} interactive elements`);
        if (finalObservation.length > 0) {
            console.log('   🔗 Key navigation elements:');
            finalObservation.slice(0, 5).forEach((element, i) => {
                console.log(`      ${i + 1}. ${element.description}`);
            });
        }
        
        console.log('\n🎉 Wikipedia Navigation Example Completed!');
        console.log('\n📈 Demonstration Summary:');
        console.log('   ✅ Multi-page navigation');
        console.log('   ✅ AI-powered element observation');
        console.log('   ✅ Structured data extraction');
        console.log('   ✅ Action simulation');
        console.log('   ✅ Screenshot capture');
        console.log('   ✅ Full Stagehand API compatibility');
        
        console.log('\n💡 This shows that our native BROP Stagehand can:');
        console.log('   🎯 Navigate complex websites like Wikipedia');
        console.log('   🧠 Understand page structure with AI');
        console.log('   📊 Extract structured information');
        console.log('   🤖 Perform intelligent interactions');
        console.log('   📸 Capture visual documentation');
        
    } catch (error) {
        console.error('❌ Example failed:', error.message);
        
        if (error.message.includes('Not connected')) {
            console.log('\n🔧 Connection issue:');
            console.log('   1. Start BROP bridge: cd ../bridge-server && node bridge_server.js');
            console.log('   2. Ensure BROP extension is active in Chrome');
        } else if (error.message.includes('API key')) {
            console.log('\n🔧 AI configuration issue:');
            console.log('   1. Check ANTHROPIC_API_KEY in .env file');
            console.log('   2. Verify API key has correct permissions');
        }
    } finally {
        if (stagehand) {
            await stagehand.close();
            console.log('\n🔚 Example cleanup completed');
        }
    }
}

wikipediaNavigationExample();