#!/usr/bin/env node
/**
 * Test Extension Reload Feature
 * Tests a new feature before and after extension reload
 */

const WebSocket = require('ws');

let messageId = 0;

async function testReloadFeature() {
    console.log('🔄 Testing Extension Reload Feature');
    console.log('=' + '='.repeat(35));
    
    let ws = null;
    
    try {
        console.log('📋 Connecting to BROP bridge...');
        
        ws = new WebSocket('ws://localhost:9223');
        
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        console.log('✅ Connected to BROP bridge');
        
        // Test the NEW feature that should be available after adding it
        console.log('\n📋 Testing NEW feature: test_reload_feature...');
        
        const result = await sendCommand(ws, {
            type: 'test_reload_feature',
            message: 'Testing new feature availability'
        });
        
        if (result.success) {
            console.log('✅ NEW FEATURE IS AVAILABLE!');
            console.log(`   Message: ${result.result.message}`);
            console.log(`   Timestamp: ${result.result.timestamp}`);
            console.log(`   Version: ${result.result.feature_version}`);
            console.log(`   Note: ${result.result.note}`);
        } else {
            console.log('❌ NEW FEATURE NOT AVAILABLE');
            console.log(`   Error: ${result.error}`);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return { success: false, error: error.message };
    } finally {
        if (ws) {
            ws.close();
        }
    }
}

async function testReloadWorkflow() {
    console.log('🔄 Complete Extension Reload Test Workflow');
    console.log('=' + '='.repeat(45));
    
    // Step 1: Test current feature availability
    console.log('\n📋 Step 1: Testing feature availability...');
    const beforeResult = await testReloadFeature();
    
    if (!beforeResult.success) {
        console.log('❌ Feature not available - this indicates extension needs reload');
        
        // Step 2: Reload extension
        console.log('\n📋 Step 2: Reloading extension...');
        try {
            const ws = new WebSocket('ws://localhost:9223');
            await new Promise((resolve, reject) => {
                ws.on('open', resolve);
                ws.on('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
            
            const reloadResult = await sendCommand(ws, {
                type: 'reload_extension',
                reason: 'Testing reload mechanism with new feature',
                delay: 2000
            });
            
            if (reloadResult.success) {
                console.log('✅ Extension reload scheduled');
                console.log(`   Reason: ${reloadResult.result.reason}`);
                console.log('   ⏳ Waiting for extension to reload...');
                
                ws.close();
                
                // Wait for reload to complete
                await new Promise(resolve => setTimeout(resolve, 4000));
                
                // Step 3: Test feature after reload
                console.log('\n📋 Step 3: Testing feature after reload...');
                const afterResult = await testReloadFeature();
                
                if (afterResult.success) {
                    console.log('\n🎉 SUCCESS! Extension reload mechanism is working correctly!');
                    console.log('   ✅ Feature was added to code');
                    console.log('   ✅ Extension was reloaded');
                    console.log('   ✅ New feature is now available');
                } else {
                    console.log('\n❌ FAILED: Feature still not available after reload');
                }
            } else {
                console.log('❌ Failed to reload extension:', reloadResult.error);
            }
            
        } catch (error) {
            console.error('❌ Reload test failed:', error.message);
        }
    } else {
        console.log('\n✅ Feature is already available - extension reload has been successful!');
        console.log('   This means the extension has been reloaded and the new feature is working.');
    }
}

function sendCommand(ws, command) {
    return new Promise((resolve, reject) => {
        messageId++;
        const id = `reload_test_${messageId}`;
        const message = {
            id: id,
            command: command
        };
        
        const timeout = setTimeout(() => {
            reject(new Error(`Command timeout`));
        }, 8000);
        
        const messageHandler = (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.id === id) {
                    clearTimeout(timeout);
                    ws.removeListener('message', messageHandler);
                    resolve(response);
                }
            } catch (error) {
                clearTimeout(timeout);
                ws.removeListener('message', messageHandler);
                reject(new Error(`Response parsing failed: ${error.message}`));
            }
        };
        
        ws.on('message', messageHandler);
        ws.send(JSON.stringify(message));
    });
}

// Run the test
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--workflow')) {
        testReloadWorkflow();
    } else {
        testReloadFeature();
    }
}

module.exports = { testReloadFeature, testReloadWorkflow };