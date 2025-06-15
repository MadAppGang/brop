import { chromium } from 'playwright';
import WebSocket from 'ws';

async function testCDPRelay() {
  console.log('🧪 Simple CDP Relay Test');
  console.log('========================\n');

  let browser, page, ws;

  try {
    // 1. Launch browser
    console.log('1. Launching browser...');
    browser = await chromium.launch({
      headless: false,
      args: ['--remote-debugging-port=9223']
    });
    page = await browser.newPage();

    // 2. Connect to our CDP proxy
    console.log('2. Connecting to CDP proxy (port 9222)...');
    ws = new WebSocket('ws://localhost:9222');

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ Connected to CDP proxy');
        resolve();
      });
      ws.on('error', reject);
    });

    // 3. Test basic commands
    console.log('\n3. Testing CDP commands through proxy...\n');

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
  } finally {
    // Cleanup
    console.log('\n4. Cleaning up...');
    if (ws) ws.close();
    if (browser) await browser.close();
    console.log('✅ Cleanup complete');
  }
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
testCDPRelay().then(() => {
  console.log('\n🎉 Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});

export default testCDPRelay;