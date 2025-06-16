import json
import datetime
import sys
import os

def log_message(msg):
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {msg}")

# Get output filename from arguments or environment variable
def get_output_filename():    
    # Method 2: Check environment variable
    if 'CDP_DUMP_FILE' in os.environ:
        return os.environ['CDP_DUMP_FILE']
    
    # Method 3: Default with timestamp
    return f'cdp_dump_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.jsonl'

output_file = get_output_filename()
log_message(f"📁 Output file: {output_file}")

# Open file handle
try:
    file_handle = open(output_file, 'w')
    log_message(f"✓ Opened {output_file} for writing")
except Exception as e:
    log_message(f"❌ Error opening file: {e}")
    sys.exit(1)

def response(flow):
    if "/json/version" in flow.request.path:
        try:
            data = json.loads(flow.response.content.decode())
            if "webSocketDebuggerUrl" in data:
                original_url = data["webSocketDebuggerUrl"]
                modified_url = original_url.replace(":9222/", ":19222/")
                data["webSocketDebuggerUrl"] = modified_url
                flow.response.content = json.dumps(data).encode()
                log_message(f"✓ Rewritten WebSocket URL")
        except Exception as e:
            log_message(f"Error: {e}")

def websocket_start(flow):
    log_message(f"🔌 WebSocket started - Dumping to {output_file}")

def websocket_message(flow):
    try:
        if hasattr(flow, 'websocket') and flow.websocket:
            ws_data = flow.websocket
            
            if hasattr(ws_data, 'messages') and ws_data.messages:
                message = ws_data.messages[-1]
                
                # Get message content
                content = None
                if hasattr(message, 'content'):
                    content = message.content
                elif hasattr(message, 'text'):
                    content = message.text
                elif hasattr(message, 'data'):
                    content = message.data
                
                if content:
                    if isinstance(content, bytes):
                        content = content.decode('utf-8')
                    
                    try:
                        cdp_data = json.loads(content)
                        
                        # Create dump entry
                        dump_entry = {
                            'timestamp': datetime.datetime.now().isoformat(),
                            'direction': 'client_to_server' if message.from_client else 'server_to_client',
                            'cdp_data': cdp_data
                        }
                        
                        # Write to JSONL file
                        file_handle.write(json.dumps(dump_entry) + '\n')
                        file_handle.flush()
                        
                        # Log summary
                        if message.from_client:
                            method = cdp_data.get('method', 'unknown')
                            msg_id = cdp_data.get('id', 'N/A')
                            log_message(f"📤 {method} (ID: {msg_id})")
                        else:
                            if 'method' in cdp_data:
                                log_message(f"📥 EVENT: {cdp_data['method']}")
                            elif 'id' in cdp_data:
                                log_message(f"📥 RESPONSE: ID {cdp_data['id']}")
                                
                    except json.JSONDecodeError:
                        # Log raw content if not JSON
                        log_message(f"📨 Raw content: {content[:50]}...")
                        
    except Exception as e:
        log_message(f"Error: {e}")

def websocket_end(flow):
    log_message("🔌 WebSocket ended")
    file_handle.close()
    log_message(f"💾 Dump saved to {output_file}")

# Cleanup function for graceful shutdown
import atexit
def cleanup():
    try:
        file_handle.close()
        log_message(f"💾 Final save to {output_file}")
    except:
        pass

atexit.register(cleanup)