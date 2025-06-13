#!/usr/bin/env node
/**
 * Debug console capture to see why we're not catching GitHub's console errors
 */

const { createPage } = require('../../client');

async function testDebugConsoleCapture() {
    console.log('🔍 Debug Console Capture Test');
    console.log('==============================');
    console.log('🎯 Goal: Find out why we\'re missing GitHub\'s console errors');
    console.log('👀 Please keep Chrome DevTools Console open');
    console.log('');

    let page = null;

    try {
        console.log('\n📍 STEP 1: Creating GitHub page...');
        page = await createPage('https://github.com', 'test-debug-console-capture.js');
        console.log(`✅ Page created: ${page.toString()}`);

        console.log('\n📍 STEP 2: Installing console capture with debug info...');
        const initialLogs = await page.getConsoleLogs({ limit: 10 });
        console.log(`✅ Initial console capture completed: ${initialLogs.logs?.length || 0} logs`);
        
        if (initialLogs.debug_info) {
            console.log('\n🔍 DEBUG INFO (Initial):');
            console.log(`   - Already installed: ${initialLogs.debug_info.alreadyInstalled}`);
            console.log(`   - Console type: ${initialLogs.debug_info.consoleType}`);
            console.log(`   - Setup completed: ${initialLogs.debug_info.setupCompleted}`);
            console.log(`   - Total captured: ${initialLogs.debug_info.totalCaptured}`);
        }

        console.log('\n📍 STEP 3: Waiting for GitHub to load and generate errors...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        console.log('   ⏰ GitHub should be generating font CSP errors now...');

        console.log('\n📍 STEP 4: Getting console logs with debug info...');
        const finalLogs = await page.getConsoleLogs({ limit: 50 });
        console.log(`✅ Final console logs retrieved: ${finalLogs.logs?.length || 0} logs`);
        
        if (finalLogs.debug_info) {
            console.log('\n🔍 DEBUG INFO (After wait):');
            console.log(`   - Already installed: ${finalLogs.debug_info.alreadyInstalled}`);
            console.log(`   - Total captured: ${finalLogs.debug_info.totalCaptured}`);
            console.log(`   - Setup time: ${finalLogs.debug_info.setupTime ? new Date(finalLogs.debug_info.setupTime).toISOString() : 'N/A'}`);
        }
        
        if (finalLogs.logs && finalLogs.logs.length > 0) {
            console.log('\n📋 ALL CAPTURED LOGS:');
            console.log('   ' + '='.repeat(80));
            finalLogs.logs.forEach((log, index) => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                console.log(`   ${index + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
                if (log.args && log.args.length > 0) {
                    console.log(`      Args: ${log.args.join(', ')}`);
                }
            });
            console.log('   ' + '='.repeat(80));
        } else {
            console.log('\n❌ NO LOGS CAPTURED');
            console.log('🔍 This means either:');
            console.log('   1. Console capture setup failed');
            console.log('   2. GitHub errors occurred before our capture was installed');
            console.log('   3. GitHub errors are not using console.error/warn/log/info');
            console.log('   4. CSP is blocking our console override script');
        }

        console.log('\n🔍 Debug test completed!');
        console.log('📋 Please compare results with browser console');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        if (page) {
            await page.close();
            console.log('🧹 Page closed and cleaned up');
        }
    }
}

if (require.main === module) {
    testDebugConsoleCapture().catch(console.error);
}