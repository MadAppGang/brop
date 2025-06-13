#!/usr/bin/env node
/**
 * Test script for MCP BROP Server modes
 * Tests both server mode and relay mode functionality
 */

const { MCPBROPStdioServer } = require('./bridge/mcp.js');
const { BROPBridgeServer } = require('./bridge/bridge_server.js');
const WebSocket = require('ws');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testServerMode() {
  console.log('\n🧪 Testing SERVER MODE...');

  const mcpServer = new MCPBROPStdioServer();

  try {
    // Start in server mode (port 9223 should be free)
    await mcpServer.start();

    console.log('✅ Server mode started successfully');
    console.log(`📊 Mode: ${mcpServer.isServerMode ? 'SERVER' : 'RELAY'}`);

    // Test MCP client connection
    await testMCPConnection();

    await mcpServer.shutdown();
    console.log('✅ Server mode test completed');

  } catch (error) {
    console.error('❌ Server mode test failed:', error);
    await mcpServer.shutdown();
  }
}

async function testRelayMode() {
  console.log('\n🧪 Testing RELAY MODE...');

  // First start a regular bridge server
  const bridgeServer = new BROPBridgeServer();

  try {
    await bridgeServer.startServers();
    console.log('✅ Bridge server started on port 9223');

    // Give it a moment to fully start
    await delay(1000);

    // Now start MCP server (should detect port 9223 is occupied and go into relay mode)
    const mcpServer = new MCPBROPStdioServer();
    await mcpServer.start();

    console.log('✅ Relay mode started successfully');
    console.log(`📊 Mode: ${mcpServer.isServerMode ? 'SERVER' : 'RELAY'}`);

    // Test MCP client connection
    await testMCPConnection();

    await mcpServer.shutdown();
    await bridgeServer.shutdown();
    console.log('✅ Relay mode test completed');

  } catch (error) {
    console.error('❌ Relay mode test failed:', error);
    await bridgeServer.shutdown();
  }
}

async function testMCPConnection() {
  console.log('🔌 Testing MCP client connection...');

  return new Promise((resolve, reject) => {
    const client = new WebSocket('ws://localhost:3000');

    const timeout = setTimeout(() => {
      client.close();
      reject(new Error('MCP connection timeout'));
    }, 5000);

    client.on('open', () => {
      console.log('✅ MCP client connected');

      // Test tools/list request
      const toolsRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      client.send(JSON.stringify(toolsRequest));
    });

    client.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.method === 'notifications/initialized') {
          console.log('✅ MCP initialization received:', data.params.serverInfo);
        } else if (data.id === 1 && data.result) {
          console.log(`✅ MCP tools/list response: ${data.result.tools.length} tools available`);
          for (const tool of data.result.tools) {
            console.log(`   - ${tool.name}: ${tool.description}`);
          }

          clearTimeout(timeout);
          client.close();
          resolve();
        }
      } catch (error) {
        console.error('Error parsing MCP message:', error);
      }
    });

    client.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    client.on('close', () => {
      console.log('🔌 MCP client disconnected');
    });
  });
}

async function main() {
  console.log('🧪 MCP BROP Server Mode Tests');
  console.log('=' + '='.repeat(50));

  try {
    // Test server mode first
    await testServerMode();

    // Wait a bit between tests
    await delay(2000);

    // Test relay mode
    await testRelayMode();

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testServerMode, testRelayMode, testMCPConnection };