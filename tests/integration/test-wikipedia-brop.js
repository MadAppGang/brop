#!/usr/bin/env node
/**
 * Wikipedia Data Extraction Test using BROP commands
 * Opens Wikipedia, extracts content, and displays as markdown
 */

const WebSocket = require('ws');
const { createNamedBROPConnection } = require('../../client');

class WikipediaBROPTest {
    constructor() {
        this.ws = null;
        this.requestId = 1;
        this.responses = new Map();
    }

    async runTest() {
        console.log('🌐 Wikipedia Data Extraction Test (BROP)');
        console.log('=========================================');

        try {
            // Connect to BROP bridge
            console.log('📋 Connecting to BROP bridge...');
            await this.connect();

            // First get available tabs or create one
            console.log('\n📋 Getting available tabs...');
            const tabsResult = await this.sendBROPCommand('list_tabs', {});
            let currentTabId = null;
            
            const tabs = tabsResult.tabs || [];
            const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
            
            if (accessibleTab) {
                currentTabId = accessibleTab.tabId;
                console.log(`   ✅ Using existing tab ${currentTabId}: ${accessibleTab.title}`);
            } else {
                console.log('   🔧 Creating new tab...');
                const createResult = await this.sendBROPCommand('create_tab', {
                    url: 'about:blank'
                });
                currentTabId = createResult.tabId;
                console.log(`   ✅ Created new tab ${currentTabId}`);
            }

            // Navigate to Wikipedia
            console.log('\n🌐 Navigating to Wikipedia AI page...');
            const navResult = await this.sendBROPCommand('navigate', {
                tabId: currentTabId,
                url: 'https://en.wikipedia.org/wiki/Artificial_intelligence'
            });
            console.log('   ✅ Navigation completed');

            // Wait for page to load
            console.log('\n⏰ Waiting for page to load...');
            await this.sleep(4000);

            // Get page content
            console.log('\n📄 Getting page content...');
            const pageContent = await this.sendBROPCommand('get_page_content', {
                tabId: currentTabId
            });
            console.log(`   ✅ Page loaded: ${pageContent.title}`);
            console.log(`   📄 URL: ${pageContent.url}`);

            // Extract structured content using JavaScript
            console.log('\n📖 Extracting Wikipedia data...');
            const extractResult = await this.sendBROPCommand('execute_console', {
                tabId: currentTabId,
                code: `
                    // Extract Wikipedia article content
                    const extractWikipediaContent = () => {
                        const content = {
                            title: document.title.replace(' - Wikipedia', ''),
                            url: window.location.href,
                            summary: '',
                            sections: [],
                            infobox: {},
                            categories: [],
                            wordCount: 0
                        };

                        // Get the main content div
                        const mainContent = document.querySelector('#mw-content-text .mw-parser-output');
                        if (!mainContent) return content;

                        // Extract summary (first few paragraphs)
                        const firstParagraphs = mainContent.querySelectorAll('p');
                        const summaryParts = [];
                        for (let i = 0; i < Math.min(3, firstParagraphs.length); i++) {
                            const text = firstParagraphs[i].textContent.trim();
                            if (text && text.length > 50 && !text.includes('coordinates')) {
                                summaryParts.push(text);
                            }
                        }
                        content.summary = summaryParts.join('\\n\\n');

                        // Extract section headings
                        const headings = mainContent.querySelectorAll('h2, h3');
                        headings.forEach(heading => {
                            const titleElement = heading.querySelector('.mw-headline');
                            if (titleElement) {
                                const title = titleElement.textContent.trim();
                                if (title && !title.includes('References') && !title.includes('External links') && !title.includes('Notes')) {
                                    content.sections.push({
                                        level: heading.tagName.toLowerCase(),
                                        title: title,
                                        id: titleElement.id || ''
                                    });
                                }
                            }
                        });

                        // Extract infobox data
                        const infobox = mainContent.querySelector('.infobox');
                        if (infobox) {
                            const rows = infobox.querySelectorAll('tr');
                            rows.forEach(row => {
                                const header = row.querySelector('th');
                                const data = row.querySelector('td');
                                if (header && data) {
                                    const key = header.textContent.trim();
                                    const value = data.textContent.trim().replace(/\\[.*?\\]/g, ''); // Remove citation markers
                                    if (key && value && value.length < 200 && !key.includes('website')) {
                                        content.infobox[key] = value;
                                    }
                                }
                            });
                        }

                        // Count words in article
                        const allText = mainContent.textContent || '';
                        content.wordCount = allText.split(/\\s+/).length;

                        // Extract some categories
                        const categoryLinks = document.querySelectorAll('#mw-normal-catlinks a');
                        categoryLinks.forEach((link, index) => {
                            if (index < 10) { // Limit to first 10 categories
                                const category = link.textContent.trim();
                                if (category && !category.includes(':')) {
                                    content.categories.push(category);
                                }
                            }
                        });

                        return content;
                    };

                    extractWikipediaContent();
                `
            });

            const extractedData = extractResult.result;
            console.log(`   ✅ Extracted data for: ${extractedData.title}`);
            console.log(`   📊 Word count: ${extractedData.wordCount}`);
            console.log(`   📑 Sections: ${extractedData.sections.length}`);
            console.log(`   📋 Infobox items: ${Object.keys(extractedData.infobox).length}`);

            // Get simplified DOM in markdown format
            console.log('\n🌳 Getting simplified DOM as markdown...');
            const domResult = await this.sendBROPCommand('get_simplified_dom', {
                tabId: currentTabId,
                format: 'markdown',
                max_depth: 4
            });
            console.log(`   ✅ Simplified markdown extracted (${domResult.simplified_markdown.length} chars)`);

            // Take a screenshot
            console.log('\n📸 Taking screenshot...');
            const screenshot = await this.sendBROPCommand('get_screenshot', {
                tabId: currentTabId,
                format: 'png'
            });
            console.log(`   ✅ Screenshot captured (${screenshot.image_data.length} chars base64)`);

            // Convert extracted data to markdown
            console.log('\n📝 Converting to comprehensive markdown...');
            const markdown = this.convertToMarkdown(extractedData, domResult.simplified_markdown);

            // Display the markdown
            console.log('\n' + '='.repeat(80));
            console.log('📋 EXTRACTED WIKIPEDIA CONTENT (MARKDOWN)');
            console.log('='.repeat(80));
            console.log(markdown);
            console.log('='.repeat(80));

            console.log('\n✅ Wikipedia BROP extraction test completed successfully!');
            console.log('🎉 All BROP commands working properly for data extraction!');

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Make sure the bridge server is running (pnpm run bridge)');
            console.error('   2. Make sure the Chrome extension is loaded and connected');
            console.error('   3. Check extension popup shows "Connected" status');
            console.error('   4. Ensure internet access for Wikipedia');
        } finally {
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = createNamedBROPConnection('wikipedia-test');

            this.ws.on('open', () => {
                console.log('   ✅ Connected to BROP bridge server');
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.id && this.responses.has(message.id)) {
                        const { resolve, reject } = this.responses.get(message.id);
                        this.responses.delete(message.id);
                        
                        if (message.success) {
                            resolve(message.result);
                        } else {
                            reject(new Error(message.error || 'Command failed'));
                        }
                    }
                } catch (error) {
                    console.log('📝 Raw response:', data.toString());
                }
            });

            this.ws.on('error', (error) => {
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('🔌 Disconnected from BROP bridge');
            });
        });
    }

    async sendBROPCommand(method, params) {
        return new Promise((resolve, reject) => {
            const id = this.requestId++;
            
            this.responses.set(id, { resolve, reject });
            
            const message = {
                id: id,
                method: method,
                params: params
            };

            this.ws.send(JSON.stringify(message));

            // Timeout after 15 seconds
            setTimeout(() => {
                if (this.responses.has(id)) {
                    this.responses.delete(id);
                    reject(new Error(`Timeout waiting for ${method} command`));
                }
            }, 15000);
        });
    }

    convertToMarkdown(data, simplifiedMarkdown) {
        let markdown = '';

        // Title
        markdown += `# ${data.title}\n\n`;

        // URL and metadata
        markdown += `**Source:** [Wikipedia Article](${data.url})\n`;
        markdown += `**Extracted:** ${new Date().toLocaleString()}\n`;
        markdown += `**Word Count:** ~${data.wordCount.toLocaleString()} words\n\n`;

        // Summary
        if (data.summary) {
            markdown += `## Summary\n\n${data.summary}\n\n`;
        }

        // Quick Facts (Infobox)
        if (Object.keys(data.infobox).length > 0) {
            markdown += `## Quick Facts\n\n`;
            for (const [key, value] of Object.entries(data.infobox)) {
                if (value.length < 150) { // Only include concise values
                    markdown += `- **${key}**: ${value}\n`;
                }
            }
            markdown += '\n';
        }

        // Article Structure
        if (data.sections && data.sections.length > 0) {
            markdown += `## Article Structure\n\n`;
            markdown += `This article contains ${data.sections.length} main sections:\n\n`;
            data.sections.slice(0, 12).forEach((section, index) => { // Limit to first 12 sections
                const prefix = section.level === 'h2' ? '###' : '####';
                markdown += `${index + 1}. ${prefix} ${section.title}\n`;
            });
            markdown += '\n';
        }

        // Categories
        if (data.categories && data.categories.length > 0) {
            markdown += `## Categories\n\n`;
            markdown += `This article is categorized under:\n\n`;
            data.categories.forEach(category => {
                markdown += `- ${category}\n`;
            });
            markdown += '\n';
        }

        // Simplified content preview
        if (simplifiedMarkdown && simplifiedMarkdown.length > 100) {
            markdown += `## Content Preview (Simplified)\n\n`;
            // Take first 1000 characters of simplified markdown
            const preview = simplifiedMarkdown.substring(0, 1000);
            markdown += preview;
            if (simplifiedMarkdown.length > 1000) {
                markdown += '\n\n*[Content truncated for preview...]*\n';
            }
            markdown += '\n';
        }

        // Extraction stats
        markdown += `## Extraction Statistics\n\n`;
        markdown += `- **Sections extracted**: ${data.sections ? data.sections.length : 0}\n`;
        markdown += `- **Infobox fields**: ${Object.keys(data.infobox).length}\n`;
        markdown += `- **Categories found**: ${data.categories ? data.categories.length : 0}\n`;
        markdown += `- **Simplified content**: ${simplifiedMarkdown ? simplifiedMarkdown.length : 0} characters\n`;
        markdown += `- **Extraction method**: BROP JavaScript execution\n`;

        return markdown;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the test
async function main() {
    const test = new WikipediaBROPTest();
    await test.runTest();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { WikipediaBROPTest };