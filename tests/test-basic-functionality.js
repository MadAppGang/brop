#!/usr/bin/env node

const WebSocket = require('ws');

class BROPFunctionalityTest {
  constructor() {
    this.ws = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:9222');
      
      this.ws.on('open', () => {
        console.log('✅ Connected to BROP bridge server');
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ Connection error:', error.message);
        reject(error);
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });
    });
  }

  handleMessage(message) {
    const requestId = message.id;
    if (this.pendingRequests.has(requestId)) {
      const { resolve } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      resolve(message);
    }
  }

  async sendCommand(method, params = {}, targetId = null) {
    const id = ++this.requestId;
    const command = {
      id,
      method,
      params
    };
    
    if (targetId) {
      command.targetId = targetId;
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.ws.send(JSON.stringify(command));
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  async testNavigateToExample() {
    console.log('\n🌐 Testing navigation to example.com...');
    
    try {
      // First, create a new target (tab)
      const createResponse = await this.sendCommand('Target.createTarget', {
        url: 'https://example.com'
      });
      
      if (createResponse.result && createResponse.result.targetId) {
        const targetId = createResponse.result.targetId;
        console.log(`✅ Created target: ${targetId}`);
        
        // Wait a moment for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test Runtime.evaluate
        const evalResponse = await this.sendCommand('Runtime.evaluate', {
          expression: 'document.title'
        }, targetId);
        
        if (evalResponse.result && evalResponse.result.result) {
          console.log(`✅ Page title: "${evalResponse.result.result.value}"`);
        } else {
          console.log('⚠️  Could not get page title:', evalResponse);
        }
        
        return true;
      } else {
        console.log('❌ Failed to create target:', createResponse);
        return false;
      }
    } catch (error) {
      console.log('❌ Navigation test failed:', error.message);
      return false;
    }
  }

  async testBrowserInfo() {
    console.log('\n📋 Testing browser information...');
    
    try {
      const response = await this.sendCommand('Browser.getVersion');
      if (response.result) {
        console.log('✅ Browser version:', response.result.product);
        console.log('✅ Protocol version:', response.result.protocolVersion);
        return true;
      } else {
        console.log('❌ Failed to get browser info:', response);
        return false;
      }
    } catch (error) {
      console.log('❌ Browser info test failed:', error.message);
      return false;
    }
  }

  async testTargetsList() {
    console.log('\n🎯 Testing targets list...');
    
    try {
      const response = await this.sendCommand('Target.getTargets');
      if (response.result && response.result.targetInfos) {
        const targets = response.result.targetInfos;
        console.log(`✅ Found ${targets.length} targets`);
        targets.forEach((target, i) => {
          console.log(`   ${i + 1}. ${target.type}: ${target.title || target.url}`);
        });
        return true;
      } else {
        console.log('❌ Failed to get targets:', response);
        return false;
      }
    } catch (error) {
      console.log('❌ Targets test failed:', error.message);
      return false;
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runTests() {
  console.log('🧪 BROP Basic Functionality Test');
  console.log('=================================');
  
  const tester = new BROPFunctionalityTest();
  let allPassed = true;
  
  try {
    await tester.connect();
    
    const tests = [
      { name: 'Browser Info', fn: () => tester.testBrowserInfo() },
      { name: 'Targets List', fn: () => tester.testTargetsList() },
      { name: 'Navigation & Evaluation', fn: () => tester.testNavigateToExample() }
    ];
    
    for (const test of tests) {
      const passed = await test.fn();
      if (!passed) {
        allPassed = false;
      }
    }
    
    console.log('\n📊 Test Results:');
    console.log('================');
    console.log(allPassed ? '🎉 All tests passed!' : '⚠️  Some tests failed');
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    allPassed = false;
  } finally {
    tester.close();
  }
  
  process.exit(allPassed ? 0 : 1);
}

runTests();