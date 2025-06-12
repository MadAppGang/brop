#!/usr/bin/env node
/**
 * Run Playwright with Debug Logs
 * 
 * This will run Playwright and show the bridge server debug logs
 * to see exactly which message causes the assertion error.
 */

const { chromium } = require('playwright');

async function runWithDebugLogs() {
    console.log('🔧 Running Playwright with Bridge Debug Logs');
    console.log('=' + '='.repeat(60));
    console.log('Watch the bridge server logs to see which message causes assertion error');
    console.log('');
    
    try {
        console.log('🎭 Starting Playwright...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        console.log('🎯 Creating page (assertion error expected here)...');
        console.log('👁️  Watch the bridge server logs for debug output!');
        
        const page = await context.newPage();
        console.log('🎉 Page created successfully!');
        
        await page.close();
        await context.close();
        await browser.close();
        
    } catch (error) {
        console.log(`\n💥 Playwright failed: ${error.message}`);
        
        if (error.message.includes('Assertion error')) {
            console.log('\n🎯 Assertion error occurred!');
            console.log('Check the bridge server logs above to see:');
            console.log('1. Which message ID was stored');
            console.log('2. Which response was sent');
            console.log('3. If there\'s an ID mismatch or timing issue');
        }
    }
}

async function main() {
    console.log('🎯 Debug Logs Test');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Capture bridge server debug logs during assertion error');
    console.log('');
    console.log('INSTRUCTIONS:');
    console.log('1. Make sure the bridge server is running with debug logs');
    console.log('2. Watch the bridge server terminal for debug output');
    console.log('3. Compare stored message IDs with sent response IDs');
    console.log('');
    
    await runWithDebugLogs();
    
    console.log('\n🔍 Analysis:');
    console.log('Look for patterns in the bridge server logs:');
    console.log('- Message IDs that are stored but responses never sent');
    console.log('- Response IDs that don\'t match any stored message ID');
    console.log('- Timing issues between storing and sending responses');
}

main();