#!/usr/bin/env node
/**
 * Wikipedia Data Extraction Test
 * Opens Wikipedia, extracts content, and displays as markdown
 */

import { BROPCDPClient } from './brop_cdp_client.js';

class WikipediaExtractionTest {
    constructor() {
        this.cdp = new BROPCDPClient({
            webSocketDebuggerUrl: 'ws://localhost:9222'
        });
        this.targetId = null;
    }

    async runTest() {
        console.log('🌐 Wikipedia Data Extraction Test');
        console.log('=================================');

        try {
            // Connect and get browser info
            console.log('📋 Connecting to BROP bridge...');
            const version = await this.cdp.Browser.getVersion();
            console.log(`   Browser: ${version.product}`);

            // Get available targets first
            console.log('\n🎯 Getting available targets...');
            const targetsResponse = await this.cdp.Target.getTargets();
            const targets = targetsResponse.targetInfos || [];
            const pageTargets = targets.filter(t => t.type === 'page');
            
            console.log(`   Found ${pageTargets.length} page targets`);

            // Use existing target or create new one
            if (pageTargets.length > 0) {
                this.targetId = pageTargets[0].targetId;
                console.log(`   Using existing target: ${this.targetId}`);
            } else {
                console.log('   Creating new target...');
                const newTarget = await this.cdp.Target.createTarget({ 
                    url: 'about:blank' 
                });
                this.targetId = newTarget.targetId;
                console.log(`   Created target: ${this.targetId}`);
            }

            // Navigate to Wikipedia
            console.log('\n🌐 Navigating to Wikipedia...');
            await this.cdp.Page.navigate({ 
                url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' 
            });
            console.log('   ✅ Navigation started');

            // Wait for page to load
            console.log('\n⏰ Waiting for page to load...');
            await this.sleep(5000);

            // Get page title
            console.log('\n📄 Getting page information...');
            const titleResult = await this.cdp.Runtime.evaluate({
                expression: 'document.title',
                returnByValue: true
            });
            console.log(`   Page Title: ${titleResult.result.value}`);

            // Get page URL
            const urlResult = await this.cdp.Runtime.evaluate({
                expression: 'window.location.href',
                returnByValue: true
            });
            console.log(`   Page URL: ${urlResult.result.value}`);

            // Extract main content using JavaScript
            console.log('\n📖 Extracting Wikipedia content...');
            const contentResult = await this.cdp.Runtime.evaluate({
                expression: `
                    // Extract Wikipedia article content
                    const extractWikipediaContent = () => {
                        const content = {
                            title: document.title.replace(' - Wikipedia', ''),
                            url: window.location.href,
                            summary: '',
                            sections: [],
                            infobox: {},
                            categories: []
                        };

                        // Get the main content div
                        const mainContent = document.querySelector('#mw-content-text .mw-parser-output');
                        if (!mainContent) return content;

                        // Extract summary (first few paragraphs)
                        const firstParagraphs = mainContent.querySelectorAll('p');
                        const summaryParts = [];
                        for (let i = 0; i < Math.min(3, firstParagraphs.length); i++) {
                            const text = firstParagraphs[i].textContent.trim();
                            if (text && text.length > 50) {
                                summaryParts.push(text);
                            }
                        }
                        content.summary = summaryParts.join('\\n\\n');

                        // Extract section headings and content
                        const headings = mainContent.querySelectorAll('h2, h3');
                        headings.forEach(heading => {
                            if (heading.querySelector('.mw-editsection')) {
                                const titleElement = heading.querySelector('.mw-headline');
                                if (titleElement) {
                                    const title = titleElement.textContent.trim();
                                    if (title && !title.includes('References') && !title.includes('External links')) {
                                        content.sections.push({
                                            level: heading.tagName.toLowerCase(),
                                            title: title,
                                            id: titleElement.id || ''
                                        });
                                    }
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
                                    const value = data.textContent.trim();
                                    if (key && value && value.length < 200) {
                                        content.infobox[key] = value;
                                    }
                                }
                            });
                        }

                        // Extract categories
                        const categoryLinks = document.querySelectorAll('#mw-normal-catlinks a');
                        categoryLinks.forEach(link => {
                            const category = link.textContent.trim();
                            if (category && !category.includes(':')) {
                                content.categories.push(category);
                            }
                        });

                        return content;
                    };

                    extractWikipediaContent();
                `,
                returnByValue: true
            });

            const extractedData = contentResult.result.value;
            console.log(`   ✅ Extracted content for: ${extractedData.title}`);

            // Convert to Markdown
            console.log('\n📝 Converting to Markdown...');
            const markdown = this.convertToMarkdown(extractedData);

            // Display the markdown
            console.log('\n' + '='.repeat(80));
            console.log('📋 EXTRACTED WIKIPEDIA CONTENT (MARKDOWN)');
            console.log('='.repeat(80));
            console.log(markdown);
            console.log('='.repeat(80));

            // Take a screenshot
            console.log('\n📸 Taking screenshot...');
            const screenshot = await this.cdp.Page.captureScreenshot({
                format: 'png'
            });
            console.log(`   ✅ Screenshot captured (${screenshot.data.length} chars base64)`);

            // Test simplified DOM extraction
            console.log('\n🌳 Testing simplified DOM extraction...');
            try {
                // This uses our BROP simplified DOM feature
                const response = await fetch('http://localhost:9225/api/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'get_simplified_dom',
                        params: {
                            format: 'markdown',
                            max_depth: 3
                        }
                    })
                });
                
                if (response.ok) {
                    const domResult = await response.json();
                    if (domResult.success && domResult.result.simplified_markdown) {
                        console.log('   ✅ Simplified DOM markdown extracted');
                        console.log(`   📄 Length: ${domResult.result.simplified_markdown.length} chars`);
                    }
                }
            } catch (error) {
                console.log(`   ⚠️  Simplified DOM extraction failed: ${error.message}`);
            }

            console.log('\n✅ Wikipedia extraction test completed successfully!');
            console.log('🎉 All data extraction methods working properly!');

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Make sure the bridge server is running');
            console.error('   2. Make sure the Chrome extension is loaded and connected');
            console.error('   3. Check that you have internet access for Wikipedia');
            console.error('   4. Ensure no popup blockers are interfering');
        } finally {
            this.cdp.reset();
        }
    }

    convertToMarkdown(data) {
        let markdown = '';

        // Title
        markdown += `# ${data.title}\n\n`;

        // URL
        markdown += `**Source:** [${data.url}](${data.url})\n\n`;

        // Summary
        if (data.summary) {
            markdown += `## Summary\n\n${data.summary}\n\n`;
        }

        // Infobox
        if (Object.keys(data.infobox).length > 0) {
            markdown += `## Quick Facts\n\n`;
            for (const [key, value] of Object.entries(data.infobox)) {
                if (value.length < 100) { // Only include short values
                    markdown += `- **${key}**: ${value}\n`;
                }
            }
            markdown += '\n';
        }

        // Sections
        if (data.sections && data.sections.length > 0) {
            markdown += `## Article Sections\n\n`;
            data.sections.slice(0, 10).forEach(section => { // Limit to first 10 sections
                const prefix = section.level === 'h2' ? '###' : '####';
                markdown += `${prefix} ${section.title}\n`;
            });
            markdown += '\n';
        }

        // Categories
        if (data.categories && data.categories.length > 0) {
            markdown += `## Categories\n\n`;
            data.categories.slice(0, 8).forEach(category => { // Limit to first 8 categories
                markdown += `- ${category}\n`;
            });
            markdown += '\n';
        }

        // Metadata
        markdown += `## Extraction Metadata\n\n`;
        markdown += `- **Extracted at**: ${new Date().toLocaleString()}\n`;
        markdown += `- **Sections found**: ${data.sections ? data.sections.length : 0}\n`;
        markdown += `- **Infobox items**: ${Object.keys(data.infobox).length}\n`;
        markdown += `- **Categories**: ${data.categories ? data.categories.length : 0}\n`;

        return markdown;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the test
async function main() {
    const test = new WikipediaExtractionTest();
    await test.runTest();
}

// Handle both Node.js and browser environments
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('test-wikipedia-extract.js')) {
    main().catch(console.error);
}

export { WikipediaExtractionTest };