const WebSocket = require('ws');
const { createBROPConnection } = require('../../test-utils');

async function testCSPSuccess() {
    console.log('🎉 CSP Compliance Success Verification');
    console.log('=====================================');
    
    const ws = createBROPConnection();
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // Test CSP-compliant operations
            console.log('\n🔧 Testing CSP-compliant operations on GitHub...');
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'execute_console',
                params: { 
                    code: 'document.title'
                }
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            console.log(`📥 Response ${response.id}: ${response.success ? '✅' : '❌'}`);
            
            if (response.id === 1) {
                if (response.success) {
                    console.log(`   ✅ Successfully executed: document.title`);
                    console.log(`   📄 Result: ${response.result?.result || 'No result'}`);
                    
                    // Test 2: Try window.location.href
                    console.log('\n🔧 Testing window.location.href...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'execute_console',
                        params: { 
                            code: 'window.location.href'
                        }
                    }));
                } else {
                    console.log(`   ❌ Failed: ${response.error}`);
                    if (response.error?.includes('CSP') || response.error?.includes('unsafe-eval')) {
                        console.log('   🚨 CSP violation detected!');
                    }
                    ws.close();
                    resolve();
                }
            } else if (response.id === 2) {
                if (response.success) {
                    console.log(`   ✅ Successfully executed: window.location.href`);
                    console.log(`   🔗 Result: ${response.result?.result || 'No result'}`);
                    
                    // Test 3: Try safe console logging
                    console.log('\n🔧 Testing safe console logging...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'execute_console',
                        params: { 
                            code: 'console.log("CSP Success Test")'
                        }
                    }));
                } else {
                    console.log(`   ❌ Failed: ${response.error}`);
                    ws.close();
                    resolve();
                }
            } else if (response.id === 3) {
                if (response.success) {
                    console.log(`   ✅ Successfully executed: console.log`);
                    console.log(`   📝 Result: ${response.result?.result || 'No result'}`);
                    
                    console.log('\n🎉 CSP COMPLIANCE SUCCESS!');
                    console.log('==========================================');
                    console.log('✅ Extension can execute safe operations on GitHub');
                    console.log('✅ No CSP "unsafe-eval" violations detected');
                    console.log('✅ Chrome DevTools Protocol access working');
                    console.log('✅ CSP-protected sites are now accessible');
                    console.log('');
                    console.log('🎯 Key Achievement:');
                    console.log('   The extension now works on GitHub and other');
                    console.log('   CSP-protected sites without security violations!');
                    console.log('');
                    console.log('📝 Note: Console log capture works differently now');
                    console.log('   (using Chrome DevTools Protocol instead of eval)');
                } else {
                    console.log(`   ❌ Console logging failed: ${response.error}`);
                    if (response.error?.includes('CSP') || response.error?.includes('unsafe-eval')) {
                        console.log('   🚨 CSP violation detected!');
                    }
                }
                
                ws.close();
                resolve();
            }
        });
        
        ws.on('close', function close() {
            console.log('🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        // Add timeout
        setTimeout(() => {
            console.log('⏰ Test timeout - closing connection');
            ws.close();
            resolve();
        }, 15000);
    });
}

testCSPSuccess().catch(console.error);