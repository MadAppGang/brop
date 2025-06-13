#!/usr/bin/env node
/**
 * BROP Client Library Usage Example
 * 
 * This example demonstrates how to use the BROP client library
 * to automate browser interactions with automatic tab management.
 */

const { createPage, createNamedBROPConnection } = require('./index');

async function basicExample() {
    console.log('🎯 BROP Client Library - Basic Example');
    console.log('=====================================\n');

    let page = null;

    try {
        // Create a page with automatic tab management
        console.log('📋 Step 1: Creating page...');
        page = await createPage('https://example.com', 'basic-example');
        console.log(`   ✅ Page created: ${page.toString()}`);

        // Get page content
        console.log('\n📋 Step 2: Getting page content...');
        const content = await page.getContent();
        console.log(`   📄 Title: ${content.title}`);
        console.log(`   🔗 URL: ${content.url}`);
        console.log(`   📊 Links found: ${content.links ? content.links.length : 0}`);

        // Execute JavaScript
        console.log('\n📋 Step 3: Executing JavaScript...');
        const jsResult = await page.executeConsole('document.querySelector("h1").textContent');
        console.log(`   🚀 JS Result: ${jsResult.result}`);

        // Get console logs
        console.log('\n📋 Step 4: Getting console logs...');
        const logs = await page.getConsoleLogs({ limit: 5 });
        console.log(`   📝 Console logs: ${logs.logs ? logs.logs.length : 0} entries`);

        // Navigation example
        console.log('\n📋 Step 5: Navigation example...');
        await page.navigate('https://httpbin.org/html');
        await page.waitForLoad(2000);
        
        const newContent = await page.getContent();
        console.log(`   📄 New page title: ${newContent.title}`);

        console.log('\n🎉 Basic example completed successfully!');

    } catch (error) {
        console.error(`\n❌ Example failed: ${error.message}`);
        
        if (error.message.includes('Chrome extension not connected')) {
            console.log('\n💡 Make sure:');
            console.log('   1. BROP bridge server is running (pnpm run bridge)');
            console.log('   2. BROP Chrome extension is loaded and active');
        }
    } finally {
        // Automatic cleanup
        if (page) {
            await page.close();
            console.log('\n🧹 Page closed and cleaned up');
        }
    }
}

async function multiplePageExample() {
    console.log('\n🎯 BROP Client Library - Multiple Pages Example');
    console.log('==============================================\n');

    const pages = [];

    try {
        // Create multiple pages
        console.log('📋 Creating multiple pages...');
        const urls = [
            'https://example.com',
            'https://httpbin.org/html',
            'https://httpbin.org/json'
        ];

        for (let i = 0; i < urls.length; i++) {
            const page = await createPage(urls[i], `multi-page-${i + 1}`);
            pages.push(page);
            console.log(`   ✅ Page ${i + 1}: ${page.toString()}`);
        }

        // Work with all pages
        console.log('\n📋 Getting content from all pages...');
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const content = await page.getContent();
            console.log(`   📄 Page ${i + 1}: ${content.title}`);
        }

        console.log('\n🎉 Multiple pages example completed!');

    } catch (error) {
        console.error(`\n❌ Multiple pages example failed: ${error.message}`);
    } finally {
        // Clean up all pages
        console.log('\n🧹 Cleaning up all pages...');
        for (const page of pages) {
            if (page && page.isConnected()) {
                await page.close();
            }
        }
    }
}

async function lowLevelExample() {
    console.log('\n🎯 BROP Client Library - Low-Level API Example');
    console.log('=============================================\n');

    let connection = null;

    try {
        // Create raw connection
        console.log('📋 Creating raw BROP connection...');
        connection = createNamedBROPConnection('low-level-example');

        await new Promise((resolve) => {
            connection.on('open', () => {
                console.log('   ✅ Raw connection established');
                resolve();
            });
        });

        // Send raw BROP command
        console.log('\n📋 Sending raw BROP command...');
        const response = await new Promise((resolve, reject) => {
            const message = {
                id: 'raw-command-1',
                method: 'list_tabs',
                params: {}
            };

            connection.send(JSON.stringify(message));

            connection.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === 'raw-command-1') {
                        resolve(response);
                    }
                } catch (error) {
                    reject(error);
                }
            });

            setTimeout(() => {
                reject(new Error('Command timeout'));
            }, 5000);
        });

        if (response.success) {
            console.log(`   ✅ Found ${response.result.tabs.length} tabs`);
            response.result.tabs.forEach((tab, i) => {
                console.log(`      ${i + 1}. Tab ${tab.id}: ${tab.title}`);
            });
        } else {
            console.log(`   ❌ Command failed: ${response.error}`);
        }

        console.log('\n🎉 Low-level example completed!');

    } catch (error) {
        console.error(`\n❌ Low-level example failed: ${error.message}`);
    } finally {
        if (connection) {
            connection.close();
            console.log('\n🧹 Raw connection closed');
        }
    }
}

// Run all examples
async function runAllExamples() {
    await basicExample();
    await multiplePageExample();
    await lowLevelExample();
    
    console.log('\n🏁 All examples completed!');
    console.log('\nFor more information, see the README.md file.');
}

// Only run if this file is executed directly
if (require.main === module) {
    runAllExamples().catch(console.error);
}

module.exports = {
    basicExample,
    multiplePageExample,
    lowLevelExample
};