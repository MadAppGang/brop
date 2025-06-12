#!/usr/bin/env node
/**
 * Find the Real CDP Connection
 * 
 * Playwright must have the actual CDP connection somewhere else.
 * Let's inspect all properties to find where the WebSocket connection is.
 */

const { chromium } = require('playwright');

function deepInspect(obj, path = '', maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth || !obj || typeof obj !== 'object') {
        return [];
    }
    
    const results = [];
    
    try {
        const keys = Object.getOwnPropertyNames(obj);
        
        for (const key of keys) {
            const fullPath = path ? `${path}.${key}` : key;
            
            try {
                const value = obj[key];
                const type = typeof value;
                
                if (value && type === 'object') {
                    const constructor = value.constructor ? value.constructor.name : 'Unknown';
                    
                    // Look for WebSocket-like objects
                    if (constructor.includes('WebSocket') || 
                        constructor.includes('Connection') || 
                        constructor.includes('Transport') ||
                        constructor.includes('CDP') ||
                        key.includes('transport') ||
                        key.includes('connection') ||
                        key.includes('session')) {
                        
                        results.push({
                            path: fullPath,
                            type: constructor,
                            hasReadyState: 'readyState' in value,
                            hasUrl: 'url' in value,
                            hasSend: 'send' in value,
                            hasOnMessage: 'onmessage' in value || '_onMessage' in value,
                            details: {
                                readyState: value.readyState,
                                url: value.url,
                                _url: value._url
                            }
                        });
                        
                        // Continue deeper inspection for promising objects
                        if (currentDepth < maxDepth - 1) {
                            results.push(...deepInspect(value, fullPath, maxDepth, currentDepth + 1));
                        }
                    }
                }
            } catch (error) {
                // Skip properties that can't be accessed
            }
        }
    } catch (error) {
        // Skip objects that can't be inspected
    }
    
    return results;
}

async function findRealCdpConnection() {
    console.log('🔍 FINDING REAL CDP CONNECTION');
    console.log('=' + '='.repeat(70));
    
    console.log('\n1️⃣ Inspecting WORKING headless browser...');
    let workingBrowser = null;
    let workingContext = null;
    
    try {
        workingBrowser = await chromium.launch({ headless: true });
        workingContext = await workingBrowser.newContext();
        
        console.log('✅ Created working browser and context');
        
        console.log('\n🔍 Deep inspection of working browser:');
        const workingResults = deepInspect(workingBrowser, 'browser');
        workingResults.forEach(result => {
            console.log(`📍 ${result.path}: ${result.type}`);
            console.log(`   WebSocket-like: ${result.hasReadyState && result.hasSend}`);
            console.log(`   Details:`, result.details);
        });
        
        console.log('\n🔍 Deep inspection of working context:');
        const workingContextResults = deepInspect(workingContext, 'context');
        workingContextResults.forEach(result => {
            console.log(`📍 ${result.path}: ${result.type}`);
            console.log(`   WebSocket-like: ${result.hasReadyState && result.hasSend}`);
            console.log(`   Details:`, result.details);
        });
        
    } catch (error) {
        console.log('❌ Error with working browser:', error.message);
    }
    
    console.log('\n2️⃣ Inspecting BROP connection...');
    let bropBrowser = null;
    let bropContext = null;
    
    try {
        bropBrowser = await chromium.connectOverCDP('ws://localhost:9222');
        bropContext = await bropBrowser.newContext();
        
        console.log('✅ Created BROP browser and context');
        
        console.log('\n🔍 Deep inspection of BROP browser:');
        const bropResults = deepInspect(bropBrowser, 'browser');
        bropResults.forEach(result => {
            console.log(`📍 ${result.path}: ${result.type}`);
            console.log(`   WebSocket-like: ${result.hasReadyState && result.hasSend}`);
            console.log(`   Details:`, result.details);
        });
        
        console.log('\n🔍 Deep inspection of BROP context:');
        const bropContextResults = deepInspect(bropContext, 'context');
        bropContextResults.forEach(result => {
            console.log(`📍 ${result.path}: ${result.type}`);
            console.log(`   WebSocket-like: ${result.hasReadyState && result.hasSend}`);
            console.log(`   Details:`, result.details);
        });
        
    } catch (error) {
        console.log('❌ Error with BROP connection:', error.message);
    }
    
    console.log('\n3️⃣ Looking for actual page creation differences...');
    
    try {
        if (workingContext) {
            console.log('\n🧪 Testing working page creation...');
            const workingPage = await workingContext.newPage();
            console.log('✅ Working page created successfully');
            
            console.log('🔍 Inspecting working page:');
            const pageResults = deepInspect(workingPage, 'page', 2);
            pageResults.forEach(result => {
                console.log(`📍 ${result.path}: ${result.type}`);
            });
            
            await workingPage.close();
        }
        
        if (bropContext) {
            console.log('\n🧪 Testing BROP page creation...');
            try {
                const bropPage = await bropContext.newPage();
                console.log('✅ BROP page created successfully!');
                await bropPage.close();
            } catch (error) {
                console.log('❌ BROP page creation failed:', error.message);
                
                // Try to inspect context state right before failure
                console.log('\n🔍 Context state before failure:');
                const failureResults = deepInspect(bropContext, 'context', 2);
                const relevantResults = failureResults.filter(r => 
                    r.path.includes('_page') || 
                    r.path.includes('_connection') ||
                    r.path.includes('transport'));
                    
                relevantResults.forEach(result => {
                    console.log(`📍 ${result.path}: ${result.type}`);
                    console.log(`   Details:`, result.details);
                });
            }
        }
        
    } catch (error) {
        console.log('❌ Error during page testing:', error.message);
    }
    
    // Cleanup
    if (workingContext) await workingContext.close();
    if (workingBrowser) await workingBrowser.close();
    if (bropContext) await bropContext.close();
    if (bropBrowser) await bropBrowser.close();
}

if (require.main === module) {
    findRealCdpConnection().catch(console.error);
}