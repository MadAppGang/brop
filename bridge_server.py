#!/usr/bin/env python3
"""
BROP Bridge Server

A middleware server that bridges between:
1. CDP clients (Playwright) on port 9222
2. BROP clients on port 9223  
3. Chrome extension WebSocket client on port 9224

The Chrome extension connects as a WebSocket client to this bridge,
allowing external tools to control the browser through the extension.
"""

import asyncio
import websockets
import json
import logging
import time
from typing import Dict, Set, Optional, Any
import threading
import signal
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('BROP-Bridge')

class BROPBridgeServer:
    def __init__(self):
        self.extension_client: Optional[websockets.WebSocketServerProtocol] = None
        self.cdp_clients: Set[websockets.WebSocketServerProtocol] = set()
        self.brop_clients: Set[websockets.WebSocketServerProtocol] = set()
        
        # Message routing
        self.pending_cdp_requests: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.pending_brop_requests: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.message_counter = 0
        
        # Server instances
        self.cdp_server = None
        self.brop_server = None
        self.extension_server = None
        
        # Browser state for CDP
        self.browser_info = {
            "Browser": "Chrome/BROP-Extension",
            "Protocol-Version": "1.3",
            "User-Agent": "Mozilla/5.0 Chrome BROP Extension",
            "V8-Version": "12.0.0",
            "WebKit-Version": "537.36",
            "webSocketDebuggerUrl": "ws://localhost:9222/"
        }
        
        self.running = False

    def get_next_message_id(self) -> str:
        """Generate unique message ID"""
        self.message_counter += 1
        return f"bridge_{self.message_counter}"

    async def start_servers(self):
        """Start all three servers"""
        self.running = True
        
        try:
            # Start CDP server (for Playwright)
            self.cdp_server = await websockets.serve(
                self.handle_cdp_client, 
                "localhost", 
                9222,
                ping_interval=None,
                ping_timeout=None
            )
            logger.info("🎭 CDP Server started on ws://localhost:9222")
            
            # Start BROP server (for BROP clients)
            self.brop_server = await websockets.serve(
                self.handle_brop_client,
                "localhost", 
                9223,
                ping_interval=None,
                ping_timeout=None
            )
            logger.info("🔧 BROP Server started on ws://localhost:9223")
            
            # Start Extension WebSocket server (extension connects as client)
            self.extension_server = await websockets.serve(
                self.handle_extension_client,
                "localhost",
                9224,
                ping_interval=None,
                ping_timeout=None
            )
            logger.info("🔌 Extension Server started on ws://localhost:9224")
            logger.info("📡 Waiting for Chrome extension to connect...")
            
            # Keep servers running
            await asyncio.Future()  # Run forever
            
        except Exception as e:
            logger.error(f"Failed to start servers: {e}")
            raise

    async def handle_extension_client(self, websocket, path):
        """Handle Chrome extension connection (extension is the client)"""
        try:
            logger.info("🔌 Chrome extension connected")
            self.extension_client = websocket
            
            # Send welcome message
            await websocket.send(json.dumps({
                "type": "welcome",
                "message": "BROP Bridge Server - Extension connected successfully",
                "timestamp": time.time()
            }))
            
            async for message in websocket:
                await self.process_extension_message(message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("🔌 Chrome extension disconnected")
        except Exception as e:
            logger.error(f"Extension client error: {e}")
        finally:
            self.extension_client = None

    async def handle_cdp_client(self, websocket, path):
        """Handle CDP clients (Playwright, etc.)"""
        try:
            logger.info(f"🎭 CDP client connected: {path}")
            self.cdp_clients.add(websocket)
            
            # Handle CDP discovery endpoints
            if path == "/json/version":
                await websocket.send(json.dumps(self.browser_info))
                return
            elif path == "/json" or path == "/json/list":
                tabs = await self.get_browser_tabs()
                await websocket.send(json.dumps(tabs))
                return
            
            # Handle CDP WebSocket connections
            async for message in websocket:
                await self.process_cdp_message(websocket, message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("🎭 CDP client disconnected")
        except Exception as e:
            logger.error(f"CDP client error: {e}")
        finally:
            self.cdp_clients.discard(websocket)

    async def handle_brop_client(self, websocket, path):
        """Handle BROP clients"""
        try:
            logger.info("🔧 BROP client connected")
            self.brop_clients.add(websocket)
            
            async for message in websocket:
                await self.process_brop_message(websocket, message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("🔧 BROP client disconnected")
        except Exception as e:
            logger.error(f"BROP client error: {e}")
        finally:
            self.brop_clients.discard(websocket)

    async def process_extension_message(self, message: str):
        """Process messages from Chrome extension"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            
            if message_type == "response":
                # Extension responding to a request
                request_id = data.get("id")
                
                # Check if this is a CDP response
                if request_id in self.pending_cdp_requests:
                    client = self.pending_cdp_requests.pop(request_id)
                    cdp_response = self.convert_to_cdp_response(data)
                    await client.send(json.dumps(cdp_response))
                
                # Check if this is a BROP response
                elif request_id in self.pending_brop_requests:
                    client = self.pending_brop_requests.pop(request_id)
                    await client.send(json.dumps(data))
                    
            elif message_type == "event":
                # Extension sending an event, broadcast to relevant clients
                await self.broadcast_extension_event(data)
                
            elif message_type == "log":
                # Extension sending a log message
                logger.info(f"Extension: {data.get('message', 'Unknown log')}")
                
        except Exception as e:
            logger.error(f"Error processing extension message: {e}")

    async def process_cdp_message(self, client: websockets.WebSocketServerProtocol, message: str):
        """Process CDP commands from clients like Playwright"""
        try:
            data = json.loads(message)
            method = data.get("method")
            params = data.get("params", {})
            message_id = data.get("id")
            
            logger.info(f"🎭 CDP: {method}")
            
            if not self.extension_client:
                # No extension connected
                error_response = {
                    "id": message_id,
                    "error": {
                        "code": -32000,
                        "message": "Chrome extension not connected"
                    }
                }
                await client.send(json.dumps(error_response))
                return
            
            # Convert CDP command to extension format
            extension_message = {
                "type": "cdp_command", 
                "id": message_id,
                "method": method,
                "params": params
            }
            
            # Store the client for response routing
            self.pending_cdp_requests[message_id] = client
            
            # Forward to extension
            await self.extension_client.send(json.dumps(extension_message))
            
        except Exception as e:
            logger.error(f"Error processing CDP message: {e}")

    async def process_brop_message(self, client: websockets.WebSocketServerProtocol, message: str):
        """Process BROP commands"""
        try:
            data = json.loads(message)
            command_type = data.get("command", {}).get("type")
            message_id = data.get("id", self.get_next_message_id())
            
            logger.info(f"🔧 BROP: {command_type}")
            
            if not self.extension_client:
                # No extension connected
                error_response = {
                    "id": message_id,
                    "success": False,
                    "error": "Chrome extension not connected"
                }
                await client.send(json.dumps(error_response))
                return
            
            # Add ID if not present
            data["id"] = message_id
            data["type"] = "brop_command"
            
            # Store client for response routing
            self.pending_brop_requests[message_id] = client
            
            # Forward to extension
            await self.extension_client.send(json.dumps(data))
            
        except Exception as e:
            logger.error(f"Error processing BROP message: {e}")

    def convert_to_cdp_response(self, extension_response: dict) -> dict:
        """Convert extension response to CDP format"""
        message_id = extension_response.get("id")
        
        if extension_response.get("success", False):
            # Success response
            result = extension_response.get("result", {})
            return {
                "id": message_id,
                "result": result
            }
        else:
            # Error response
            error_msg = extension_response.get("error", "Unknown error")
            return {
                "id": message_id,
                "error": {
                    "code": -32000,
                    "message": str(error_msg)
                }
            }

    async def broadcast_extension_event(self, event_data: dict):
        """Broadcast extension events to relevant clients"""
        event_type = event_data.get("event_type")
        
        if event_type in ["console", "page_load", "navigation"]:
            # Broadcast to CDP clients
            cdp_event = {
                "method": f"Runtime.{event_type}",
                "params": event_data.get("params", {})
            }
            await self.broadcast_to_cdp_clients(cdp_event)
        
        # Always broadcast to BROP clients
        await self.broadcast_to_brop_clients(event_data)

    async def broadcast_to_cdp_clients(self, message: dict):
        """Broadcast message to all CDP clients"""
        if self.cdp_clients:
            message_str = json.dumps(message)
            await asyncio.gather(
                *[client.send(message_str) for client in self.cdp_clients],
                return_exceptions=True
            )

    async def broadcast_to_brop_clients(self, message: dict):
        """Broadcast message to all BROP clients"""
        if self.brop_clients:
            message_str = json.dumps(message)
            await asyncio.gather(
                *[client.send(message_str) for client in self.brop_clients],
                return_exceptions=True
            )

    async def get_browser_tabs(self) -> list:
        """Get browser tabs for CDP discovery"""
        # This would be enhanced to get real tab info from extension
        return [{
            "description": "",
            "devtoolsFrontendUrl": "/devtools/inspector.html?ws=localhost:9222/page/1",
            "id": "1", 
            "title": "BROP Extension Tab",
            "type": "page",
            "url": "about:blank",
            "webSocketDebuggerUrl": "ws://localhost:9222/page/1"
        }]

    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("🛑 Shutting down BROP Bridge Server...")
        self.running = False
        
        if self.cdp_server:
            self.cdp_server.close()
            await self.cdp_server.wait_closed()
        
        if self.brop_server:
            self.brop_server.close()
            await self.brop_server.wait_closed()
            
        if self.extension_server:
            self.extension_server.close()
            await self.extension_server.wait_closed()


def signal_handler(bridge_server):
    """Handle shutdown signals"""
    def handler(signum, frame):
        logger.info("🛑 Received shutdown signal")
        asyncio.create_task(bridge_server.shutdown())
        sys.exit(0)
    return handler


async def main():
    """Main function"""
    print("🌉 BROP Bridge Server")
    print("=" * 50)
    print("Starting multi-protocol bridge server...")
    print()
    print("🎭 CDP Server: ws://localhost:9222 (for Playwright)")
    print("🔧 BROP Server: ws://localhost:9223 (for BROP clients)")
    print("🔌 Extension Server: ws://localhost:9224 (extension connects here)")
    print()
    
    bridge = BROPBridgeServer()
    
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler(bridge))
    signal.signal(signal.SIGTERM, signal_handler(bridge))
    
    try:
        await bridge.start_servers()
    except KeyboardInterrupt:
        logger.info("🛑 Received keyboard interrupt")
    except Exception as e:
        logger.error(f"💥 Server error: {e}")
    finally:
        await bridge.shutdown()


if __name__ == "__main__":
    asyncio.run(main())