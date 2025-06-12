#!/usr/bin/env python3
"""
Example showing how to use Playwright with the embedded BROP extension
(no external server required)

The BROP extension includes an embedded CDP server that Playwright can connect to directly.
No bridge server or native messaging setup is required.
"""

import asyncio
import json
from playwright.async_api import async_playwright

class EmbeddedBROPPlaywright:
    """
    Playwright client that connects directly to the Chrome extension's embedded CDP server.
    No external bridge server required.
    """
    
    def __init__(self):
        self.cdp_endpoint = "ws://localhost:9222"
    
    async def run_example(self):
        """Run Playwright automation example with embedded BROP"""
        print("Connecting to Chrome with embedded BROP extension...")
        
        async with async_playwright() as p:
            try:
                # Connect to the embedded CDP server
                browser = await p.chromium.connect_over_cdp(self.cdp_endpoint)
                print("✅ Connected to embedded BROP extension!")
                
                # First, let's try to get all available targets/pages  
                print("   Checking available targets...")
                
                # Get existing context/page - try to use existing tabs instead of creating new ones
                contexts = browser.contexts
                print(f"Found {len(contexts)} contexts")
                
                # Try to find an existing page to work with
                page = None
                context = None
                
                if contexts and len(contexts) > 0:
                    for ctx in contexts:
                        pages = ctx.pages
                        print(f"   Context has {len(pages)} pages")
                        if pages and len(pages) > 0:
                            page = pages[0]
                            context = ctx
                            print(f"   Using existing page: {page.url}")
                            break
                
                # If no existing page found, try to create one (this may fail)
                if not page:
                    print("   No existing pages found")
                    print("   Attempting to create new page (this often fails due to CDP session complexity)")
                    print("   WORKAROUND: Please open a tab manually in Chrome (like google.com) and run this script again")
                    
                    if contexts and len(contexts) > 0:
                        context = contexts[0]
                        page = await context.new_page()
                    else:
                        context = await browser.new_context()
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
                await page.screenshot(path="embedded_brop_screenshot.png")
                print("   Screenshot saved as embedded_brop_screenshot.png")
                
                print("🔍 Executing JavaScript...")
                paragraph_count = await page.evaluate("() => document.querySelectorAll('p').length")
                print(f"   Found {paragraph_count} paragraphs")
                
                print("📝 Getting page content...")
                content = await page.content()
                print(f"   Content length: {len(content)} characters")
                
                print("\n✅ Embedded BROP example completed successfully!")
                
                await browser.close()
                
            except Exception as e:
                print(f"❌ Connection failed: {e}")
                await self.show_setup_instructions()
    
    async def show_setup_instructions(self):
        """Show setup instructions if connection fails"""
        print("\n" + "="*60)
        print("SETUP INSTRUCTIONS FOR BROP + PLAYWRIGHT")
        print("="*60)
        print()
        print("To use Playwright with BROP, you need the BROP bridge server running.")
        print("The bridge connects Playwright to the Chrome extension.")
        print()
        print("🔧 REQUIRED SETUP:")
        print("   1. Start the BROP bridge server:")
        print("      cd bridge-server")
        print("      npm install")
        print("      npm start")
        print()
        print("   2. Load the BROP extension in Chrome:")
        print("      - Go to chrome://extensions/")
        print("      - Enable 'Developer mode'")
        print("      - Click 'Load unpacked' and select the BROP directory")
        print()
        print("   3. Verify the connection:")
        print("      - Bridge server shows: '🔌 Chrome extension connected'")
        print("      - Extension popup shows 'Service Active'")
        print("      - Open a webpage (like google.com)")
        print()
        print("📋 What you should see:")
        print("   ✓ Bridge server starts on multiple ports")
        print("   ✓ Chrome extension connects to bridge automatically")
        print("   ✓ Extension popup shows 'Service Active'")
        print("   ✓ Playwright can connect to ws://localhost:9222")
        print()
        print("💡 Architecture:")
        print("   - Bridge server provides CDP interface on port 9222")
        print("   - Chrome extension connects as WebSocket client to bridge")
        print("   - Playwright controls browser through the bridge")
        print("   - No Chrome debugging flags needed!")

def demonstrate_api_compatibility():
    """Show how the embedded version maintains API compatibility"""
    print("\n" + "="*60)
    print("API COMPATIBILITY DEMONSTRATION")
    print("="*60)
    print()
    print("📝 Standard Playwright code:")
    print("""
async with async_playwright() as p:
    browser = await p.chromium.launch()
    page = await browser.new_page()
    await page.goto("https://example.com")
    title = await page.title()
    await browser.close()
    """)
    
    print("📝 Embedded BROP code (same API!):")
    print("""
async with async_playwright() as p:
    browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
    page = browser.contexts[0].pages[0]  # Use existing tab
    await page.goto("https://example.com")
    title = await page.title()
    await browser.close()
    """)
    
    print("🎯 Key Benefits:")
    print("   ✓ Same Playwright API - no code changes needed")
    print("   ✓ No external server process required")
    print("   ✓ Everything runs inside the Chrome extension")
    print("   ✓ Uses existing Chrome tabs and windows")
    print("   ✓ Access to all extension capabilities")

async def test_direct_connection():
    """Test direct connection to embedded extension"""
    print("\n🧪 Testing direct connection to embedded BROP...")
    
    try:
        async with async_playwright() as p:
            # Try to connect to the embedded CDP server
            browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
            
            # Test basic functionality
            version = browser.version
            print(f"   Connected to: {version}")
            
            contexts = browser.contexts
            print(f"   Found {len(contexts)} browser contexts")
            
            if contexts and len(contexts) > 0:
                context = contexts[0]
                pages = context.pages
                print(f"   Found {len(pages)} pages in first context")
                if pages and len(pages) > 0:
                    current_url = pages[0].url
                    print(f"   Current page: {current_url}")
                else:
                    print("   No pages found in context")
            else:
                print("   No browser contexts found")
            
            await browser.close()
            print("   ✅ Direct connection test passed!")
            
    except Exception as e:
        print(f"   ❌ Direct connection test failed: {e}")
        print("   Make sure the BROP extension is loaded and active")
        print("   Check that the extension popup shows 'Service Active'")

async def main():
    """Main function"""
    print("BROP Embedded Extension - Playwright Example")
    print("=" * 50)
    print("This example shows Playwright working with BROP extension")
    print("with no external server required!")
    print()
    
    client = EmbeddedBROPPlaywright()
    
    # Show API compatibility
    demonstrate_api_compatibility()
    
    # Test direct connection first
    await test_direct_connection()
    
    # Run main example
    await client.run_example()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Example stopped by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        import traceback
        traceback.print_exc()