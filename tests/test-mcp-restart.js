import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mcpServerPath = join(__dirname, '../bridge/mcp-server.js');
const dummyServerPath = join(__dirname, 'dummy-server.js');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('🚀 Starting MCP Restart Test');
    console.log('============================');
    
    // 1. Start dummy server
    console.log('1️⃣  Starting dummy server on port 9225...');
    const dummyProcess = spawn('node', [dummyServerPath], {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let dummyPid = dummyProcess.pid;
    console.log(`   Dummy server PID: ${dummyPid}`);

    // Wait for dummy server to start
    await new Promise((resolve) => {
        dummyProcess.stdout.on('data', (data) => {
            if (data.toString().includes('listening on port 9225')) {
                resolve();
            }
        });
        // Fallback timeout
        setTimeout(resolve, 2000);
    });
    console.log('   Dummy server is running.');

    // 2. Start MCP server with --restart-on-error
    console.log('\n2️⃣  Spawning MCP server with --restart-on-error...');
    const mcpProcess = spawn('node', [mcpServerPath, '--restart-on-error'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let killedDummy = false;
    let startedServerMode = false;
    let mcpOutput = '';

    mcpProcess.stderr.on('data', (data) => {
        const log = data.toString();
        mcpOutput += log;
        // console.log('[MCP Log]:', log.trim()); // Uncomment for debug

        if (log.includes('Killing existing process on port 9225')) {
            killedDummy = true;
            console.log('   ✅ Detected log: Killing existing process');
        }
        if (log.includes('MCP Server initialized in SERVER mode')) {
            startedServerMode = true;
            console.log('   ✅ Detected log: Initialized in SERVER mode');
        }
    });

    // 3. Wait for operation to complete
    console.log('\n3️⃣  Waiting for MCP server to initialize...');
    await sleep(8000); // Give it enough time to kill and restart

    // 4. Verify results
    console.log('\n4️⃣  Verifying results...');
    
    // Check if dummy process is still running
    let isDummyRunning = true;
    try {
        process.kill(dummyPid, 0); // Check if process exists
    } catch (e) {
        isDummyRunning = false;
    }

    if (!isDummyRunning) {
        console.log('   ✅ Dummy server process is gone');
    } else {
        console.error('   ❌ Dummy server process is STILL RUNNING');
        // Cleanup
        process.kill(dummyPid, 'SIGKILL');
    }

    if (killedDummy && startedServerMode && !isDummyRunning) {
        console.log('\n🎉 TEST PASSED: MCP server successfully killed zombie process and started.');
    } else {
        console.error('\n💥 TEST FAILED');
        if (!killedDummy) console.error('   - Did not see kill log');
        if (!startedServerMode) console.error('   - Did not see server mode start log');
        if (isDummyRunning) console.error('   - Dummy process was not killed');
        
        console.log('\nFull MCP Output:');
        console.log(mcpOutput);
    }

    // Cleanup MCP process
    mcpProcess.kill();
    process.exit(killedDummy && startedServerMode && !isDummyRunning ? 0 : 1);
}

runTest();
