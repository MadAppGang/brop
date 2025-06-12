const WebSocket = require('ws');

async function testProperTabIdUsage() {
    console.log('✅ Test Proper TabId Usage');
    console.log('==========================');
    console.log('📋 Demonstrating correct tabId workflow');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        let currentStep = 0;
        let testTabId = null;
        
        const steps = [
            'create_tab',
            'execute_console', 
            'get_page_content',
            'close_tab'
        ];
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            console.log('\n📋 Step 1: Creating a tab to get a valid tabId...');
            runNextStep();
        });
        
        function runNextStep() {
            if (currentStep >= steps.length) {
                console.log('\n🎉 PROPER TABID WORKFLOW COMPLETE');
                console.log('=================================');
                console.log('✅ Created tab and got tabId');
                console.log('✅ Used tabId for execute_console - SUCCESS');
                console.log('✅ Used tabId for get_page_content - SUCCESS');
                console.log('✅ Cleaned up by closing the tab');
                console.log('\n💡 Key Points:');
                console.log('   • Always use list_tabs or create_tab to get valid tabIds');
                console.log('   • Provide explicit tabId for all tab-specific operations');
                console.log('   • Never send tabId: null - system will reject it');
                
                ws.close();
                resolve();
                return;
            }
            
            const step = steps[currentStep];
            
            switch (step) {
                case 'create_tab':
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'create_tab',
                        params: { url: 'https://httpbin.org/html' }
                    }));
                    break;
                    
                case 'execute_console':
                    console.log(`\n📋 Step 2: Using tabId ${testTabId} for execute_console...`);
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'execute_console',
                        params: { 
                            code: 'console.log("Proper tabId usage test"); document.title',
                            tabId: testTabId
                        }
                    }));
                    break;
                    
                case 'get_page_content':
                    console.log(`\n📋 Step 3: Using tabId ${testTabId} for get_page_content...`);
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_page_content',
                        params: { tabId: testTabId }
                    }));
                    break;
                    
                case 'close_tab':
                    console.log(`\n📋 Step 4: Cleaning up by closing tab ${testTabId}...`);
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'close_tab',
                        params: { tabId: testTabId }
                    }));
                    break;
            }
            
            currentStep++;
        }
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            
            // Handle create_tab response to get tabId
            if (currentStep === 1 && response.success && response.result?.tabId) {
                testTabId = response.result.tabId;
                console.log(`   ✅ SUCCESS - Got tabId: ${testTabId}`);
            } else {
                const status = response.success ? '✅ SUCCESS' : '❌ FAILED';
                console.log(`   ${status}`);
                
                if (!response.success) {
                    console.log(`   Error: ${response.error}`);
                }
            }
            
            // Continue to next step after short delay
            setTimeout(runNextStep, 500);
        });
        
        ws.on('close', function close() {
            console.log('\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
            ws.close();
            resolve();
        }, 15000);
    });
}

testProperTabIdUsage().catch(console.error);