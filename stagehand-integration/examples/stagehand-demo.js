#!/usr/bin/env node
/**
 * BROP + Stagehand Advanced Demo
 * 
 * This demo showcases the full capabilities of using Stagehand with BROP,
 * including AI-powered automation, smart element detection, and data extraction.
 */

const { createStagehand, checkBROPAvailability } = require('../index');

async function stagehandDemo() {
    console.log('🎭 BROP + Stagehand Advanced Demo');
    console.log('=' + '='.repeat(50));
    
    let stagehand = null;
    
    try {
        // Initialize BROP + Stagehand
        console.log('\n🚀 Initializing BROP + Stagehand...');
        const availability = await checkBROPAvailability();
        
        if (!availability.available) {
            throw new Error(`BROP not available: ${availability.error}`);
        }
        
        stagehand = await createStagehand({
            verbose: true,
            enableAIActions: true,
            enableSmartSelectors: true,
            fallbackToPlaywright: true
        });
        
        console.log('✅ BROP + Stagehand initialized successfully');
        
        // Demo 1: Wikipedia Search and Navigation
        await demoWikipediaSearch(stagehand);
        
        // Demo 2: GitHub Repository Exploration
        await demoGitHubExploration(stagehand);
        
        // Demo 3: Form Interaction Demo
        await demoFormInteraction(stagehand);
        
        // Demo 4: Data Extraction Demo
        await demoDataExtraction(stagehand);
        
        console.log('\n🎉 All demos completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Demo failed:', error.message);
        console.error(error.stack);
    } finally {
        if (stagehand) {
            console.log('\n🧹 Cleaning up...');
            await stagehand.adapter.close();
        }
    }
}

async function demoWikipediaSearch(stagehand) {
    console.log('\n📚 Demo 1: Wikipedia Search and Navigation');
    console.log('-'.repeat(40));
    
    try {
        // Navigate to Wikipedia
        console.log('🌐 Navigating to Wikipedia...');
        await stagehand.page.goto('https://en.wikipedia.org', { waitUntil: 'networkidle' });
        
        // Get page structure
        const dom = await stagehand.page.getSimplifiedDOM({ max_depth: 3 });
        console.log(`📊 Found ${dom.total_interactive_elements} interactive elements`);
        
        // Observe the search functionality
        console.log('👁️ Observing search functionality...');
        const searchObservation = await stagehand.page.observe('find the search box to search for articles');
        
        if (searchObservation.relevant_elements.length > 0) {
            const searchElement = searchObservation.relevant_elements[0];
            console.log(`🔍 Found search element: ${searchElement.description}`);
            
            // Perform search using AI action
            console.log('🤖 Performing AI-powered search...');
            await stagehand.page.act('click the search box');
            await stagehand.page.act('type "Artificial Intelligence" in the search box');
            await stagehand.page.act('press Enter or click search button');
            
            // Wait for results
            await stagehand.page.waitForTimeout(3000);
            
            console.log(`✅ Search completed. Current URL: ${stagehand.page.url()}`);
            
        } else {
            console.log('⚠️ Could not find search functionality');
        }
        
    } catch (error) {
        console.log(`❌ Wikipedia demo failed: ${error.message}`);
    }
}

async function demoGitHubExploration(stagehand) {
    console.log('\n🐙 Demo 2: GitHub Repository Exploration');
    console.log('-'.repeat(40));
    
    try {
        // Navigate to GitHub
        console.log('🌐 Navigating to GitHub...');
        await stagehand.page.goto('https://github.com', { waitUntil: 'networkidle' });
        
        // Observe the page structure
        console.log('👁️ Observing GitHub interface...');
        const observation = await stagehand.page.observe('find navigation and search features');
        
        console.log(`🔍 Found ${observation.relevant_elements.length} relevant elements`);
        observation.relevant_elements.slice(0, 3).forEach((element, i) => {
            console.log(`   ${i + 1}. ${element.description}`);
        });
        
        // Try to find and interact with search
        console.log('🔎 Looking for search functionality...');
        const searchElement = await stagehand.page.findElementSmart('search repositories or code');
        
        if (searchElement && searchElement.confidence > 0.5) {
            console.log(`🎯 Found search with confidence: ${(searchElement.confidence * 100).toFixed(1)}%`);
            
            // Perform search
            console.log('🤖 Searching for "playwright" repositories...');
            await stagehand.page.act('click the search box');
            await stagehand.page.act('type "playwright" in the search box');
            await stagehand.page.act('press Enter');
            
            // Wait for search results
            await stagehand.page.waitForTimeout(3000);
            
            // Extract search results
            console.log('📊 Extracting search results...');
            const results = await stagehand.page.extract({
                repository_names: 'repository names',
                descriptions: 'repository descriptions',
                stars: 'star counts'
            });
            
            console.log('🎯 Search results extracted');
            Object.entries(results).forEach(([key, value]) => {
                if (value) {
                    console.log(`   ${key}: ${typeof value === 'string' ? value.substring(0, 100) : value}`);
                }
            });
            
        } else {
            console.log('⚠️ Could not find search functionality with sufficient confidence');
        }
        
    } catch (error) {
        console.log(`❌ GitHub demo failed: ${error.message}`);
    }
}

async function demoFormInteraction(stagehand) {
    console.log('\n📝 Demo 3: Form Interaction');
    console.log('-'.repeat(40));
    
    try {
        // Navigate to a form demo page
        console.log('🌐 Navigating to form demo page...');
        await stagehand.page.goto('https://httpbin.org/forms/post', { waitUntil: 'networkidle' });
        
        // Analyze the form
        console.log('🔍 Analyzing form structure...');
        const formDOM = await stagehand.page.getSimplifiedDOM({ 
            max_depth: 4,
            include_hidden: false 
        });
        
        console.log(`📋 Form contains ${formDOM.total_interactive_elements} interactive elements`);
        
        // Fill out the form using AI actions
        console.log('🤖 Filling out form with AI actions...');
        
        // Find and fill text fields
        const textFields = await stagehand.page.observe('find text input fields in the form');
        console.log(`📝 Found ${textFields.relevant_elements.length} text input fields`);
        
        // Fill each field
        for (const field of textFields.relevant_elements.slice(0, 3)) {
            if (field.role === 'textbox') {
                const fieldName = field.description.toLowerCase();
                let valueToEnter = '';
                
                if (fieldName.includes('name') || fieldName.includes('customer')) {
                    valueToEnter = 'BROP Stagehand Demo';
                } else if (fieldName.includes('email')) {
                    valueToEnter = 'demo@brop-stagehand.example';
                } else if (fieldName.includes('comment') || fieldName.includes('message')) {
                    valueToEnter = 'This is a demo of BROP + Stagehand integration!';
                } else {
                    valueToEnter = 'Demo Value';
                }
                
                console.log(`   ✏️ Filling "${field.description}" with "${valueToEnter}"`);
                await stagehand.page.act(`click ${field.selector}`);
                await stagehand.page.act(`type "${valueToEnter}" in the field`);
            }
        }
        
        // Find and interact with other form elements
        console.log('📋 Looking for other form elements...');
        const otherElements = await stagehand.page.observe('find checkboxes, radio buttons, or select dropdowns');
        
        for (const element of otherElements.relevant_elements.slice(0, 2)) {
            if (element.role === 'checkbox') {
                console.log(`   ☑️ Checking checkbox: ${element.description}`);
                await stagehand.page.act(`check the checkbox ${element.selector}`);
            } else if (element.role === 'radio') {
                console.log(`   🔘 Selecting radio button: ${element.description}`);
                await stagehand.page.act(`select the radio button ${element.selector}`);
            }
        }
        
        console.log('✅ Form interaction demo completed');
        
    } catch (error) {
        console.log(`❌ Form demo failed: ${error.message}`);
    }
}

async function demoDataExtraction(stagehand) {
    console.log('\n📊 Demo 4: Data Extraction');
    console.log('-'.repeat(40));
    
    try {
        // Navigate to Hacker News for data extraction
        console.log('🌐 Navigating to Hacker News...');
        await stagehand.page.goto('https://news.ycombinator.com', { waitUntil: 'networkidle' });
        
        // Get simplified DOM for analysis
        console.log('🔍 Analyzing page structure...');
        const dom = await stagehand.page.getSimplifiedDOM({ 
            max_depth: 5,
            include_hidden: false 
        });
        
        console.log(`📰 Page structure: ${dom.page_structure_summary}`);
        console.log(`🔗 Interactive elements: ${dom.total_interactive_elements}`);
        
        // Extract news articles data
        console.log('📊 Extracting news articles...');
        const articles = await stagehand.page.extract({
            titles: 'article titles',
            links: 'article links', 
            points: 'point scores',
            comments: 'comment counts',
            authors: 'author names'
        });
        
        console.log('🎯 Extraction Results:');
        Object.entries(articles).forEach(([key, value]) => {
            if (value) {
                const displayValue = typeof value === 'string' ? 
                    value.substring(0, 150) + (value.length > 150 ? '...' : '') : 
                    value;
                console.log(`   📄 ${key}: ${displayValue}`);
            }
        });
        
        // Try to observe and interact with specific articles
        console.log('👁️ Observing top articles...');
        const topArticles = await stagehand.page.observe('find the top 3 articles on the page');
        
        if (topArticles.relevant_elements.length > 0) {
            console.log(`🔝 Found ${topArticles.relevant_elements.length} top articles`);
            
            const firstArticle = topArticles.relevant_elements[0];
            console.log(`📰 First article: ${firstArticle.description}`);
            
            // Try to click on the first article (in a new tab to avoid navigation)
            if (firstArticle.selector) {
                console.log('🖱️ Simulating click on first article...');
                // In a real scenario, you might want to open in new tab
                // For demo, we'll just show that we found it
                console.log(`   🎯 Would click: ${firstArticle.selector}`);
            }
        }
        
        // Performance metrics
        console.log('⚡ Performance Analysis:');
        const performanceData = await stagehand.page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0];
            return {
                loadTime: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
                domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
                totalTime: Math.round(navigation.loadEventEnd - navigation.fetchStart)
            };
        });
        
        console.log(`   ⏱️ Load time: ${performanceData.loadTime}ms`);
        console.log(`   🏗️ DOM ready: ${performanceData.domContentLoaded}ms`);
        console.log(`   🎯 Total time: ${performanceData.totalTime}ms`);
        
        console.log('✅ Data extraction demo completed');
        
    } catch (error) {
        console.log(`❌ Data extraction demo failed: ${error.message}`);
    }
}

// Run demo if called directly
if (require.main === module) {
    stagehandDemo().catch(console.error);
}

module.exports = stagehandDemo;