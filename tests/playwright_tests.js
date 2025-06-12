#!/usr/bin/env node
/**
 * Playwright Tests using BROP Extension
 * 
 * Node.js version of Playwright tests that connect to Chrome via BROP bridge
 * instead of launching a separate browser instance.
 */

const { chromium } = require('playwright');

class BROPPlaywrightTests {
    constructor() {
        this.browser = null;
        this.context = null;
        this.cdpEndpoint = 'ws://localhost:9222';
    }

    async setup() {
        console.log('🎭 Setting up Playwright with BROP...');
        
        try {
            // Connect to BROP bridge server instead of launching browser
            this.browser = await chromium.connectOverCDP(this.cdpEndpoint);
            console.log('✅ Connected to BROP extension');
            
            // Create a new context for our tests
            this.context = await this.browser.newContext();
            console.log('✅ Created browser context');
            
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
        
        if (this.context) {
            await this.context.close();
        }
        
        if (this.browser) {
            await this.browser.close();
        }
        
        console.log('✅ Cleanup complete');
    }

    async runTest(testName, testFunction) {
        console.log(`\n🧪 Running test: ${testName}`);
        console.log('─'.repeat(50));
        
        try {
            const page = await this.context.newPage();
            await testFunction(page);
            await page.close();
            console.log(`✅ Test passed: ${testName}`);
            return true;
        } catch (error) {
            console.error(`❌ Test failed: ${testName}`);
            console.error(`   Error: ${error.message}`);
            return false;
        }
    }

    // Test 1: Check if page has title containing "Playwright"
    async testHasTitle(page) {
        console.log('📄 Navigating to https://playwright.dev/');
        await page.goto('https://playwright.dev/');
        
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
        await page.goto('https://playwright.dev/');
        
        console.log('🔍 Looking for "Get started" link...');
        
        // Click the get started link
        const getStartedLink = page.getByRole('link', { name: 'Get started' });
        await getStartedLink.click();
        console.log('🖱️  Clicked "Get started" link');
        
        // Wait for navigation
        console.log('⏳ Waiting for page to load...');
        await page.waitForLoadState('networkidle');
        
        // Expects page to have a heading with the name of Installation
        console.log('🔍 Looking for "Installation" heading...');
        const installationHeading = page.getByRole('heading', { name: 'Installation' });
        
        const isVisible = await installationHeading.isVisible();
        if (!isVisible) {
            throw new Error('Installation heading is not visible on the page');
        }
        
        console.log('✅ "Installation" heading is visible');
        
        // Additional verification: check URL
        const currentUrl = page.url();
        console.log(`   Current URL: ${currentUrl}`);
        
        if (!currentUrl.includes('intro')) {
            console.log('⚠️  URL might not be the expected docs page, but heading is visible');
        }
    }

    // Test 3: Additional test - Check navigation and page content
    async testPageContent(page) {
        console.log('📄 Navigating to https://playwright.dev/');
        await page.goto('https://playwright.dev/');
        
        console.log('🔍 Checking page content...');
        
        // Check for main heading
        const mainHeading = await page.locator('h1').first().textContent();
        console.log(`   Main heading: "${mainHeading}"`);
        
        // Check for navigation menu
        const navLinks = await page.locator('nav a').count();
        console.log(`   Found ${navLinks} navigation links`);
        
        // Check for code examples
        const codeBlocks = await page.locator('pre, code').count();
        console.log(`   Found ${codeBlocks} code blocks`);
        
        // Take a screenshot
        console.log('📸 Taking screenshot...');
        await page.screenshot({ path: 'playwright_test_screenshot.png' });
        console.log('   Screenshot saved as playwright_test_screenshot.png');
        
        if (navLinks === 0) {
            throw new Error('No navigation links found on the page');
        }
        
        console.log('✅ Page content looks good');
    }

    async runAllTests() {
        console.log('🚀 BROP Playwright Tests');
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
        
        // Run Test 3: Page content (bonus test)
        results.push(await this.runTest('page content', this.testPageContent.bind(this)));
        
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

// Alternative: Direct test functions (like the original Playwright test format)
async function hasTitle() {
    const browser = await chromium.connectOverCDP('ws://localhost:9222');
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('https://playwright.dev/');
    
    // Expect a title "to contain" a substring
    const title = await page.title();
    if (!title.includes('Playwright')) {
        throw new Error(`Expected title to contain "Playwright", but got: "${title}"`);
    }
    
    await context.close();
    await browser.close();
    
    console.log('✅ hasTitle test passed');
}

async function getStartedLink() {
    const browser = await chromium.connectOverCDP('ws://localhost:9222');
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('https://playwright.dev/');
    
    // Click the get started link
    await page.getByRole('link', { name: 'Get started' }).click();
    
    // Expects page to have a heading with the name of Installation
    const installationHeading = page.getByRole('heading', { name: 'Installation' });
    const isVisible = await installationHeading.isVisible();
    
    if (!isVisible) {
        throw new Error('Installation heading is not visible');
    }
    
    await context.close();
    await browser.close();
    
    console.log('✅ getStartedLink test passed');
}

// Main execution
async function main() {
    if (process.argv.includes('--simple')) {
        // Run simple individual tests
        console.log('🧪 Running simple Playwright tests...');
        
        try {
            await hasTitle();
            await getStartedLink();
            console.log('🎉 All simple tests passed!');
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    } else {
        // Run full test suite
        const testRunner = new BROPPlaywrightTests();
        await testRunner.runAllTests();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { BROPPlaywrightTests, hasTitle, getStartedLink };