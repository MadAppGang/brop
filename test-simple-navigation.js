import { chromium } from 'playwright';

(async () => {
  console.log('Starting simple navigation test...');
  
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  console.log('Connected to browser');
  
  try {
    const context = await browser.newContext();
    console.log('Created context');
    
    const page = await context.newPage();
    console.log('Created page');
    
    await page.goto('https://example.com');
    console.log('Navigated to example.com');
    
    // Get the page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check if title contains "Example"
    if (title.includes('Example')) {
      console.log('✅ Test passed! Navigation and basic page interaction work.');
    } else {
      console.log('❌ Test failed: Unexpected title');
    }
    
  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await browser.close();
  }
})();