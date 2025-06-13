const WebSocket = require('ws');

async function testDOMExtractionOnly() {
    console.log('🧪 BROP DOM Extraction Only Test');
    console.log('================================');
    console.log('📋 Testing simplified DOM extraction on existing tab');
    
    const ws = new WebSocket('ws://localhost:9223');
    
    return new Promise((resolve, reject) => {
        let messageId = 0;
        
        ws.on('open', function open() {
            console.log('✅ Connected to BROP bridge');
            
            // First, list tabs to see what's available
            ws.send(JSON.stringify({
                id: ++messageId,
                method: 'list_tabs',
                params: {}
            }));
        });
        
        ws.on('message', function message(data) {
            const response = JSON.parse(data);
            
            console.log(`📥 Response ${response.id}: ${response.success ? '✅ SUCCESS' : '❌ FAILED'}`);
            
            if (response.success) {
                if (response.id === 1) {
                    // List tabs response
                    const tabs = response.result.tabs || [];
                    console.log(`   📋 Found ${tabs.length} tabs`);
                    
                    // Find an accessible tab (not chrome://)
                    const accessibleTab = tabs.find(tab => tab.accessible && tab.url !== 'about:blank');
                    
                    if (!accessibleTab) {
                        console.log('   ❌ No accessible tabs found. Creating a new one...');
                        
                        ws.send(JSON.stringify({
                            id: ++messageId,
                            method: 'create_tab',
                            params: { url: 'https://httpbin.org/html' }
                        }));
                        return;
                    }
                    
                    console.log(`   🎯 Using tab ${accessibleTab.tabId}: ${accessibleTab.title}`);
                    console.log(`   🔗 URL: ${accessibleTab.url}`);
                    
                    // Test markdown extraction
                    console.log('\\n🔧 Testing Markdown Extraction...');
                    ws.send(JSON.stringify({
                        id: ++messageId,
                        method: 'get_simplified_dom',
                        params: { 
                            tabId: accessibleTab.tabId,
                            format: 'markdown',
                            enableDetailedResponse: false
                        }
                    }));
                    
                } else if (response.id === 2) {
                    // Create tab response (if needed)
                    const tabId = response.result.tabId;
                    console.log(`   ✅ Created tab ${tabId}`);
                    
                    // Wait for page to load, then test extraction
                    setTimeout(() => {
                        console.log('\\n🔧 Testing Markdown Extraction on new tab...');
                        ws.send(JSON.stringify({
                            id: ++messageId,
                            method: 'get_simplified_dom',
                            params: { 
                                tabId: tabId,
                                format: 'markdown',
                                enableDetailedResponse: false
                            }
                        }));
                    }, 3000);
                    
                } else {
                    // DOM extraction response
                    const markdownLength = response.result.markdown?.length || 0;
                    const htmlLength = response.result.html?.length || 0;
                    
                    console.log(`   ✅ Extraction successful!`);
                    console.log(`   📊 Format: ${response.result.format}`);
                    console.log(`   📊 Source: ${response.result.stats?.source}`);
                    console.log(`   📄 Title: ${response.result.title}`);
                    console.log(`   🔗 URL: ${response.result.url}`);
                    console.log(`   📏 Content length: ${markdownLength || htmlLength} characters`);
                    
                    if (response.result.markdown) {
                        console.log(`   📋 Markdown sample: ${response.result.markdown.substring(0, 150)}...`);
                    }
                    if (response.result.html) {
                        const textSample = response.result.html.replace(/<[^>]*>/g, '').trim();
                        console.log(`   📋 HTML text sample: ${textSample.substring(0, 150)}...`);
                    }
                    
                    // Test HTML extraction too
                    if (response.result.format === 'markdown') {
                        console.log('\\n🔧 Testing HTML Extraction...');
                        ws.send(JSON.stringify({
                            id: ++messageId,
                            method: 'get_simplified_dom',
                            params: { 
                                tabId: response.result.tabId,
                                format: 'html',
                                enableDetailedResponse: false
                            }
                        }));
                    } else {
                        // Both tests done
                        console.log('\\n🎉 ALL DOM EXTRACTION TESTS COMPLETED!');
                        console.log('✅ Markdown extraction working');
                        console.log('✅ HTML extraction working');
                        console.log('✅ Content processing functional');
                        ws.close();
                        resolve();
                    }
                }
            } else {
                console.log(`   ❌ ERROR: ${response.error}`);
                
                if (response.error.includes('Content extraction failed')) {
                    console.log('   💡 This indicates an issue with our extraction method');
                    console.log('   🔍 Check browser console for more details');
                }
                
                ws.close();
                resolve();
            }
        });
        
        ws.on('close', function close() {
            console.log('\\n🔌 Disconnected from bridge');
        });
        
        ws.on('error', reject);
        
        // Timeout after 30 seconds
        setTimeout(() => {
            console.log('⏰ Test timeout');
            ws.close();
            resolve();
        }, 30000);
    });
}

testDOMExtractionOnly().catch(console.error);