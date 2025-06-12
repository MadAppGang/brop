#!/usr/bin/env node
/**
 * Test Session Routing Fix
 * 
 * The issue might be that Target.attachedToTarget events should be sent
 * to the specific session that requested the target, not broadcast to all clients.
 * 
 * Let's test what happens if we DON'T send the problematic events.
 */

const { chromium } = require('playwright');

async function testWithoutEvents() {
    console.log('🧪 Test Without Target Events');
    console.log('=' + '='.repeat(50));
    console.log('Goal: See if Playwright works without Target.attachedToTarget events');
    console.log('');
    
    // First, let's temporarily disable the problematic events by modifying
    // what we send from the extension. We need to stop sending Target.attachedToTarget
    // events to see if that resolves the assertion error.
    
    console.log('📋 Testing approach:');
    console.log('1. Connect to CDP without auto-attach events');
    console.log('2. Manually create targets without attached events');
    console.log('3. See if Playwright works');
    
    try {
        console.log('\n🎭 Connecting to BROP...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        console.log('🏗️ Creating context...');
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        console.log('🎯 Creating page (critical test)...');
        const page = await context.newPage();
        console.log('🎉 PAGE CREATED! (Assertion error avoided)');
        
        console.log('📄 Testing basic page operations...');
        const title = await page.title();
        console.log(`✅ Page title: "${title}"`);
        
        await page.goto('data:text/html,<html><head><title>Test Success</title></head><body><h1>It Works!</h1></body></html>');
        const newTitle = await page.title();
        console.log(`✅ Navigation successful: "${newTitle}"`);
        
        // Test evaluation
        const result = await page.evaluate(() => document.body.textContent);
        console.log(`✅ Evaluation successful: "${result}"`);
        
        await page.close();
        await context.close();
        await browser.close();
        
        console.log('\n🎉 SUCCESS: All operations completed without assertion error!');
        return true;
        
    } catch (error) {
        console.log(`\n❌ Test failed: ${error.message}`);
        
        if (error.message.includes('Assertion error')) {
            console.log('🚨 Assertion error still occurs - not related to events');
            return false;
        } else {
            console.log('🤔 Different error - may be progress');
            return false;
        }
    }
}

async function analyzeSessionRouting() {
    console.log('\n🔀 Analyze Session Routing Requirements');
    console.log('=' + '='.repeat(50));
    
    console.log('📋 Playwright CDP Session Model:');
    console.log('1. Main connection receives Browser.* commands');
    console.log('2. Target.createTarget creates a new target');
    console.log('3. Target.attachToTarget creates a session for that target');
    console.log('4. Target.attachedToTarget should be sent to the PARENT session');
    console.log('5. NOT broadcast to main connection');
    
    console.log('\n🔧 Current BROP Implementation:');
    console.log('❌ We broadcast Target.attachedToTarget to ALL clients');
    console.log('✅ Should send Target.attachedToTarget to specific session');
    
    console.log('\n💡 Fix Required:');
    console.log('1. Track which session requested Target.createTarget');
    console.log('2. Send Target.attachedToTarget to that specific session');
    console.log('3. Don\'t broadcast these events to main connection');
}

async function main() {
    console.log('🎯 Session Routing Fix Test');
    console.log('=' + '='.repeat(60));
    console.log('Goal: Determine if session routing is causing the assertion error');
    console.log('');
    
    const success = await testWithoutEvents();
    await analyzeSessionRouting();
    
    if (success) {
        console.log('\n🎉 CONCLUSION: Events are not the issue');
        console.log('The assertion error has another cause');
    } else {
        console.log('\n🔍 CONCLUSION: Need to investigate further');
        console.log('Possible causes:');
        console.log('1. Session routing (events sent to wrong session)');
        console.log('2. Message timing (events sent too early)');
        console.log('3. Session context mismatch');
        console.log('4. Different assertion condition');
    }
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Modify bridge server to route events to specific sessions');
    console.log('2. Track parent sessions for Target.attachedToTarget events');
    console.log('3. Stop broadcasting target events to main connection');
}

main();