const { chromium } = require('playwright');
const WebSocket = require('ws');

class CDPRelayTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.nativeCDP = null;
    this.proxyWS = null;
    this.results = {
      native: [],
      proxy: []
    };
  }

  async setup() {
    console.log('🚀 Setting up CDP Relay Test...');
    
    // Launch browser with CDP enabled
    this.browser = await chromium.launch({
      headless: false,
      args: ['--remote-debugging-port=9223']
    });
    
    this.page = await this.browser.newPage();
    
    // Connect to native CDP
    this.nativeCDP = new WebSocket('ws://localhost:9223/json');
    
    // Connect to our proxy
    this.proxyWS = new WebSocket('ws://localhost:9222');
    
    await this.waitForConnections();
  }

  async waitForConnections() {
    return new Promise((resolve) => {
      let connected = 0;
      
      this.nativeCDP.on('open', () => {
        console.log('✅ Native CDP connected');
        if (++connected === 2) resolve();
      });
      
      this.proxyWS.on('open', () => {
        console.log('✅ Proxy CDP connected');
        if (++connected === 2) resolve();
      });
    });
  }

  async sendCommand(connection, method, params = {}) {
    const id = Date.now() + Math.random();
    const command = { id, method, params };
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const messageHandler = (data) => {
        const response = JSON.parse(data);
        if (response.id === id) {
          connection.off('message', messageHandler);
          resolve({
            ...response,
            responseTime: Date.now() - startTime
          });
        }
      };
      
      connection.on('message', messageHandler);
      connection.send(JSON.stringify(command));
    });
  }

  async testCommand(method, params, description) {
    console.log(`\n🧪 Testing: ${description}`);
    
    // Test native CDP
    const nativeStart = Date.now();
    const nativeResult = await this.sendCommand(this.nativeCDP, method, params);
    const nativeTime = Date.now() - nativeStart;
    
    // Test proxy CDP
    const proxyStart = Date.now();
    const proxyResult = await this.sendCommand(this.proxyWS, method, params);
    const proxyTime = Date.now() - proxyStart;
    
    // Compare results
    const comparison = {
      method,
      description,
      native: {
        success: !nativeResult.error,
        responseTime: nativeTime,
        result: nativeResult.result || nativeResult.error
      },
      proxy: {
        success: !proxyResult.error,
        responseTime: proxyTime,
        result: proxyResult.result || proxyResult.error
      },
      identical: JSON.stringify(nativeResult.result) === JSON.stringify(proxyResult.result)
    };
    
    this.results.native.push(comparison.native);
    this.results.proxy.push(comparison.proxy);
    
    // Log results
    console.log(`   Native:  ${comparison.native.success ? '✅' : '❌'} ${comparison.native.responseTime}ms`);
    console.log(`   Proxy:   ${comparison.proxy.success ? '✅' : '❌'} ${comparison.proxy.responseTime}ms`);
    console.log(`   Match:   ${comparison.identical ? '✅' : '❌'}`);
    
    return comparison;
  }

  async runTestSuite() {
    const tests = [
      {
        method: 'Browser.getVersion',
        params: {},
        description: 'Get browser version'
      },
      {
        method: 'Target.getTargets',
        params: {},
        description: 'List all targets'
      },
      {
        method: 'Target.createTarget',
        params: { url: 'about:blank' },
        description: 'Create new target'
      },
      {
        method: 'Page.navigate',
        params: { url: 'https://example.com' },
        description: 'Navigate to example.com'
      },
      {
        method: 'Runtime.evaluate',
        params: { expression: 'document.title' },
        description: 'Evaluate JavaScript'
      },
      {
        method: 'DOM.getDocument',
        params: {},
        description: 'Get DOM document'
      },
      {
        method: 'Page.captureScreenshot',
        params: { format: 'png' },
        description: 'Capture screenshot'
      }
    ];

    console.log('🎯 Running CDP Relay Test Suite...\n');
    
    const results = [];
    for (const test of tests) {
      try {
        const result = await this.testCommand(test.method, test.params, test.description);
        results.push(result);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`   Error: ${error.message}`);
        results.push({
          method: test.method,
          description: test.description,
          error: error.message
        });
      }
    }
    
    return results;
  }

  generateReport(results) {
    console.log('\n📊 CDP Relay Test Report');
    console.log('='.repeat(50));
    
    const successfulTests = results.filter(r => r.native?.success && r.proxy?.success);
    const identicalResults = results.filter(r => r.identical);
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`Successful: ${successfulTests.length}/${results.length}`);
    console.log(`Identical Results: ${identicalResults.length}/${results.length}`);
    
    // Performance comparison
    const nativeTimes = successfulTests.map(r => r.native.responseTime);
    const proxyTimes = successfulTests.map(r => r.proxy.responseTime);
    
    const avgNative = nativeTimes.reduce((a, b) => a + b, 0) / nativeTimes.length;
    const avgProxy = proxyTimes.reduce((a, b) => a + b, 0) / proxyTimes.length;
    
    console.log(`\nPerformance:`);
    console.log(`  Native Average: ${avgNative.toFixed(2)}ms`);
    console.log(`  Proxy Average:  ${avgProxy.toFixed(2)}ms`);
    console.log(`  Difference:     ${(avgProxy - avgNative).toFixed(2)}ms`);
    
    // Detailed results
    console.log('\nDetailed Results:');
    results.forEach((result, i) => {
      console.log(`\n${i + 1}. ${result.description}`);
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   Native:  ${result.native.success ? '✅' : '❌'} ${result.native.responseTime}ms`);
        console.log(`   Proxy:   ${result.proxy.success ? '✅' : '❌'} ${result.proxy.responseTime}ms`);
        console.log(`   Match:   ${result.identical ? '✅ Identical' : '❌ Different'}`);
      }
    });
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.nativeCDP) {
      this.nativeCDP.close();
    }
    
    if (this.proxyWS) {
      this.proxyWS.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.setup();
      const results = await this.runTestSuite();
      this.generateReport(results);
      
      // Return summary for programmatic use
      return {
        total: results.length,
        successful: results.filter(r => r.native?.success && r.proxy?.success).length,
        identical: results.filter(r => r.identical).length,
        results
      };
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test if called directly
if (require.main === module) {
  const tester = new CDPRelayTester();
  tester.run()
    .then(summary => {
      console.log(`\n🎉 Test Complete: ${summary.successful}/${summary.total} successful, ${summary.identical}/${summary.total} identical`);
      process.exit(summary.successful === summary.total ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = CDPRelayTester;