#!/usr/bin/env python3
"""
Working BROP + Playwright example that bypasses complex session management
by using a different approach
"""

import asyncio
import json
from playwright.async_api import async_playwright

class WorkingBROPPlaywright:
    def __init__(self):
        self.cdp_endpoint = "ws://localhost:9222"
    
    async def run_working_example(self):
        """Working example that uses direct CDP calls with Playwright"""
        print("🎯 Working BROP + Playwright Integration")
        print("=" * 50)
        
        async with async_playwright() as p:
            try:
                # Connect to our CDP server
                browser = await p.chromium.connect_over_cdp(self.cdp_endpoint)
                print("✅ Connected to BROP extension!")
                
                # Instead of relying on Playwright's context/page discovery,
                # let's create a new context and page that we control
                print("🔧 Creating new browser context...")
                context = await browser.new_context()
                
                print("📄 Creating new page...")
                page = await context.new_page()
                
                print("🌐 Navigating to example.com...")
                await page.goto("https://example.com")
                
                print("⏳ Waiting for page to load...")
                await page.wait_for_load_state("networkidle")
                
                print("📄 Getting page information...")
                title = await page.title()
                url = page.url
                print(f"   Title: {title}")
                print(f"   URL: {url}")
                
                print("📸 Taking screenshot...")
                await page.screenshot(path="working_brop_screenshot.png")
                print("   Screenshot saved as working_brop_screenshot.png")
                
                print("🔍 Executing JavaScript...")
                try:
                    paragraph_count = await page.evaluate("() => document.querySelectorAll('p').length")
                    print(f"   Found {paragraph_count} paragraphs")
                except Exception as js_error:
                    print(f"   JavaScript execution note: {js_error}")
                    # This is expected on some sites due to CSP
                
                print("📝 Getting page content...")
                content = await page.content()
                print(f"   Content length: {len(content)} characters")
                
                print()
                print("✅ Working BROP example completed successfully!")
                print("🎉 BROP extension is now working with Playwright!")
                
                await browser.close()
                
            except Exception as e:
                print(f"❌ Error: {e}")
                print("\n💡 Troubleshooting:")
                print("   1. Make sure the bridge server is running")
                print("   2. Make sure the Chrome extension is loaded")
                print("   3. Check that the extension popup shows 'Bridge Connected'")

async def main():
    client = WorkingBROPPlaywright()
    await client.run_working_example()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Example stopped by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        import traceback
        traceback.print_exc()