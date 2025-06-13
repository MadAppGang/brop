#!/usr/bin/env node
/**
 * Simple Wikipedia extraction using proper BROP commands with tabId handling
 */

const WebSocket = require('ws');
const { createBROPConnection } = require('../../client');

async function testWikipediaExtraction() {
    console.log('🌐 Simple Wikipedia BROP Test');
    console.log('==============================');

    const ws = createBROPConnection();
    let requestId = 1;
    let currentTabId = null;
    let testStep = 1;

    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✅ Connected to BROP bridge');

            // Start by listing tabs or creating one
            console.log('\n📋 Step 1: Getting available tabs...');
            const tabsCommand = {
                id: requestId++,
                method: 'list_tabs',
                params: {}
            };
            ws.send(JSON.stringify(tabsCommand));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📥 Response ${message.id}: ${message.success ? '✅' : '❌'}`);
                
                if (message.success && message.result) {
                    handleSuccessResponse(message);
                } else if (!message.success) {
                    console.log('   ❌ Error:', message.error);
                    proceedToNextTest();
                }
            } catch (error) {
                console.log('📝 Raw:', data.toString().substring(0, 100) + '...');
                proceedToNextTest();
            }
        });

        function handleSuccessResponse(message) {
            if (message.id === 1) {
                // Handle tabs list
                const tabs = message.result.tabs || [];
                console.log(`   ✅ Found ${tabs.length} tabs`);
                
                const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
                
                if (!accessibleTab) {
                    console.log('\n🌐 Creating new tab for Wikipedia...');
                    const createCommand = {
                        id: requestId++,
                        method: 'create_tab',
                        params: { url: 'https://en.wikipedia.org/wiki/JavaScript' }
                    };
                    ws.send(JSON.stringify(createCommand));
                    return;
                }
                
                currentTabId = accessibleTab.tabId;
                console.log(`   🎯 Using tab ${currentTabId}: ${accessibleTab.title}`);
                
                // Navigate to Wikipedia
                console.log('\n🌐 Test 2: Navigating to Wikipedia...');
                const navCommand = {
                    id: requestId++,
                    method: 'navigate',
                    params: { 
                        tabId: currentTabId,
                        url: 'https://en.wikipedia.org/wiki/JavaScript' 
                    }
                };
                ws.send(JSON.stringify(navCommand));
                
            } else if (message.result.tabId && !currentTabId) {
                // Handle tab creation
                currentTabId = message.result.tabId;
                console.log(`   ✅ Created tab ${currentTabId}`);
                
                // Wait for page to load, then start tests
                setTimeout(() => {
                    runPageContentTest();
                }, 3000);
                
            } else {
                // Handle test responses
                handleTestResponse(message);
            }
        }

        function runPageContentTest() {
            console.log('\n📄 Test 3: Getting page content...');
            const contentCommand = {
                id: requestId++,
                method: 'get_page_content',
                params: { tabId: currentTabId }
            };
            ws.send(JSON.stringify(contentCommand));
        }

        function handleTestResponse(message) {
            switch (testStep) {
                case 1: // Navigation complete
                    console.log('   ✅ Navigation completed');
                    setTimeout(() => runPageContentTest(), 2000);
                    testStep++;
                    break;
                    
                case 2: // Page content
                    const content = message.result;
                    console.log(`   ✅ Page content retrieved: ${content.content?.length || 0} chars`);
                    console.log(`   📄 Title: ${content.title || 'Unknown'}`);
                    
                    // Test 4: Extract page title
                    console.log('\n🔍 Test 4: Extracting page title...');
                    const titleCommand = {
                        id: requestId++,
                        method: 'execute_console',
                        params: { 
                            tabId: currentTabId,
                            code: 'document.title'
                        }
                    };
                    ws.send(JSON.stringify(titleCommand));
                    testStep++;
                    break;
                    
                case 3: // Title extraction
                    console.log(`   ✅ Title extracted: ${message.result.result || 'Unknown'}`);
                    
                    // Test 5: Get simplified DOM
                    console.log('\n🌳 Test 5: Getting simplified DOM...');
                    const domCommand = {
                        id: requestId++,
                        method: 'get_simplified_dom',
                        params: { 
                            tabId: currentTabId,
                            format: 'markdown'
                        }
                    };
                    ws.send(JSON.stringify(domCommand));
                    testStep++;
                    break;
                    
                case 4: // Simplified DOM
                    const domResult = message.result;
                    console.log(`   ✅ DOM extracted: ${domResult.content?.length || 0} chars`);
                    console.log(`   📊 Format: ${domResult.format || 'unknown'}`);
                    
                    // Test 6: Extract Wikipedia data
                    console.log('\n📖 Test 6: Extracting Wikipedia data...');
                    const extractCommand = {
                        id: requestId++,
                        method: 'execute_console',
                        params: { 
                            tabId: currentTabId,
                            code: `
                                // Simple Wikipedia extraction
                                const title = document.title.replace(' - Wikipedia', '');
                                const summary = document.querySelector('#mw-content-text p')?.textContent.substring(0, 300) || 'No summary found';
                                const headings = Array.from(document.querySelectorAll('h2 .mw-headline')).map(h => h.textContent).slice(0, 5);
                                
                                JSON.stringify({
                                    title: title,
                                    url: window.location.href,
                                    summary: summary + '...',
                                    sections: headings,
                                    wordCount: document.body.innerText.split(' ').length
                                });
                            `
                        }
                    };
                    ws.send(JSON.stringify(extractCommand));
                    testStep++;
                    break;
                    
                case 5: // Wikipedia data extraction
                    console.log(`   ✅ Wikipedia data extracted`);
                    try {
                        const data = JSON.parse(message.result.result);
                        console.log(`   📄 Title: ${data.title}`);
                        console.log(`   📝 Summary: ${data.summary.substring(0, 100)}...`);
                        console.log(`   📊 Sections: ${data.sections.join(', ')}`);
                    } catch (e) {
                        console.log(`   📝 Raw result: ${message.result.result}`);
                    }
                    
                    // Test 7: Take screenshot
                    console.log('\n📸 Test 7: Taking screenshot...');
                    const screenshotCommand = {
                        id: requestId++,
                        method: 'get_screenshot',
                        params: { 
                            tabId: currentTabId,
                            format: 'png' 
                        }
                    };
                    ws.send(JSON.stringify(screenshotCommand));
                    testStep++;
                    break;
                    
                case 6: // Screenshot
                    const screenshot = message.result;
                    console.log(`   ✅ Screenshot captured: ${screenshot.data?.length || 0} bytes`);
                    console.log(`   📊 Format: ${screenshot.format || 'unknown'}`);
                    
                    // Complete test
                    setTimeout(() => {
                        console.log('\n✅ All BROP tests completed successfully!');
                        ws.close();
                        resolve();
                    }, 1000);
                    break;
            }
        }

        function proceedToNextTest() {
            // Skip failed test and continue
            testStep++;
            if (testStep <= 6 && currentTabId) {
                setTimeout(() => {
                    switch (testStep) {
                        case 2: runPageContentTest(); break;
                        case 3: 
                            const titleCommand = {
                                id: requestId++,
                                method: 'execute_console',
                                params: { tabId: currentTabId, code: 'document.title' }
                            };
                            ws.send(JSON.stringify(titleCommand));
                            break;
                        // Add other cases as needed
                    }
                }, 1000);
            } else {
                setTimeout(() => {
                    console.log('\n✅ All BROP tests completed!');
                    ws.close();
                    resolve();
                }, 1000);
            }
        }

        ws.on('error', (error) => {
            console.error('❌ Connection error:', error.message);
            resolve();
        });

        ws.on('close', () => {
            console.log('🔌 Disconnected from bridge');
            resolve();
        });
    });
}

// Run the test
if (require.main === module) {
    testWikipediaExtraction().catch(console.error);
}