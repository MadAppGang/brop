#!/usr/bin/env node
/**
 * Test script for MCP BROP STDIO Server
 * Tests the STDIO transport interface
 */

const { spawn } = require('child_process');
const path = require('path');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMCPStdio() {
  console.log('🧪 Testing MCP BROP STDIO Server...');
  
  return new Promise((resolve, reject) => {
    const mcpProcess = spawn('node', [path.join(__dirname, 'bridge', 'mcp.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    mcpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    mcpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    mcpProcess.on('close', (code) => {
      console.log(`✅ MCP process exited with code ${code}`);
      
      try {
        // Parse JSON responses from stdout
        const responses = stdout.trim().split('\n').filter(line => line.trim());
        console.log(`📨 Received ${responses.length} JSON responses`);
        
        for (let i = 0; i < responses.length; i++) {
          const response = JSON.parse(responses[i]);
          console.log(`   Response ${i + 1}:`, response.result ? 'SUCCESS' : 'ERROR');
          
          if (response.result && response.result.serverInfo) {
            console.log(`   Server mode: ${response.result.serverInfo.mode}`);
          }
          
          if (response.result && response.result.tools) {
            console.log(`   Tools available: ${response.result.tools.length}`);
          }
        }
        
        // Check stderr for bridge server logs
        const logLines = stderr.split('\n').filter(line => line.trim());
        console.log(`📋 Bridge server log lines: ${logLines.length}`);
        
        const mcpLogs = logLines.filter(line => line.includes('[MCP-BROP]'));
        const bridgeLogs = logLines.filter(line => line.includes('│') || line.includes('─'));
        
        console.log(`   MCP logs: ${mcpLogs.length}`);
        console.log(`   Bridge logs: ${bridgeLogs.length}`);
        
        if (mcpLogs.length > 0) {
          console.log('✅ MCP logging to stderr working');
        }
        
        if (bridgeLogs.length > 0) {
          console.log('✅ Bridge server logging to stderr working');
        }
        
        resolve();
      } catch (error) {
        console.error('❌ Error parsing responses:', error.message);
        reject(error);
      }
    });
    
    mcpProcess.on('error', (error) => {
      console.error('❌ Process error:', error.message);
      reject(error);
    });
    
    // Send test messages
    setTimeout(() => {
      console.log('📤 Sending initialize message...');
      mcpProcess.stdin.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n');
    }, 100);
    
    setTimeout(() => {
      console.log('📤 Sending tools/list message...');
      mcpProcess.stdin.write('{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n');
    }, 500);
    
    setTimeout(() => {
      console.log('📤 Sending server status call...');
      mcpProcess.stdin.write('{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"brop_get_server_status","arguments":{}}}\n');
    }, 1000);
    
    setTimeout(() => {
      console.log('📤 Closing stdin...');
      mcpProcess.stdin.end();
    }, 1500);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!mcpProcess.killed) {
        mcpProcess.kill();
        reject(new Error('Test timeout'));
      }
    }, 10000);
  });
}

async function testRelayMode() {
  console.log('\n🧪 Testing MCP STDIO Server in RELAY MODE...');
  
  // First start a regular bridge server
  const { BROPBridgeServer } = require('./bridge/bridge_server.js');
  const bridgeServer = new BROPBridgeServer();
  
  try {
    await bridgeServer.startServers();
    console.log('✅ Bridge server started on port 9223');
    
    // Give it a moment to fully start
    await delay(1000);
    
    // Now test MCP server in relay mode
    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('node', [path.join(__dirname, 'bridge', 'mcp.js')], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      mcpProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      mcpProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      mcpProcess.on('close', (code) => {
        console.log(`✅ MCP relay process exited with code ${code}`);
        
        try {
          const responses = stdout.trim().split('\n').filter(line => line.trim());
          console.log(`📨 Received ${responses.length} JSON responses in relay mode`);
          
          const initResponse = JSON.parse(responses[0]);
          if (initResponse.result && initResponse.result.serverInfo) {
            console.log(`   Server mode: ${initResponse.result.serverInfo.mode}`);
            if (initResponse.result.serverInfo.mode === 'relay') {
              console.log('✅ Relay mode detected correctly');
            }
          }
          
          resolve();
        } catch (error) {
          console.error('❌ Error parsing relay responses:', error.message);
          reject(error);
        }
      });
      
      mcpProcess.on('error', (error) => {
        console.error('❌ Relay process error:', error.message);
        reject(error);
      });
      
      // Send test message
      setTimeout(() => {
        console.log('📤 Sending initialize message to relay...');
        mcpProcess.stdin.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n');
      }, 100);
      
      setTimeout(() => {
        console.log('📤 Closing relay stdin...');
        mcpProcess.stdin.end();
      }, 1000);
      
      setTimeout(() => {
        if (!mcpProcess.killed) {
          mcpProcess.kill();
          reject(new Error('Relay test timeout'));
        }
      }, 5000);
    });
    
  } finally {
    await bridgeServer.shutdown();
    console.log('✅ Bridge server shut down');
  }
}

async function main() {
  console.log('🧪 MCP BROP STDIO Server Tests');
  console.log('=' + '='.repeat(50));
  
  try {
    // Test server mode first
    await testMCPStdio();
    
    // Wait a bit between tests
    await delay(2000);
    
    // Test relay mode
    await testRelayMode();
    
    console.log('\n🎉 All STDIO tests completed successfully!');
    
  } catch (error) {
    console.error('\n💥 STDIO test suite failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testMCPStdio, testRelayMode };