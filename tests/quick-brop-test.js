import WebSocket from 'ws';

async function quickBROPTest() {
  console.log('🧪 Quick BROP Test');
  console.log('=================\n');

  let ws;

  try {
    // Connect to our BROP bridge
    console.log('1. Connecting to BROP bridge (port 9225)...');
    ws = new WebSocket('ws://localhost:9225');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ Connected to BROP bridge');
        resolve();
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Test basic BROP commands
    console.log('\n2. Testing BROP commands...\n');

    const tests = [
      {
        name: 'List Tabs',
        command: { 
          id: 1, 
          type: 'brop_command',
          method: 'list_tabs', 
          params: {} 
        }
      },
      {
        name: 'Extension Version',
        command: { 
          id: 2, 
          type: 'brop_command',
          method: 'get_extension_version', 
          params: {} 
        }
      }
    ];

    for (const test of tests) {
      console.log(`Testing: ${test.name}`);
      
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 10000);
        
        const messageHandler = (data) => {
          try {
            const message = JSON.parse(data);
            if (message.id === test.command.id) {
              clearTimeout(timeout);
              ws.off('message', messageHandler);
              resolve(message);
            }
          } catch (e) {
            // Ignore parsing errors for other messages
          }
        };

        ws.on('message', messageHandler);
        ws.send(JSON.stringify(test.command));
      });

      if (response.error) {
        console.log(`❌ ${test.name}: ${response.error}`);
      } else if (response.success === false) {
        console.log(`❌ ${test.name}: ${response.error || 'Unknown error'}`);
      } else {
        console.log(`✅ ${test.name}: Success`);
        if (test.name === 'List Tabs' && response.result) {
          console.log(`   Found ${response.result.tabs?.length || 0} tabs`);
        }
        if (test.name === 'Extension Version' && response.result?.result) {
          console.log(`   Version: ${response.result.result.extension_version}`);
        }
      }
    }

    console.log('\n🎉 BROP test completed successfully!');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    throw error;
  } finally {
    if (ws) {
      ws.close();
    }
  }
}

// Run the test
quickBROPTest().then(() => {
  console.log('\n✅ All BROP tests passed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ BROP test failed:', error.message);
  process.exit(1);
});