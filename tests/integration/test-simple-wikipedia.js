#!/usr/bin/env node
/**
 * Simple Wikipedia extraction using pure BROP commands
 */

const WebSocket = require('ws');

async function testWikipediaExtraction() {
    console.log('🌐 Simple Wikipedia BROP Test');
    console.log('==============================');

    const ws = new WebSocket('ws://localhost:9223'); // BROP port
    let requestId = 1;

    return new Promise((resolve) => {
        ws.on('open', async () => {
            console.log('✅ Connected to BROP bridge');

            // Simple message handler
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log('📥 Response:', message.id, message.success ? '✅' : '❌');
                    if (message.success && message.result) {
                        handleResult(message);
                    } else if (!message.success) {
                        console.log('   ❌ Error:', message.error);
                    }
                } catch (error) {
                    console.log('📝 Raw:', data.toString().substring(0, 100) + '...');
                }
            });

            // Test 1: Navigate to Wikipedia
            console.log('\n🌐 Test 1: Creating tab and navigating to Wikipedia...');
            const createCommand = {
                id: requestId++,
                method: 'create_tab',
                params: { url: 'https://en.wikipedia.org/wiki/Chrome_browser' }
            };
            ws.send(JSON.stringify(createCommand));

            // Wait a moment
            setTimeout(() => {
                // Test 2: Get page content
                console.log('\n📄 Test 2: Getting page content...');
                const contentCommand = {
                    id: requestId++,
                    method: 'get_page_content',
                    params: {}
                };
                ws.send(JSON.stringify(contentCommand));
            }, 3000);

            // Wait more
            setTimeout(() => {
                // Test 3: Execute JavaScript to extract title
                console.log('\n🔍 Test 3: Extracting page title...');
                const jsCommand = {
                    id: requestId++,
                    method: 'execute_console',
                    params: { 
                        code: 'JSON.stringify({title: document.title, wordCount: document.body.innerText.split(" ").length})'
                    }
                };
                ws.send(JSON.stringify(jsCommand));
            }, 6000);

            // Wait more
            setTimeout(() => {
                // Test 4: Get simplified DOM as markdown
                console.log('\n🌳 Test 4: Getting simplified DOM...');
                const domCommand = {
                    id: requestId++,
                    method: 'get_simplified_dom',
                    params: { 
                        format: 'markdown',
                        max_depth: 3
                    }
                };
                ws.send(JSON.stringify(domCommand));
            }, 9000);

            // Extract Wikipedia content
            setTimeout(() => {
                console.log('\n📖 Test 5: Extracting Wikipedia data...');
                const extractCommand = {
                    id: requestId++,
                    method: 'execute_console',
                    params: { 
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
            }, 12000);

            // Take screenshot
            setTimeout(() => {
                console.log('\n📸 Test 6: Taking screenshot...');
                const screenshotCommand = {
                    id: requestId++,
                    method: 'get_screenshot',
                    params: { format: 'png' }
                };
                ws.send(JSON.stringify(screenshotCommand));
            }, 15000);

            // Close test
            setTimeout(() => {
                console.log('\n✅ All BROP tests completed!');
                ws.close();
                resolve();
            }, 18000);
        });

        ws.on('error', (error) => {
            console.error('❌ Connection error:', error.message);
            resolve();
        });

        ws.on('close', () => {
            console.log('🔌 Disconnected from bridge');
            resolve();
        });
    });

    function handleResult(message) {
        if (message.result) {
            switch (message.id) {
                case 1: // Navigation
                    console.log('   ✅ Navigation completed');
                    break;
                case 2: // Page content
                    console.log(`   ✅ Page loaded: ${message.result.title}`);
                    console.log(`   📄 URL: ${message.result.url}`);
                    break;
                case 3: // JavaScript execution
                    try {
                        const data = JSON.parse(message.result.result);
                        console.log(`   ✅ Page info: ${data.title} (${data.wordCount} words)`);
                    } catch {
                        console.log(`   ✅ Script result: ${message.result.result}`);
                    }
                    break;
                case 4: // Simplified DOM
                    if (message.result.simplified_markdown) {
                        console.log(`   ✅ Markdown extracted (${message.result.simplified_markdown.length} chars)`);
                        console.log('\n📋 SIMPLIFIED MARKDOWN PREVIEW:');
                        console.log('-'.repeat(50));
                        console.log(message.result.simplified_markdown.substring(0, 500) + '...');
                        console.log('-'.repeat(50));
                    }
                    break;
                case 5: // Wikipedia extraction
                    try {
                        const data = typeof message.result.result === 'string' ? 
                            JSON.parse(message.result.result) : message.result.result;
                        console.log(`   ✅ Wikipedia data extracted:`);
                        console.log(`      Title: ${data.title}`);
                        console.log(`      Summary: ${data.summary.substring(0, 100)}...`);
                        console.log(`      Sections: ${data.sections.join(', ')}`);
                        console.log(`      Word count: ${data.wordCount}`);
                        
                        // Generate markdown
                        const markdown = generateMarkdown(data);
                        console.log('\n📝 GENERATED MARKDOWN:');
                        console.log('='.repeat(60));
                        console.log(markdown);
                        console.log('='.repeat(60));
                    } catch (error) {
                        console.log(`   ⚠️  Could not parse extraction result: ${message.result.result}`);
                    }
                    break;
                case 6: // Screenshot
                    console.log(`   ✅ Screenshot captured (${message.result.image_data.length} chars base64)`);
                    break;
            }
        }
    }

    function generateMarkdown(data) {
        return `# ${data.title}

**Source:** [${data.url}](${data.url})
**Extracted:** ${new Date().toLocaleString()}
**Word Count:** ${data.wordCount.toLocaleString()} words

## Summary

${data.summary}

## Article Sections

${data.sections.map((section, i) => `${i + 1}. ${section}`).join('\n')}

## Extraction Info

- **Method:** BROP JavaScript execution
- **Sections found:** ${data.sections.length}
- **Content source:** Wikipedia
- **Extraction date:** ${new Date().toISOString()}

---
*Extracted using BROP (Browser Remote Operations Protocol)*`;
    }
}

// Run the test
if (require.main === module) {
    testWikipediaExtraction().catch(console.error);
}