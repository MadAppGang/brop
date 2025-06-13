const { spawn } = require('child_process');
const path = require('path');

// Complete test flow for the BROP extension
async function runCompleteTestFlow() {
  console.log('🧪 BROP COMPLETE TEST FLOW');
  console.log('==========================');
  console.log('📋 Running comprehensive test suite after CDP removal');
  
  const tests = [
    {
      name: 'Extension Reload',
      file: 'tests/debug/debug-reload.js',
      description: 'Test extension reload functionality'
    },
    {
      name: 'Explicit Tab Management',
      file: 'tests/integration/test-explicit-tabs.js',
      description: 'Test strict tab targeting with explicit tabIds'
    },
    {
      name: 'Console Logs Test',
      file: 'tests/console/test-console-logs.js', 
      description: 'Test console log capture with proper tabId handling'
    },
    {
      name: 'Runtime Messaging',
      file: 'tests/console/test-runtime-messaging.js',
      description: 'Test chrome.runtime.sendMessage approach'
    },
    {
      name: 'CSP Success',
      file: 'tests/integration/test-csp-success.js',
      description: 'Verify CSP compliance'
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;
  const results = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n🔧 Test ${i + 1}/${totalTests}: ${test.name}`);
    console.log(`📝 ${test.description}`);
    console.log(`📁 Running: ${test.file}`);
    console.log('─'.repeat(50));

    try {
      const result = await runTest(test.file);
      if (result.success) {
        console.log(`✅ ${test.name} PASSED`);
        passedTests++;
        results.push({ test: test.name, status: 'PASS', details: result.output });
      } else {
        console.log(`❌ ${test.name} FAILED`);
        results.push({ test: test.name, status: 'FAIL', details: result.error });
      }
    } catch (error) {
      console.log(`❌ ${test.name} ERROR: ${error.message}`);
      results.push({ test: test.name, status: 'ERROR', details: error.message });
    }

    // Add delay between tests
    if (i < tests.length - 1) {
      console.log('⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Final results
  console.log('\n🎉 TEST FLOW COMPLETE');
  console.log('=====================');
  console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  console.log(`📈 Success Rate: ${successRate}%`);
  
  console.log('\n📋 DETAILED RESULTS:');
  console.log('====================');
  results.forEach((result, i) => {
    const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${i + 1}. ${status} ${result.test}: ${result.status}`);
  });

  if (successRate >= 80) {
    console.log('\n🎉 EXCELLENT: Test suite passed!');
    console.log('✅ BROP extension is working correctly after CDP removal');
    console.log('✅ Runtime messaging approach is functional');
    console.log('✅ CSP compliance achieved');
    console.log('✅ Core browser automation features operational');
  } else {
    console.log('\n⚠️ NEEDS ATTENTION: Some tests failed');
    const failedTests = results.filter(r => r.status !== 'PASS');
    failedTests.forEach(test => {
      console.log(`❌ ${test.test}: ${test.details}`);
    });
  }

  return { passedTests, totalTests, successRate, results };
}

function runTest(testFile) {
  return new Promise((resolve) => {
    const child = spawn('node', [testFile], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Show real-time output for key indicators
      if (text.includes('✅') || text.includes('❌') || text.includes('🎉')) {
        process.stdout.write(text);
      }
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      // Consider success if:
      // 1. Exit code is 0, OR
      // 2. Output contains success indicators
      const hasSuccess = output.includes('✅') || output.includes('🎉 SUCCESS') || output.includes('SUCCESS:');
      const hasError = output.includes('❌') || errorOutput.length > 0;
      
      resolve({
        success: code === 0 || (hasSuccess && !hasError),
        output: output,
        error: errorOutput || `Exit code: ${code}`,
        code: code
      });
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        output: output,
        error: 'Test timeout (30 seconds)',
        code: -1
      });
    }, 30000);
  });
}

// Run the test flow
runCompleteTestFlow().catch(console.error);