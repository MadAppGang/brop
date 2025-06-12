#!/usr/bin/env python3
"""
Browser Remote Operations Protocol (BROP) - Python Client Example

This demonstrates the BROP client API concepts and design.
For actual browser automation, use the Playwright integration instead.
"""

import asyncio
import websockets
import json
import base64
from typing import Dict, Any, Optional, List
import time

class BROPClient:
    """
    Python client for Browser Remote Operations Protocol.
    
    Note: This client demonstrates the BROP API design and concepts.
    For actual browser automation, use the Playwright integration:
    
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
            page = browser.contexts[0].pages[0]
            # Use standard Playwright API
    """
    
    def __init__(self, host: str = "localhost", port: int = 9222):
        self.host = host
        self.port = port
        self.websocket = None
        self.message_id = 0
        self.pending_responses = {}
        
    async def connect(self):
        """Test connection to the BROP Chrome extension"""
        try:
            print(f"Testing BROP extension connection...")
            print("Note: This client shows API concepts only.")
            print("For actual automation, use: python playwright_embedded_example.py")
            
            # Simple connection test - check if extension is active
            import aiohttp
            async with aiohttp.ClientSession() as session:
                try:
                    # Test CDP endpoint that extension should provide
                    async with session.get(f"http://{self.host}:9222/json/version") as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            print(f"✅ BROP extension active: {data.get('Browser', 'Unknown version')}")
                        else:
                            raise Exception("CDP endpoint not responding")
                except Exception as endpoint_error:
                    print(f"ℹ️  CDP endpoint check: {endpoint_error}")
                    print("   Extension may still be active via runtime messaging")
            
        except Exception as e:
            print(f"Connection test: {e}")
            print("💡 For full browser automation, use:")
            print("   python playwright_embedded_example.py")
            # Don't raise - this is just a demonstration
    
    async def disconnect(self):
        """Disconnect from the BROP server"""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
    
    def _get_next_message_id(self) -> str:
        """Generate unique message ID"""
        self.message_id += 1
        return str(self.message_id)
    
    async def _send_command(self, command_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send command to browser and wait for response"""
        if not self.websocket:
            raise Exception("Not connected to BROP server")
        
        message_id = self._get_next_message_id()
        
        # Create command message (simplified JSON for this example)
        # In production, you'd use the actual protobuf messages
        message = {
            "id": message_id,
            "command": {
                "type": command_type,
                "params": params
            }
        }
        
        # Send message
        await self.websocket.send(json.dumps(message))
        
        # Wait for response
        while True:
            response_data = await self.websocket.recv()
            response = json.loads(response_data)
            
            if response.get("id") == message_id:
                if not response.get("success", False):
                    raise Exception(f"Command failed: {response.get('error', 'Unknown error')}")
                return response.get("result", {})
    
    async def navigate(self, url: str, wait_for_load: bool = True, timeout: int = 30000) -> Dict[str, Any]:
        """Navigate to a URL"""
        return await self._send_command("navigate", {
            "url": url,
            "wait_for_load": wait_for_load,
            "timeout": timeout
        })
    
    async def get_page_content(self, include_html: bool = True, include_text: bool = True, 
                              include_metadata: bool = True) -> Dict[str, Any]:
        """Get page content"""
        return await self._send_command("get_page_content", {
            "include_html": include_html,
            "include_text": include_text,
            "include_metadata": include_metadata
        })
    
    async def screenshot(self, full_page: bool = False, format: str = "png") -> bytes:
        """Take a screenshot"""
        result = await self._send_command("get_screenshot", {
            "full_page": full_page,
            "format": format
        })
        
        # Decode base64 image data
        image_data = result.get("image_data", "")
        return base64.b64decode(image_data)
    
    async def execute_console(self, code: str) -> Dict[str, Any]:
        """Execute JavaScript code in the browser console"""
        return await self._send_command("execute_console", {
            "code": code,
            "return_result": True
        })
    
    async def get_console_logs(self, limit: int = 100, level: str = "all") -> List[Dict[str, Any]]:
        """Get console logs from the browser"""
        result = await self._send_command("get_console_logs", {
            "limit": limit,
            "level": level
        })
        return result.get("logs", [])
    
    async def click(self, selector: str, button: int = 0, double_click: bool = False) -> Dict[str, Any]:
        """Click an element"""
        return await self._send_command("click", {
            "selector": selector,
            "button": button,
            "double_click": double_click
        })
    
    async def type(self, selector: str, text: str, clear_first: bool = False, delay: int = 0) -> Dict[str, Any]:
        """Type text into an element"""
        return await self._send_command("type", {
            "selector": selector,
            "text": text,
            "clear_first": clear_first,
            "delay": delay
        })
    
    async def wait_for_element(self, selector: str, timeout: int = 30000, 
                              visible: bool = True) -> Dict[str, Any]:
        """Wait for an element to appear"""
        return await self._send_command("wait_for_element", {
            "selector": selector,
            "timeout": timeout,
            "visible": visible
        })
    
    async def get_element(self, selector: str, get_all: bool = False) -> Dict[str, Any]:
        """Get element information"""
        return await self._send_command("get_element", {
            "selector": selector,
            "get_all": get_all
        })
    
    async def evaluate(self, code: str) -> Dict[str, Any]:
        """Evaluate JavaScript in page context"""
        return await self._send_command("evaluate_js", {
            "code": code,
            "return_by_value": True
        })


async def example_usage():
    """Example demonstrating BROP client concept"""
    print("BROP Client Example")
    print("===================")
    print("This example shows the BROP client API concept.")
    print("For actual browser automation, use the Playwright integration:\n")
    
    # Show the equivalent Playwright code
    print("🎯 Recommended Playwright approach:")
    print("""
from playwright.async_api import async_playwright

async with async_playwright() as p:
    # Connect to BROP's embedded CDP server
    browser = await p.chromium.connect_over_cdp("ws://localhost:9222")
    page = browser.contexts[0].pages[0]
    
    # Navigate and interact
    await page.goto("https://example.com")
    title = await page.title()
    screenshot = await page.screenshot(path="screenshot.png")
    
    print(f"Page title: {title}")
    await browser.close()
    """)
    
    print("\n📋 To run the working Playwright example:")
    print("   python playwright_embedded_example.py")
    print("\n💡 The BROP client API shown here is for concept demonstration.")
    print("   Playwright integration provides the actual functionality.")
    
    # Test basic extension connectivity
    client = BROPClient()
    
    print("\n🔍 Testing BROP extension...")
    await client.connect()
        
    await client.disconnect()
    print("\n✅ API demonstration completed")
    print("\n🚀 Ready to use Playwright integration:")
    print("   python playwright_embedded_example.py")


def playwright_comparison_example():
    """
    Example showing how BROP usage compares to Playwright
    
    Playwright equivalent:
    
    from playwright.async_api import async_playwright
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("https://example.com")
        content = await page.content()
        screenshot = await page.screenshot()
        await browser.close()
    
    BROP equivalent (this file):
    
    client = BROPClient()
    await client.connect()
    await client.navigate("https://example.com")
    content = await client.get_page_content()
    screenshot = await client.screenshot()
    await client.disconnect()
    """
    pass


class BROPPageObject:
    """
    Example of a Page Object Model implementation using BROP.
    This shows how you can build higher-level abstractions.
    """
    
    def __init__(self, client: BROPClient):
        self.client = client
    
    async def search_google(self, query: str):
        """Search on Google"""
        await self.client.navigate("https://google.com")
        await self.client.wait_for_element('input[name="q"]')
        await self.client.type('input[name="q"]', query, clear_first=True)
        await self.client.click('input[value="Google Search"]')
        await self.client.wait_for_element('#search')
    
    async def get_search_results(self) -> List[str]:
        """Get search result titles"""
        elements = await self.client.get_element('h3', get_all=True)
        return [elem.get('text_content', '') for elem in elements.get('elements', [])]


if __name__ == "__main__":
    print("BROP Client Example")
    print("===================")
    print("This demonstrates the BROP API design concepts.")
    print("For actual browser automation, use Playwright integration.")
    print()
    print("📝 Setup: Make sure the BROP Chrome extension is loaded and active.")
    print("🎯 Goal: Run 'python playwright_embedded_example.py' for full automation.")
    print()
    
    asyncio.run(example_usage())