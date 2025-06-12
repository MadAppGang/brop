#!/usr/bin/env node
/**
 * Test Separate Endpoints
 * 
 * Test the new Chrome CDP-like architecture with separate
 * WebSocket endpoints for each page.
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

async function testSeparateEndpointsArchitecture() {
    console.log('🔍 Test Separate Endpoints Architecture');
    console.log('=' + '='.repeat(60));
    
    try {
        // Step 1: Connect to main CDP endpoint and create target
        console.log('📡 Step 1: Connect to main CDP endpoint...');
        const mainWs = new WebSocket('ws://localhost:9222');
        
        let targetId = null;
        let pagePort = null;
        
        await new Promise((resolve, reject) => {
            mainWs.on('open', () => {
                console.log('✅ Connected to main CDP endpoint');
                
                // Create a target
                const createTargetMsg = {
                    id: 1,
                    method: 'Target.createTarget',
                    params: { url: 'data:text/html,<h1>Separate Endpoint Test</h1>' }
                };
                
                console.log('📤 Creating target...');
                mainWs.send(JSON.stringify(createTargetMsg));
            });
            
            mainWs.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    console.log('📥 Main CDP response:', response);
                    
                    if (response.id === 1 && response.result?.targetId) {
                        targetId = response.result.targetId;
                        console.log(`✅ Target created: ${targetId}`);
                        
                        // Extract port from bridge server logs or use expected port
                        pagePort = 9300; // First page server should be on port 9300
                        resolve();
                    }
                } catch (error) {
                    reject(error);
                }
            });
            
            mainWs.on('error', reject);
            
            setTimeout(() => reject(new Error('Timeout creating target')), 5000);
        });
        
        mainWs.close();
        
        // Step 2: Connect to page-specific endpoint
        console.log(`\n📡 Step 2: Connect to page endpoint ws://localhost:${pagePort}/...`);
        const pageWs = new WebSocket(`ws://localhost:${pagePort}/`);
        
        const pageResponses = [];
        
        await new Promise((resolve, reject) => {
            pageWs.on('open', () => {
                console.log(`✅ Connected to page endpoint for ${targetId}`);
                
                // Test page-specific commands
                const commands = [
                    {
                        id: 1,
                        method: 'Page.navigate',
                        params: { url: 'data:text/html,<h1>Navigation Test</h1><p>Success!</p>' }
                    },
                    {
                        id: 2,
                        method: 'Runtime.evaluate',
                        params: { expression: 'document.querySelector("h1").textContent' }
                    }
                ];
                
                commands.forEach((cmd, index) => {
                    setTimeout(() => {
                        console.log(`📤 Page command: ${cmd.method}`);
                        pageWs.send(JSON.stringify(cmd));
                    }, index * 1000);
                });
            });
            
            pageWs.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    pageResponses.push(response);
                    console.log(`📥 Page response ${response.id}:`, response.result ? 'SUCCESS' : 'ERROR');
                    
                    if (response.id === 2) {
                        // Got JavaScript evaluation result
                        console.log(`✅ JavaScript result: ${response.result?.result?.value}`);
                        setTimeout(resolve, 500);
                    }
                } catch (error) {
                    reject(error);
                }
            });
            
            pageWs.on('error', reject);
            
            setTimeout(() => reject(new Error('Timeout testing page commands')), 10000);
        });
        
        pageWs.close();
        
        console.log(`\n📊 Results: ${pageResponses.length} responses received`);
        const successful = pageResponses.filter(r => r.result).length;
        console.log(`✅ Successful commands: ${successful}/${pageResponses.length}`);
        
        return successful === pageResponses.length;
        
    } catch (error) {
        console.log(`❌ Separate endpoints test failed: ${error.message}`);
        return false;
    }
}

async function testPlaywrightWithSeparateEndpoints() {
    console.log('\n🔍 Test Playwright with Separate Endpoints');
    console.log('=' + '='.repeat(60));
    
    try {
        console.log('🎭 Connecting Playwright to BROP...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        console.log('🎯 Attempting newPage() with separate endpoints...');
        const page = await context.newPage();
        console.log('🎉 newPage() succeeded with separate endpoints!');
        
        await page.goto('data:text/html,<h1>Playwright with Separate Endpoints</h1>');
        console.log('✅ Navigation successful');
        
        const title = await page.evaluate(() => document.querySelector('h1').textContent);
        console.log(`✅ JavaScript evaluation: ${title}`);
        
        await page.close();
        await context.close();
        await browser.close();
        
        console.log('🎉 Playwright works with separate endpoints!');
        return true;
        
    } catch (error) {
        console.log(`❌ Playwright with separate endpoints failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🎯 Test Separate Endpoints Architecture');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Test Chrome CDP-like separate WebSocket endpoints');
    console.log('');
    
    const directTest = await testSeparateEndpointsArchitecture();
    const playwrightTest = await testPlaywrightWithSeparateEndpoints();
    
    console.log('\n📊 Final Results:');
    console.log('=' + '='.repeat(50));
    console.log(`Direct separate endpoints: ${directTest ? '✅ WORKS' : '❌ FAILED'}`);
    console.log(`Playwright with separate endpoints: ${playwrightTest ? '✅ WORKS' : '❌ FAILED'}`);
    
    if (playwrightTest) {
        console.log('\n🎉 SUCCESS: Separate endpoints architecture works with Playwright!');
        console.log('✅ BROP now mimics real Chrome CDP behavior');
        console.log('✅ Each page has its own WebSocket endpoint');
        console.log('✅ Playwright can use newPage() successfully');
    } else if (directTest) {
        console.log('\n🟡 PARTIAL SUCCESS: Direct endpoints work, but Playwright needs more work');
    } else {
        console.log('\n❌ FAILED: Separate endpoints architecture needs debugging');
    }
}

main();