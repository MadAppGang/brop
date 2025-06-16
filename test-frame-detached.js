import { chromium } from 'playwright';

(async () => {
  console.log('Starting frame detached debug test...');
  
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  console.log('Connected to browser');
  
  try {
    const context = await browser.newContext();
    console.log('Created context');
    
    const page = await context.newPage();
    console.log('Created page - this is where error should occur');
    
    await page.goto('https://example.com');
    console.log('Navigated to example.com');
    
  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await browser.close();
  }
})();