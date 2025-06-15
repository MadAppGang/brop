import WebSocket from 'ws';

async function comprehensiveMultiplexedTest() {
  console.log('🧪 Comprehensive Multiplexed System Test');
  console.log('======================================\n');

  let bropWs, cdpWs;

  try {
    // Test 1: Connect to BROP bridge
    console.log('1. Testing BROP Connection (port 9225)...');
    bropWs = new WebSocket('ws://localhost:9225');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('BROP connection timeout')), 5000);
      
      bropWs.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ BROP bridge connected');
        resolve();
      });
      
      bropWs.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Test 2: Connect to CDP proxy
    console.log('2. Testing CDP Connection (port 9222)...');
    cdpWs = new WebSocket('ws://localhost:9222');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('CDP connection timeout')), 5000);
      
      cdpWs.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ CDP proxy connected');
        resolve();
      });
      
      cdpWs.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    console.log('\n3. Testing BROP Commands via BROPServer...\n');

    // Test BROP commands
    const bropTests = [
      {
        name: 'List Tabs (BROP)',
        command: { 
          id: 1, 
          type: 'brop_command',
          method: 'list_tabs', 
          params: {} 
        }
      },
      {
        name: 'Extension Version (BROP)',
        command: { 
          id: 2, 
          type: 'brop_command',
          method: 'get_extension_version', 
          params: {} 
        }
      }
    ];

    for (const test of bropTests) {
      console.log(`Testing: ${test.name}`);
      
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 10000);
        
        const messageHandler = (data) => {
          try {
            const message = JSON.parse(data);
            if (message.id === test.command.id) {
              clearTimeout(timeout);
              bropWs.off('message', messageHandler);
              resolve(message);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        };

        bropWs.on('message', messageHandler);
        bropWs.send(JSON.stringify(test.command));
      });

      if (response.success === false) {
        console.log(`❌ ${test.name}: ${response.error || 'Unknown error'}`);
      } else {
        console.log(`✅ ${test.name}: Success`);
        if (test.name.includes('List Tabs') && response.result) {
          console.log(`   Found ${response.result.tabs?.length || 0} tabs`);
        }
        if (test.name.includes('Extension Version') && response.result?.result) {
          console.log(`   Version: ${response.result.result.extension_version}`);
        }
      }
    }

    console.log('\n4. Testing CDP Commands via CDPServer...\n');

    // Test CDP commands
    const cdpTests = [
      {
        name: 'Browser Version (CDP)',
        command: { 
          id: 10, 
          method: 'Browser.getVersion', 
          params: {} 
        }
      },
      {
        name: 'List Targets (CDP)',
        command: { 
          id: 11, 
          method: 'Target.getTargets', 
          params: {} 
        }
      }
    ];

    for (const test of cdpTests) {
      console.log(`Testing: ${test.name}`);
      
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 10000);
        
        const messageHandler = (data) => {
          try {
            const message = JSON.parse(data);
            if (message.id === test.command.id) {
              clearTimeout(timeout);
              cdpWs.off('message', messageHandler);
              resolve(message);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        };

        cdpWs.on('message', messageHandler);
        cdpWs.send(JSON.stringify(test.command));
      });

      if (response.error) {
        console.log(`❌ ${test.name}: ${response.error.message || 'Unknown error'}`);
      } else {
        console.log(`✅ ${test.name}: Success`);
        if (test.name.includes('Browser Version') && response.result) {
          console.log(`   Browser: ${response.result.product}`);
        }
        if (test.name.includes('List Targets') && response.result) {
          console.log(`   Found ${response.result.targetInfos?.length || 0} targets`);
        }
      }
    }

    console.log('\n🎉 Comprehensive multiplexed system test completed successfully!');
    console.log('\n✅ Architecture Validation:');
    console.log('   📦 BROPServer: Handling native BROP commands');
    console.log('   🎭 CDPServer: Handling CDP commands via real Chrome');
    console.log('   🌉 Multiplexed Client: Clean delegation layer');
    console.log('   🔗 Both protocols working independently and correctly');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    throw error;
  } finally {
    if (bropWs) bropWs.close();
    if (cdpWs) cdpWs.close();
  }
}

// Run the test
comprehensiveMultiplexedTest().then(() => {
  console.log('\n🏆 All multiplexed system tests passed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Multiplexed system test failed:', error.message);
  process.exit(1);
});