import { chromium } from 'playwright';

async function simpleTest() {
  console.log('🎭 Simple CDP Test');
  console.log('================\n');
  
  try {
    // Connect via proxy
    const proxyPort = 19222;
    console.log(`📡 Connecting to CDP proxy on port ${proxyPort}...`);
    const browser = await chromium.connectOverCDP(`http://localhost:${proxyPort}`);
    console.log('✅ Connected to browser via CDP\n');

    // Get the default context
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error('No browser context found');
    }

    // Create a new page
    console.log('📄 Creating new page...');
    const page = await context.newPage();
    console.log('✅ Page created\n');

    // Navigate to a simple page
    console.log('🌐 Navigating to example.com...');
    await page.goto('https://example.com', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log('✅ Navigation complete\n');

    // Get the page title
    const title = await page.title();
    console.log(`📝 Page title: "${title}"\n`);

    // Get the main heading
    const heading = await page.textContent('h1');
    console.log(`📝 Main heading: "${heading}"\n`);

    // Count paragraphs
    const paragraphs = await page.$$('p');
    console.log(`📝 Number of paragraphs: ${paragraphs.length}\n`);

    // Get the first paragraph text
    if (paragraphs.length > 0) {
      const firstParagraphText = await paragraphs[0].textContent();
      console.log(`📝 First paragraph: "${firstParagraphText}"\n`);
    }

    // Take a screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({
      path: 'example-screenshot.png'
    });
    console.log('✅ Screenshot saved as example-screenshot.png\n');

    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // The proxy handles browser cleanup
    console.log('\n✨ Test finished!');
  }
}

// Run the test
console.log('Starting simple CDP test...\n');
simpleTest().then(() => {
  console.log('\n✨ All tests passed!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});