#!/usr/bin/env node
/**
 * Find the message with wrong ID field
 * 
 * Now that we know the assertion is `assert(!object.id)`, we need to find
 * which message incorrectly has an `id` field when it should be an event.
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

async function findWrongIdMessage() {
    console.log('🔍 Finding Message with Wrong ID Field');
    console.log('=' + '='.repeat(60));
    console.log('The assertion `assert(!object.id)` means Playwright expects');
    console.log('an event (no id), but receives a message WITH an id field.');
    console.log('');
    
    const allMessages = [];
    
    // Intercept all messages
    const interceptPromise = new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9222');
        
        ws.on('open', () => {
            console.log('📡 Intercepting all CDP messages...');
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                const hasId = parsed.id !== undefined;
                const hasMethod = parsed.method !== undefined;
                
                console.log(`📥 Message: ${hasMethod ? `Event ${parsed.method}` : `Response id=${parsed.id}`}`);
                console.log(`   Has id: ${hasId} (${typeof parsed.id})`);
                console.log(`   Has method: ${hasMethod}`);
                
                // Check for problematic combinations
                if (hasId && hasMethod) {
                    console.log('   🚨 PROBLEM: Message has BOTH id AND method (invalid!)');
                } else if (hasId && !hasMethod && !parsed.result && !parsed.error) {
                    console.log('   🚨 PROBLEM: Message has id but no method, result, or error');
                } else if (!hasId && !hasMethod) {
                    console.log('   🚨 PROBLEM: Message has neither id nor method');
                }
                
                allMessages.push({
                    timestamp: Date.now(),
                    data: parsed,
                    hasId,
                    hasMethod,
                    problematic: (hasId && hasMethod) || (hasId && !hasMethod && !parsed.result && !parsed.error) || (!hasId && !hasMethod)
                });
                
            } catch (error) {
                console.log(`❌ Parse error: ${error.message}`);
            }
        });
        
        ws.on('close', () => {
            resolve(allMessages);
        });
        
        ws.on('error', (error) => {
            resolve(allMessages);
        });
    });
    
    // Start Playwright test
    setTimeout(async () => {
        try {
            console.log('\n🎭 Starting Playwright (will fail)...');
            const browser = await chromium.connectOverCDP('ws://localhost:9222');
            const context = await browser.newContext();
            const page = await context.newPage(); // This should trigger the assertion
            
        } catch (error) {
            console.log('\n💥 Assertion error as expected');
            
            // Close intercept after a moment
            setTimeout(() => {
                if (interceptPromise) {
                    // The promise will resolve when WebSocket closes
                }
            }, 500);
        }
    }, 1000);
    
    return interceptPromise;
}

function analyzeWrongMessages(messages) {
    console.log('\n🔍 Analysis of Problematic Messages');
    console.log('=' + '='.repeat(60));
    
    const problematic = messages.filter(m => m.problematic);
    console.log(`📊 Found ${problematic.length} problematic messages out of ${messages.length} total`);
    
    if (problematic.length > 0) {
        console.log('\n🚨 Problematic Messages:');
        problematic.forEach((msg, index) => {
            console.log(`\n${index + 1}. Message with issue:`);
            console.log(`   Data: ${JSON.stringify(msg.data, null, 2)}`);
            console.log(`   Has id: ${msg.hasId}`);
            console.log(`   Has method: ${msg.hasMethod}`);
        });
    }
    
    // Look for the specific pattern that triggers the assertion
    console.log('\n🎯 Looking for messages that would trigger `assert(!object.id)`...');
    
    const messagesWithId = messages.filter(m => m.hasId);
    console.log(`📋 Messages with id field: ${messagesWithId.length}`);
    
    messagesWithId.forEach((msg, index) => {
        const data = msg.data;
        console.log(`\n${index + 1}. Message with id: ${data.id}`);
        console.log(`   Type: ${data.method ? 'Event (WRONG!)' : data.result !== undefined ? 'Success Response' : data.error !== undefined ? 'Error Response' : 'Unknown'}`);
        
        if (data.method) {
            console.log(`   🚨 ASSERTION TRIGGER: Event "${data.method}" has id field!`);
            console.log(`   This violates the CDP protocol - events should not have id`);
        }
    });
    
    console.log('\n💡 Root Cause Analysis:');
    console.log('The assertion `assert(!object.id)` fails when:');
    console.log('1. An EVENT message incorrectly includes an `id` field');
    console.log('2. A RESPONSE is sent to the event handler instead of response handler');
    console.log('3. Message routing is incorrect in our bridge server');
}

async function main() {
    console.log('🎯 Find Wrong ID Message Test');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find which message incorrectly has an id field');
    console.log('causing the assertion `assert(!object.id)` to fail');
    console.log('');
    
    const messages = await findWrongIdMessage();
    analyzeWrongMessages(messages);
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Fix any events that incorrectly have id fields');
    console.log('2. Check bridge server message routing');
    console.log('3. Ensure events vs responses are handled correctly');
}

main();