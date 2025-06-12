#!/usr/bin/env node
/**
 * Check Missing CDP Methods
 * 
 * Let's systematically test what CDP methods Playwright expects
 * but our extension doesn't support yet.
 */

const WebSocket = require('ws');

async function testCriticalCdpMethods() {
    console.log('🔍 Test Critical CDP Methods for Page Creation');
    console.log('=' + '='.repeat(60));
    
    const ws = new WebSocket('ws://localhost:9222');
    
    // Methods that are critical for page/frame initialization
    const criticalMethods = [
        'Target.createTarget',
        'Target.attachToTarget', 
        'Target.setAutoAttach',
        'Target.setDiscoverTargets',
        'Page.enable',
        'Page.getFrameTree',
        'Page.setLifecycleEventsEnabled',
        'Runtime.enable',
        'Runtime.runIfWaitingForDebugger',
        'Runtime.addBinding',
        'Page.addScriptToEvaluateOnNewDocument',
        'Network.enable',
        'Target.sendMessageToTarget',
        'Target.detachFromTarget'
    ];
    
    const results = [];
    
    ws.on('open', async () => {
        console.log('📡 Connected to CDP server');
        
        for (let i = 0; i < criticalMethods.length; i++) {
            const method = criticalMethods[i];
            const id = i + 1;
            
            console.log(`🧪 Testing ${method}...`);
            
            const message = {
                id: id,
                method: method,
                params: getDefaultParams(method)
            };
            
            ws.send(JSON.stringify(message));
            
            // Wait a bit between calls
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Wait for all responses, then close
        setTimeout(() => {
            ws.close();
        }, 5000);
    });
    
    ws.on('message', (data) => {
        try {
            const response = JSON.parse(data.toString());
            
            if (response.id) {
                const method = criticalMethods[response.id - 1];
                const success = !!response.result;
                const error = response.error?.message || null;
                
                results.push({ method, success, error });
                
                console.log(`📥 ${method}: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
                if (error) {
                    console.log(`   Error: ${error}`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Parse error: ${error.message}`);
        }
    });
    
    ws.on('close', () => {
        console.log('\n📊 CDP Method Test Results:');
        console.log('=' + '='.repeat(50));
        
        const failed = results.filter(r => !r.success);
        const succeeded = results.filter(r => r.success);
        
        console.log(`✅ Successful: ${succeeded.length}/${results.length}`);
        console.log(`❌ Failed: ${failed.length}/${results.length}`);
        
        if (failed.length > 0) {
            console.log('\n🚨 Missing or Broken Methods:');
            failed.forEach(f => {
                console.log(`   ${f.method}: ${f.error || 'Unknown error'}`);
            });
        }
        
        console.log('\n💡 Critical for Page Creation:');
        const pageCreationMethods = [
            'Target.createTarget', 'Target.attachToTarget', 'Page.getFrameTree',
            'Runtime.enable', 'Page.enable'
        ];
        
        pageCreationMethods.forEach(method => {
            const result = results.find(r => r.method === method);
            if (result) {
                console.log(`   ${method}: ${result.success ? '✅' : '❌'}`);
            }
        });
    });
    
    ws.on('error', (error) => {
        console.log(`❌ Connection error: ${error.message}`);
    });
}

function getDefaultParams(method) {
    const defaults = {
        'Target.createTarget': { url: 'about:blank' },
        'Target.attachToTarget': { targetId: 'test_target', flatten: false },
        'Target.setAutoAttach': { autoAttach: true, waitForDebuggerOnStart: false },
        'Target.setDiscoverTargets': { discover: true },
        'Page.setLifecycleEventsEnabled': { enabled: true },
        'Runtime.addBinding': { name: 'test_binding' },
        'Page.addScriptToEvaluateOnNewDocument': { source: 'console.log("test");' },
        'Target.sendMessageToTarget': { message: '{"id":1,"method":"Runtime.evaluate","params":{"expression":"1+1"}}', targetId: 'test_target' }
    };
    
    return defaults[method] || {};
}

async function main() {
    console.log('🎯 Check Missing CDP Methods');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find which CDP methods are missing for page creation');
    console.log('');
    
    await testCriticalCdpMethods();
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Implement any missing critical methods');
    console.log('2. Fix broken method implementations');
    console.log('3. Test page creation again');
}

main();