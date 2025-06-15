import WebSocket from 'ws';

async function testCDPRelay() {
  console.log('🧪 Simple CDP Relay Test');
  console.log('========================\n');

  let ws;

  try {
    // 1. Connect to our unified bridge CDP endpoint
    console.log('1. Connecting to unified bridge CDP endpoint (port 9222)...');
    ws = new WebSocket('ws://localhost:9222/devtools/browser/brop-bridge-test');

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ Connected to unified bridge CDP endpoint');
        resolve();
      });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // 2. Test basic commands through unified bridge
    console.log('\n2. Testing CDP commands through unified bridge...\n');

    const tests = [
      {
        name: 'Browser Version',
        command: { id: 1, method: 'Browser.getVersion', params: {} }
      },
      {
        name: 'List Targets',
        command: { id: 2, method: 'Target.getTargets', params: {} }
      },
      {
        name: 'Navigate Page',
        command: { id: 3, method: 'Page.navigate', params: { url: 'https://example.com' } }
      },
      {
        name: 'Evaluate JavaScript',
        command: { id: 4, method: 'Runtime.evaluate', params: { expression: 'document.title' } }
      }
    ];

    for (const test of tests) {
      await runTest(ws, test.name, test.command);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  } finally {
    // Cleanup
    console.log('\n3. Cleaning up...');
    if (ws) ws.close();
    console.log('✅ Cleanup complete');
  }
  
  return true;
}

function runTest(ws, testName, command) {
  return new Promise((resolve, reject) => {
    console.log(`Testing: ${testName}`);
    
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to ${testName}`));
    }, 10000);

    const messageHandler = (data) => {
      try {
        const response = JSON.parse(data);
        if (response.id === command.id) {
          clearTimeout(timeout);
          ws.off('message', messageHandler);

          if (response.error) {
            console.log(`  ❌ Error: ${response.error.message}`);
          } else {
            console.log(`  ✅ Success: ${JSON.stringify(response.result).substring(0, 100)}...`);
          }
          resolve(response);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    };

    ws.on('message', messageHandler);
    ws.send(JSON.stringify(command));
  });
}

// Run the test
testCDPRelay().then((success) => {
  if (success) {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  } else {
    console.log('\n💥 Test failed!');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});

export default testCDPRelay;