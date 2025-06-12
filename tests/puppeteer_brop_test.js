#!/usr/bin/env node
/**
 * Puppeteer BROP Test
 * 
 * Test page automation using Puppeteer connected to BROP bridge server
 * instead of launching a separate browser instance.
 */

const puppeteer = require('puppeteer');

class PuppeteerBROPTests {
    constructor() {
        this.browser = null;
        this.cdpEndpoint = 'ws://localhost:9222';
    }

    async setup() {
        console.log('🎭 Setting up Puppeteer with BROP...');
        
        try {
            // Connect to BROP bridge server instead of launching browser
            this.browser = await puppeteer.connect({
                browserWSEndpoint: this.cdpEndpoint,
                defaultViewport: null // Use the browser's default viewport
            });
            console.log('✅ Connected to BROP extension via Puppeteer');
            
            return true;
        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            console.error('💡 Make sure:');
            console.error('   1. Bridge server is running (node bridge_server.js)');
            console.error('   2. Chrome extension is loaded and connected');
            return false;
        }
    }

    async teardown() {
        console.log('🧹 Cleaning up...');
        
        if (this.browser) {
            await this.browser.disconnect(); // Use disconnect instead of close for remote browsers
        }
        
        console.log('✅ Cleanup complete');
    }

    async runTest(testName, testFunction) {
        console.log(`\n🧪 Running test: ${testName}`);
        console.log('─'.repeat(50));
        
        try {
            const page = await this.browser.newPage();
            console.log('✅ Page created successfully!');
            
            await testFunction(page);
            await page.close();
            console.log(`✅ Test passed: ${testName}`);
            return true;
        } catch (error) {
            console.error(`❌ Test failed: ${testName}`);
            console.error(`   Error: ${error.message}`);
            console.error(`   Stack: ${error.stack.split('\n')[1]}`);
            return false;
        }
    }

    // Test 1: Check if page has title containing "Playwright"
    async testHasTitle(page) {
        console.log('📄 Navigating to https://playwright.dev/');
        await page.goto('https://playwright.dev/', { waitUntil: 'networkidle2' });
        
        console.log('🔍 Checking page title...');
        const title = await page.title();
        console.log(`   Page title: "${title}"`);
        
        // Expect a title "to contain" a substring
        if (!title.includes('Playwright')) {
            throw new Error(`Expected title to contain "Playwright", but got: "${title}"`);
        }
        
        console.log('✅ Title contains "Playwright"');
    }

    // Test 2: Click get started link and verify Installation heading
    async testGetStartedLink(page) {
        console.log('📄 Navigating to https://playwright.dev/');
        await page.goto('https://playwright.dev/', { waitUntil: 'networkidle2' });
        
        console.log('🔍 Looking for "Get started" link...');
        
        // Wait for and click the get started link
        const getStartedSelector = 'a:contains("Get started"), a[href*="intro"]';
        await page.waitForSelector('a[href*="intro"], a[href*="getting-started"]', { timeout: 5000 });
        
        const getStartedLink = await page.$('a[href*="intro"], a[href*="getting-started"]');
        if (!getStartedLink) {
            throw new Error('Could not find Get started link');
        }
        
        await getStartedLink.click();
        console.log('🖱️  Clicked "Get started" link');
        
        // Wait for navigation
        console.log('⏳ Waiting for page to load...');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        // Look for Installation heading
        console.log('🔍 Looking for "Installation" heading...');
        const installationHeading = await page.$('h1:contains("Installation"), h2:contains("Installation"), h3:contains("Installation")');
        
        if (!installationHeading) {
            // Try alternative approach - check page content
            const pageText = await page.evaluate(() => document.body.textContent);
            if (!pageText.includes('Installation')) {
                throw new Error('Installation heading is not visible on the page');
            }
        }
        
        console.log('✅ "Installation" content found');
        
        // Additional verification: check URL
        const currentUrl = page.url();
        console.log(`   Current URL: ${currentUrl}`);
        
        if (!currentUrl.includes('intro') && !currentUrl.includes('getting-started')) {
            console.log('⚠️  URL might not be the expected docs page, but content is visible');
        }
    }

    // Test 3: Page interactions and screenshot
    async testPageInteractions(page) {
        console.log('📄 Navigating to https://playwright.dev/');
        await page.goto('https://playwright.dev/', { waitUntil: 'networkidle2' });
        
        console.log('🔍 Testing page interactions...');
        
        // Check viewport size
        const viewport = page.viewport();
        console.log(`   Viewport: ${viewport?.width}x${viewport?.height}`);
        
        // Get page metrics
        const metrics = await page.metrics();
        console.log(`   JS Heap Size: ${Math.round(metrics.JSHeapUsedSize / 1024 / 1024)}MB`);
        
        // Test JavaScript evaluation
        const userAgent = await page.evaluate(() => navigator.userAgent);
        console.log(`   User Agent: ${userAgent.substring(0, 50)}...`);
        
        // Test element interaction
        const links = await page.$$eval('a', links => links.length);
        console.log(`   Found ${links} links on the page`);
        
        // Take a screenshot
        console.log('📸 Taking screenshot...');
        await page.screenshot({ 
            path: 'puppeteer_brop_test_screenshot.png',
            fullPage: false
        });
        console.log('   Screenshot saved as puppeteer_brop_test_screenshot.png');
        
        if (links === 0) {
            throw new Error('No links found on the page');
        }
        
        console.log('✅ Page interactions working correctly');
    }

    // Test 4: Multiple pages (test session management)
    async testMultiplePages() {
        console.log('🔍 Testing multiple pages...');
        
        const page1 = await this.browser.newPage();
        const page2 = await this.browser.newPage();
        
        console.log('✅ Created two pages successfully');
        
        // Navigate both pages to different URLs
        await Promise.all([
            page1.goto('https://playwright.dev/', { waitUntil: 'domcontentloaded' }),
            page2.goto('https://github.com/microsoft/playwright', { waitUntil: 'domcontentloaded' })
        ]);
        
        const title1 = await page1.title();
        const title2 = await page2.title();
        
        console.log(`   Page 1 title: ${title1.substring(0, 30)}...`);
        console.log(`   Page 2 title: ${title2.substring(0, 30)}...`);
        
        if (title1 === title2) {
            throw new Error('Both pages have the same title - session isolation failed');
        }
        
        await page1.close();
        await page2.close();
        
        console.log('✅ Multiple pages working correctly');
        return true;
    }

    async runAllTests() {
        console.log('🚀 Puppeteer BROP Tests');
        console.log('='.repeat(50));
        
        const setupSuccess = await this.setup();
        if (!setupSuccess) {
            return;
        }
        
        const results = [];
        
        // Run Test 1: Has title
        results.push(await this.runTest('has title', this.testHasTitle.bind(this)));
        
        // Run Test 2: Get started link
        results.push(await this.runTest('get started link', this.testGetStartedLink.bind(this)));
        
        // Run Test 3: Page interactions
        results.push(await this.runTest('page interactions', this.testPageInteractions.bind(this)));
        
        // Run Test 4: Multiple pages
        results.push(await this.runTest('multiple pages', this.testMultiplePages.bind(this)));
        
        await this.teardown();
        
        // Summary
        const passed = results.filter(r => r).length;
        const total = results.length;
        
        console.log('\n📊 Test Results Summary');
        console.log('='.repeat(50));
        console.log(`✅ Passed: ${passed}/${total} tests`);
        
        if (passed === total) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️  Some tests failed. Check the logs above.');
        }
        
        return passed === total;
    }
}

// Simple test functions (like the original format)
async function simpleTest() {
    console.log('🧪 Running simple Puppeteer test...');
    
    try {
        const browser = await puppeteer.connect({
            browserWSEndpoint: 'ws://localhost:9222'
        });
        
        console.log('✅ Connected to BROP bridge');
        
        const page = await browser.newPage();
        console.log('✅ Page created successfully');
        
        await page.goto('https://playwright.dev/');
        console.log('✅ Navigation successful');
        
        const title = await page.title();
        console.log(`✅ Page title: ${title}`);
        
        if (!title.includes('Playwright')) {
            throw new Error(`Expected title to contain "Playwright", but got: "${title}"`);
        }
        
        await page.close();
        await browser.disconnect();
        
        console.log('🎉 Simple test passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Simple test failed:', error.message);
        return false;
    }
}

// Main execution
async function main() {
    if (process.argv.includes('--simple')) {
        // Run simple test
        await simpleTest();
    } else {
        // Run full test suite
        const testRunner = new PuppeteerBROPTests();
        await testRunner.runAllTests();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { PuppeteerBROPTests, simpleTest };