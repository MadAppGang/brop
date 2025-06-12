#!/usr/bin/env node
/**
 * Debug Assertion Message
 * 
 * This test patches the assertion function to capture the exact condition
 * that's failing, so we can see what Playwright is actually checking.
 */

const { chromium } = require('playwright');

// Patch the assertion function to capture the failing condition
function patchAssertionFunction() {
    // We'll monkey-patch the assert function used by Playwright
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    
    Module.prototype.require = function(id) {
        const module = originalRequire.apply(this, arguments);
        
        // If this is the assert module from Playwright
        if (id.includes('assert.js') && module && typeof module === 'function') {
            console.log('🔧 Patching assertion function to capture failing conditions...');
            
            // Create a wrapper that logs the assertion details
            const originalAssert = module;
            const patchedAssert = function(condition, message) {
                if (!condition) {
                    console.log('\n🚨 ASSERTION FAILURE DETECTED!');
                    console.log('🔍 Assertion Details:');
                    console.log(`   Condition: ${condition}`);
                    console.log(`   Message: "${message || 'No message'}"`);
                    console.log(`   Type: ${typeof condition}`);
                    
                    // Try to get more context about what was being checked
                    const stack = new Error().stack;
                    console.log('\n📍 Call Stack Context:');
                    const stackLines = stack.split('\n').slice(1, 6);
                    stackLines.forEach((line, index) => {
                        console.log(`   ${index + 1}. ${line.trim()}`);
                    });
                    
                    // Log the exact function and line where assertion failed
                    if (stack.includes('crConnection.js:134')) {
                        console.log('\n🎯 Confirmed: Assertion failure at crConnection.js:134');
                        console.log('This is in CRSession._onMessage method');
                    }
                }
                
                // Call the original assert function
                return originalAssert.call(this, condition, message);
            };
            
            // Copy any properties from the original
            Object.keys(originalAssert).forEach(key => {
                patchedAssert[key] = originalAssert[key];
            });
            
            return patchedAssert;
        }
        
        return module;
    };
}

async function debugAssertionWithPatching() {
    console.log('🔧 Debug Assertion with Function Patching');
    console.log('=' + '='.repeat(60));
    
    // Apply the patch before requiring Playwright
    patchAssertionFunction();
    
    try {
        console.log('🎭 Starting Playwright test with assertion debugging...');
        const browser = await chromium.connectOverCDP('ws://localhost:9222');
        console.log('✅ Browser connected');
        
        const context = await browser.newContext();
        console.log('✅ Context created');
        
        console.log('🎯 Creating page (assertion failure expected here)...');
        const page = await context.newPage();
        console.log('✅ Page created successfully (unexpected!)');
        
        await page.close();
        await context.close();
        await browser.close();
        
    } catch (error) {
        console.log('\n💥 Test failed as expected');
        console.log(`Error type: ${error.constructor.name}`);
        console.log(`Error message: ${error.message}`);
        
        if (error.message === 'Assertion error') {
            console.log('\n🎯 This confirms it\'s the generic assertion error');
            console.log('The patched function should have logged details above');
        }
    }
}

// Alternative approach: Try to read Playwright's source to understand the assertion
async function analyzePlaywrightSource() {
    console.log('\n🔍 Analyzing Playwright Source Code');
    console.log('=' + '='.repeat(60));
    
    try {
        const fs = require('fs');
        const path = require('path');
        
        // Try to find the crConnection.js file
        const crConnectionPath = path.join(__dirname, 'node_modules/.pnpm/playwright-core@1.53.0/node_modules/playwright-core/lib/server/chromium/crConnection.js');
        
        if (fs.existsSync(crConnectionPath)) {
            console.log('📁 Found crConnection.js file');
            
            const content = fs.readFileSync(crConnectionPath, 'utf8');
            const lines = content.split('\n');
            
            // Look around line 134
            console.log('\n📋 Code around line 134:');
            for (let i = 130; i < 140; i++) {
                if (lines[i] !== undefined) {
                    const marker = i === 133 ? ' ➤ ' : '   ';
                    console.log(`${marker}${i + 1}: ${lines[i]}`);
                }
            }
            
            // Look for assert calls in CRSession._onMessage
            console.log('\n🔍 Looking for assert calls in _onMessage method...');
            let inOnMessage = false;
            let methodStart = -1;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.includes('_onMessage') && line.includes('(')) {
                    inOnMessage = true;
                    methodStart = i;
                    console.log(`\n📍 Found _onMessage method at line ${i + 1}`);
                    continue;
                }
                
                if (inOnMessage) {
                    if (line.includes('assert(') || line.includes('assert ')) {
                        console.log(`🎯 Found assertion at line ${i + 1}: ${line.trim()}`);
                        
                        // Show context around this assertion
                        console.log('   Context:');
                        for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
                            const marker = j === i ? ' ➤ ' : '   ';
                            console.log(`   ${marker}${j + 1}: ${lines[j].trim()}`);
                        }
                    }
                    
                    // Stop when we exit the method (rough heuristic)
                    if (line.includes('}') && line.trim() === '}' && i > methodStart + 10) {
                        break;
                    }
                }
            }
            
        } else {
            console.log('❌ Could not find crConnection.js file');
            console.log(`   Tried: ${crConnectionPath}`);
        }
        
    } catch (error) {
        console.log('❌ Error analyzing source:', error.message);
    }
}

async function main() {
    console.log('🎯 Debug Assertion Message Test');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Understand exactly what assertion is failing in crConnection.js:134');
    console.log('');
    
    // Try both approaches
    await debugAssertionWithPatching();
    await analyzePlaywrightSource();
    
    console.log('\n💡 Summary:');
    console.log('1. Patching approach should show the failing condition');
    console.log('2. Source analysis should show what line 134 is checking');
    console.log('3. This will help us understand what Playwright expects vs what we send');
}

main();