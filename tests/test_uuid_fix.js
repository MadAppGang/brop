#!/usr/bin/env node
/**
 * Test UUID Session ID Fix
 * 
 * This test verifies that session IDs are now in proper UUID format
 * which should resolve the assertion error in Playwright.
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

async function testUUIDFix() {
    console.log('🆔 Testing UUID Session ID Fix');
    console.log('=' + '='.repeat(50));
    
    // First, verify UUID format in direct CDP
    console.log('📡 Step 1: Verify UUID format in events...');
    const hasValidUUID = await new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9222');
        let messageId = 1;
        
        ws.on('open', () => {
            // Send Target.createTarget to trigger events
            ws.send(JSON.stringify({
                id: messageId++,
                method: 'Target.createTarget',
                params: {
                    url: 'about:blank',
                    browserContextId: 'default'
                }
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                
                if (parsed.method === 'Target.attachedToTarget') {
                    const sessionId = parsed.params?.sessionId;
                    console.log(`📥 Target.attachedToTarget event received`);
                    console.log(`   sessionId: "${sessionId}"`);
                    
                    // Check if it's a valid UUID format
                    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                    const isValidUUID = uuidPattern.test(sessionId);
                    
                    console.log(`   UUID format: ${isValidUUID ? '✅ Valid' : '❌ Invalid'}`);
                    console.log(`   Length: ${sessionId ? sessionId.length : 'undefined'}`);
                    
                    if (isValidUUID) {
                        console.log('   🎉 Session ID is now in proper UUID format!');
                    } else {
                        console.log('   ❌ Session ID is still not in UUID format');
                    }
                    
                    setTimeout(() => ws.close(), 100);
                    resolve(isValidUUID);
                }
                
            } catch (error) {
                console.log('Parse error:', error);
                resolve(false);
            }
        });
        
        ws.on('close', () => {
            // If we didn't get the event, resolve false
            setTimeout(() => resolve(false), 100);
        });
    });
    
    if (!hasValidUUID) {
        console.log('❌ UUID fix not working, extension may need reload');
        return false;
    }
    
    // Now test Playwright to see if assertion error is gone
    console.log('\n🎭 Step 2: Test Playwright with UUID session IDs...');
    try {
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected successfully');
        
        const context = await browser.newContext();
        console.log('✅ Context created successfully');
        
        console.log('🎯 Creating page (critical test)...');
        const page = await context.newPage();
        console.log('🎉 PAGE CREATED SUCCESSFULLY! (No assertion error)');
        
        const title = await page.title();
        console.log(`✅ Page title: "${title}"`);
        
        // Test basic functionality
        await page.goto('data:text/html,<html><head><title>UUID Test</title></head><body><h1>Success!</h1></body></html>');
        const newTitle = await page.title();
        console.log(`✅ Navigation successful, new title: "${newTitle}"`);
        
        await page.close();
        await context.close();
        await browser.close();
        
        console.log('🎉 ALL TESTS PASSED! Assertion error is FIXED!');
        return true;
        
    } catch (error) {
        if (error.message.includes('Assertion error')) {
            console.log('❌ Assertion error still occurs:', error.message);
            console.log('The UUID fix did not resolve the issue.');
            return false;
        } else {
            console.log('❌ Different error occurred:', error.message);
            return false;
        }
    }
}

async function main() {
    console.log('🎯 UUID Session ID Fix Test');
    console.log('=' + '='.repeat(60));
    console.log('Goal: Verify that UUID session IDs resolve the assertion error');
    console.log('');
    console.log('IMPORTANT: Make sure to reload the Chrome extension first!');
    console.log('(Go to chrome://extensions/ and click the reload button)');
    console.log('');
    
    const success = await testUUIDFix();
    
    if (success) {
        console.log('\n🎉 SUCCESS! The UUID session ID fix resolved the assertion error!');
        console.log('Playwright can now successfully create pages and work with BROP.');
    } else {
        console.log('\n❌ The assertion error persists.');
        console.log('Possible reasons:');
        console.log('1. Extension not reloaded with new UUID code');
        console.log('2. Different assertion is failing (not session ID related)');
        console.log('3. Additional session context issues');
    }
}

main();