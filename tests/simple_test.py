#!/usr/bin/env python3
"""
Simple BROP test that bypasses Playwright's complex context management
and tests direct CDP commands
"""

import asyncio
import websockets
import json

async def test_direct_cdp():
    """Test direct CDP commands to the bridge server"""
    print("🧪 Testing direct CDP connection to bridge server...")
    
    try:
        # Connect directly to the CDP server
        websocket = await websockets.connect("ws://localhost:9222")
        print("✅ Connected to CDP server")
        
        # Test Browser.getVersion
        await websocket.send(json.dumps({
            "id": 1,
            "method": "Browser.getVersion",
            "params": {}
        }))
        
        response = await websocket.recv()
        version_data = json.loads(response)
        print(f"📋 Browser version: {version_data}")
        
        # Test Target.getTargets
        await websocket.send(json.dumps({
            "id": 2,
            "method": "Target.getTargets",
            "params": {}
        }))
        
        response = await websocket.recv()
        targets_data = json.loads(response)
        print(f"🎯 Targets: {targets_data}")
        
        if 'result' in targets_data and 'targetInfos' in targets_data['result']:
            targets = targets_data['result']['targetInfos']
            page_targets = [t for t in targets if t.get('type') == 'page']
            print(f"📄 Found {len(page_targets)} page targets:")
            for target in page_targets:
                print(f"   - {target.get('targetId')}: {target.get('title')} ({target.get('url')})")
        
        # Test Runtime.evaluate on a page target
        if 'result' in targets_data and 'targetInfos' in targets_data['result']:
            targets = targets_data['result']['targetInfos']
            page_targets = [t for t in targets if t.get('type') == 'page']
            
            if page_targets:
                print(f"🔧 Testing JavaScript execution on first page target...")
                await websocket.send(json.dumps({
                    "id": 3,
                    "method": "Runtime.evaluate",
                    "params": {
                        "expression": "document.title"
                    }
                }))
                
                response = await websocket.recv()
                eval_data = json.loads(response)
                print(f"📝 Evaluation result: {eval_data}")
        
        await websocket.close()
        print("✅ Direct CDP test completed successfully!")
        
    except Exception as e:
        print(f"❌ Direct CDP test failed: {e}")

async def main():
    print("BROP Simple Test - Direct CDP Commands")
    print("=" * 50)
    await test_direct_cdp()

if __name__ == "__main__":
    asyncio.run(main())