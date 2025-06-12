#!/usr/bin/env node
/**
 * Check Multiple Sessions Issue
 * 
 * The assertion might fail because:
 * 1. Playwright creates multiple CDP sessions internally
 * 2. Our bridge server tracks physical WebSocket clients, not logical sessions
 * 3. Responses might be sent to wrong session context
 */

const WebSocket = require('ws');

async function checkMultipleConnections() {
    console.log('🔍 Check Multiple CDP Connections');
    console.log('=' + '='.repeat(60));
    
    // Test if Playwright creates multiple connections to our CDP server
    const connections = [];
    let connectionCount = 0;
    
    // Monitor connections to our CDP server
    const server = new WebSocket.Server({ port: 9333 }); // Temporary test server
    
    server.on('connection', (ws, req) => {
        connectionCount++;
        console.log(`📡 Connection ${connectionCount}: ${req.url}`);
        
        connections.push({
            id: connectionCount,
            ws: ws,
            url: req.url,
            messages: []
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                console.log(`📥 Connection ${connectionCount}: ${parsed.method || `Response ${parsed.id}`}`);
                
                connections[connectionCount - 1].messages.push(parsed);
                
                // Echo back a simple response
                if (parsed.id) {
                    ws.send(JSON.stringify({
                        id: parsed.id,
                        result: { test: 'response' }
                    }));
                }
                
            } catch (error) {
                console.log(`❌ Parse error on connection ${connectionCount}: ${error.message}`);
            }
        });
        
        ws.on('close', () => {
            console.log(`🔌 Connection ${connectionCount} closed`);
        });
    });
    
    console.log('🎭 Test server started on port 9333');
    console.log('Now manually test with Playwright pointing to ws://localhost:9333');
    console.log('Or test multiple WebSocket connections...');
    
    // Simulate multiple connections like Playwright might do
    setTimeout(async () => {
        console.log('\n🧪 Simulating multiple WebSocket connections...');
        
        // Connection 1: Main connection
        const ws1 = new WebSocket('ws://localhost:9333');
        ws1.on('open', () => {
            console.log('📡 Opened connection 1 (main)');
            ws1.send(JSON.stringify({
                id: 1,
                method: 'Browser.getVersion',
                params: {}
            }));
        });
        
        // Connection 2: Session connection
        setTimeout(() => {
            const ws2 = new WebSocket('ws://localhost:9333/session');
            ws2.on('open', () => {
                console.log('📡 Opened connection 2 (session)');
                ws2.send(JSON.stringify({
                    id: 1, // Same ID as connection 1!
                    method: 'Page.enable',
                    params: {}
                }));
            });
            
            setTimeout(() => {
                ws1.close();
                ws2.close();
                server.close();
                
                console.log('\n📊 Analysis:');
                console.log(`Total connections: ${connections.length}`);
                connections.forEach(conn => {
                    console.log(`Connection ${conn.id} (${conn.url}): ${conn.messages.length} messages`);
                });
                
                if (connections.length > 1) {
                    console.log('\n🎯 Multiple connections detected!');
                    console.log('This could explain the assertion error:');
                    console.log('1. Playwright sends command on connection 1 with id=X');
                    console.log('2. Playwright sends command on connection 2 with id=X');
                    console.log('3. Our bridge routes response to wrong connection');
                    console.log('4. Connection receives response for unknown id');
                    console.log('5. assert(!object.id) fails');
                }
                
            }, 2000);
        }, 1000);
        
    }, 1000);
}

async function analyzeCurrentBridgeServer() {
    console.log('\n🌉 Analyze Current Bridge Server Logic');
    console.log('=' + '='.repeat(60));
    
    console.log('Current bridge server design:');
    console.log('1. One WebSocket server on port 9222');
    console.log('2. Each client connection stored in this.cdpClients');
    console.log('3. Requests mapped to specific client: pendingCdpRequests.set(id, client)');
    console.log('4. Responses sent to that specific client');
    console.log('');
    console.log('Potential problem:');
    console.log('- If Playwright uses multiple logical sessions over one connection');
    console.log('- Or multiple connections with overlapping IDs');
    console.log('- Our mapping might send responses to wrong context');
    console.log('');
    console.log('💡 Solution might be:');
    console.log('1. Track session context in message routing');
    console.log('2. Use session IDs in addition to message IDs');
    console.log('3. Implement proper CDP session management');
}

async function main() {
    console.log('🎯 Check Multiple Sessions Issue');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Determine if session routing causes assertion error');
    console.log('');
    
    await checkMultipleConnections();
    await analyzeCurrentBridgeServer();
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Monitor how many connections Playwright actually makes');
    console.log('2. Check if message IDs overlap between connections');
    console.log('3. Implement session-aware message routing if needed');
}

main();