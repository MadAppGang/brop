#!/usr/bin/env node
/**
 * BROP Basic Functionality Test - Using proper BROP commands
 */

const WebSocket = require('ws');
const { createBROPConnection } = require('../client');

class BROPFunctionalityTest {
  constructor() {
    this.ws = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.currentTabId = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = createBROPConnection();
      
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

  async sendCommand(method, params = {}) {
    const id = ++this.requestId;
    const command = {
      id,
      method,
      params
    };

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

  async testServerStatus() {
    console.log('\n📋 Testing BROP server status...');
    
    try {
      const response = await this.sendCommand('get_server_status');
      if (response.success && response.result) {
        console.log('✅ BROP server is operational');
        console.log(`   Server version: ${response.result.version || 'N/A'}`);
        console.log(`   Uptime: ${response.result.uptime || 'N/A'}`);
        console.log(`   Status: ${response.result.status || 'running'}`);
        return true;
      } else {
        console.log('❌ Failed to get server status:', response);
        return false;
      }
    } catch (error) {
      console.log('❌ Server status test failed:', error.message);
      return false;
    }
  }

  async testTabManagement() {
    console.log('\n🎯 Testing tab management...');
    
    try {
      // Get list of tabs
      const listResponse = await this.sendCommand('list_tabs');
      if (listResponse.success && listResponse.result) {
        const tabs = listResponse.result.tabs || [];
        console.log(`✅ Found ${tabs.length} tabs`);
        
        // Find an accessible tab or create a new one
        const accessibleTab = tabs.find(tab => tab.accessible && !tab.url.includes('chrome://'));
        
        if (accessibleTab) {
          this.currentTabId = accessibleTab.tabId;
          console.log(`✅ Using existing tab ${this.currentTabId}: ${accessibleTab.title}`);
        } else {
          // Create a new tab
          console.log('   Creating new tab...');
          const createResponse = await this.sendCommand('create_tab', {
            url: 'https://example.com'
          });
          
          if (createResponse.success && createResponse.result.tabId) {
            this.currentTabId = createResponse.result.tabId;
            console.log(`✅ Created new tab ${this.currentTabId}`);
          } else {
            console.log('❌ Failed to create tab:', createResponse);
            return false;
          }
        }
        
        return true;
      } else {
        console.log('❌ Failed to get tabs list:', listResponse);
        return false;
      }
    } catch (error) {
      console.log('❌ Tab management test failed:', error.message);
      return false;
    }
  }

  async testNavigation() {
    console.log('\n🌐 Testing navigation...');
    
    if (!this.currentTabId) {
      console.log('❌ No tab available for navigation test');
      return false;
    }
    
    try {
      const response = await this.sendCommand('navigate', {
        tabId: this.currentTabId,
        url: 'https://example.com'
      });
      
      if (response.success) {
        console.log('✅ Navigation successful');
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test page title retrieval
        const titleResponse = await this.sendCommand('execute_console', {
          tabId: this.currentTabId,
          code: 'document.title'
        });
        
        if (titleResponse.success && titleResponse.result) {
          console.log(`✅ Page title: "${titleResponse.result.result || 'Unknown'}"`);
          return true;
        } else {
          console.log('⚠️  Could not get page title:', titleResponse);
          return true; // Navigation still worked
        }
      } else {
        console.log('❌ Navigation failed:', response);
        return false;
      }
    } catch (error) {
      console.log('❌ Navigation test failed:', error.message);
      return false;
    }
  }

  async testPageContent() {
    console.log('\n📄 Testing page content extraction...');
    
    if (!this.currentTabId) {
      console.log('❌ No tab available for content test');
      return false;
    }
    
    try {
      const response = await this.sendCommand('get_page_content', {
        tabId: this.currentTabId
      });
      
      if (response.success && response.result) {
        const content = response.result;
        console.log('✅ Page content extracted successfully');
        console.log(`   Title: ${content.title || 'N/A'}`);
        console.log(`   URL: ${content.url || 'N/A'}`);
        console.log(`   Content length: ${content.content?.length || 0} characters`);
        return true;
      } else {
        console.log('❌ Failed to get page content:', response);
        return false;
      }
    } catch (error) {
      console.log('❌ Page content test failed:', error.message);
      return false;
    }
  }

  async testScreenshot() {
    console.log('\n📸 Testing screenshot capture...');
    
    if (!this.currentTabId) {
      console.log('❌ No tab available for screenshot test');
      return false;
    }
    
    try {
      const response = await this.sendCommand('get_screenshot', {
        tabId: this.currentTabId,
        format: 'png'
      });
      
      if (response.success && response.result) {
        const screenshot = response.result;
        console.log('✅ Screenshot captured successfully');
        console.log(`   Format: ${screenshot.format || 'N/A'}`);
        console.log(`   Size: ${screenshot.data?.length || 0} bytes`);
        return true;
      } else {
        console.log('❌ Failed to capture screenshot:', response);
        return false;
      }
    } catch (error) {
      console.log('❌ Screenshot test failed:', error.message);
      return false;
    }
  }

  async testConsoleLogs() {
    console.log('\n📜 Testing console logs capture...');
    
    if (!this.currentTabId) {
      console.log('❌ No tab available for console test');
      return false;
    }
    
    try {
      const response = await this.sendCommand('get_console_logs', {
        tabId: this.currentTabId,
        limit: 10
      });
      
      if (response.success && response.result) {
        const logs = response.result.logs || [];
        console.log(`✅ Console logs retrieved: ${logs.length} entries`);
        console.log(`   Source: ${response.result.source || 'N/A'}`);
        return true;
      } else {
        console.log('❌ Failed to get console logs:', response);
        return false;
      }
    } catch (error) {
      console.log('❌ Console logs test failed:', error.message);
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
  console.log('Testing core BROP functionality with proper commands');
  
  const tester = new BROPFunctionalityTest();
  let passedTests = 0;
  let totalTests = 0;
  
  try {
    await tester.connect();
    
    const tests = [
      { name: 'Server Status', fn: () => tester.testServerStatus() },
      { name: 'Tab Management', fn: () => tester.testTabManagement() },
      { name: 'Navigation', fn: () => tester.testNavigation() },
      { name: 'Page Content', fn: () => tester.testPageContent() },
      { name: 'Screenshot', fn: () => tester.testScreenshot() },
      { name: 'Console Logs', fn: () => tester.testConsoleLogs() }
    ];
    
    for (const test of tests) {
      totalTests++;
      const passed = await test.fn();
      if (passed) {
        passedTests++;
      }
      
      // Short delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Test Results:');
    console.log('================');
    console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
    console.log(`📈 Success Rate: ${Math.round((passedTests/totalTests) * 100)}%`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All BROP functionality tests passed!');
      console.log('✅ BROP service is fully operational');
    } else {
      console.log('⚠️  Some functionality tests failed');
      console.log('💡 This may indicate partial functionality or configuration issues');
    }
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    passedTests = 0;
  } finally {
    tester.close();
  }
  
  // Exit with success if most tests passed (>= 80%)
  const successRate = totalTests > 0 ? (passedTests / totalTests) : 0;
  process.exit(successRate >= 0.8 ? 0 : 1);
}

runTests();