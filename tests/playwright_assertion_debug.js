#!/usr/bin/env node
/**
 * Playwright Assertion Debug
 * 
 * This test tries to pinpoint exactly which CDP message triggers the assertion error
 * by intercepting and logging all messages at the exact moment of failure.
 */

const { chromium } = require('playwright');

// Monkey patch console.error to capture the exact moment of assertion failure
const originalConsoleError = console.error;
console.error = function(...args) {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Assertion error')) {
        console.log('\n🚨 ASSERTION ERROR DETECTED!');
        console.log('Stack trace:', new Error().stack);
    }
    return originalConsoleError.apply(console, args);
};

async function debugPlaywrightAssertion() {
    console.log('🔍 Playwright Assertion Debug Test');
    console.log('=' + '='.repeat(50));
    
    try {
        console.log('📋 Step 1: Connecting to BROP CDP server...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected successfully');
        
        console.log('📋 Step 2: Creating new context...');
        const context = await browser.newContext();
        console.log('✅ Context created successfully');
        
        console.log('📋 Step 3: Creating new page...');
        // This is where the assertion error typically occurs
        const page = await context.newPage();
        console.log('✅ Page created successfully');
        
        console.log('📋 Step 4: Getting page title...');
        const title = await page.title();
        console.log(`✅ Page title: "${title}"`);
        
        console.log('📋 Step 5: Navigating to simple page...');
        await page.goto('data:text/html,<html><head><title>Test</title></head><body>Hello World</body></html>');
        console.log('✅ Navigation completed');
        
        console.log('📋 Step 6: Getting updated title...');
        const newTitle = await page.title();
        console.log(`✅ New title: "${newTitle}"`);
        
        await page.close();
        await context.close();
        await browser.close();
        
        console.log('🎉 All tests completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error('Message:', error.message);
        console.error('Name:', error.name);
        
        if (error.stack) {
            console.error('\nFull stack trace:');
            const stackLines = error.stack.split('\n');
            stackLines.forEach((line, index) => {
                console.error(`${(index + 1).toString().padStart(2)}: ${line}`);
            });
        }
        
        // Look for the specific assertion error
        if (error.stack && error.stack.includes('crConnection.js:134')) {
            console.log('\n🎯 Found the assertion error at crConnection.js:134!');
            console.log('This means Playwright is failing in its internal CDP message validation.');
            
            // Extract the relevant part of the stack
            const relevantLines = error.stack.split('\n').filter(line => 
                line.includes('crConnection.js') || 
                line.includes('crSession') ||
                line.includes('_onMessage')
            );
            
            console.log('\n📋 Relevant stack trace lines:');
            relevantLines.forEach(line => console.log('   ' + line.trim()));
        }
    }
}

// Also try to catch uncaught exceptions that might give us more info
process.on('uncaughtException', (error) => {
    console.log('\n🚨 UNCAUGHT EXCEPTION:');
    console.log('Message:', error.message);
    console.log('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('\n🚨 UNHANDLED PROMISE REJECTION:');
    console.log('Reason:', reason);
    console.log('Promise:', promise);
});

debugPlaywrightAssertion();