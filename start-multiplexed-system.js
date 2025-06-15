#!/usr/bin/env node

/**
 * Start Multiplexed BROP System
 * This script sets up and starts all components of the multiplexed system
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

class MultiplexedSystemLauncher {
  constructor() {
    this.processes = [];
    this.running = false;
  }

  async startSystem() {
    console.log('🌉 STARTING MULTIPLEXED BROP SYSTEM');
    console.log('=' .repeat(50));
    
    try {
      // Check if Chrome is running on 9223
      await this.checkRealChrome();
      
      // Start the multiplexed bridge server
      await this.startMultiplexedBridge();
      
      // Wait for services to initialize
      await this.wait(3000);
      
      console.log('✅ Multiplexed system started successfully');
      
    } catch (error) {
      console.error('💥 Failed to start system:', error);
      await this.cleanup();
    }
  }

  async checkRealChrome() {
    try {
      const response = await fetch('http://localhost:9223/json/version');
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Real Chrome available: ${data.Browser}`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.log('❌ Real Chrome not available on port 9223');
      console.log('💡 Starting Chrome automatically...');
      await this.startRealChrome();
    }
  }

  async startRealChrome() {
    return new Promise((resolve, reject) => {
      const chromeArgs = [
        '--remote-debugging-port=9223',
        '--headless',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-default-apps'
      ];

      // Try different Chrome paths
      const chromePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        'google-chrome',
        'chromium'
      ];

      let chromeProcess = null;
      
      for (const chromePath of chromePaths) {
        try {
          chromeProcess = spawn(chromePath, chromeArgs, {
            stdio: 'pipe',
            detached: false
          });
          
          console.log(`🔧 Starting Chrome: ${chromePath}`);
          break;
        } catch (error) {
          console.log(`⚠️ Failed to start Chrome at ${chromePath}`);
          continue;
        }
      }

      if (!chromeProcess) {
        reject(new Error('Could not find Chrome executable'));
        return;
      }

      this.processes.push(chromeProcess);

      chromeProcess.stdout.on('data', (data) => {
        // Chrome startup messages
      });

      chromeProcess.stderr.on('data', (data) => {
        // Chrome error messages
      });

      chromeProcess.on('error', (error) => {
        reject(new Error(`Chrome startup error: ${error.message}`));
      });

      // Wait for Chrome to start
      setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:9223/json/version');
          if (response.ok) {
            console.log('✅ Chrome started successfully');
            resolve();
          } else {
            reject(new Error('Chrome started but not responding'));
          }
        } catch (error) {
          reject(new Error('Chrome failed to start properly'));
        }
      }, 3000);
    });
  }

  async startMultiplexedBridge() {
    console.log('🔧 Starting multiplexed bridge server...');
    
    const bridgeProcess = spawn('node', ['bridge/bridge_server_multiplexed.js'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    this.processes.push(bridgeProcess);

    bridgeProcess.on('error', (error) => {
      console.error('❌ Bridge server error:', error);
    });

    bridgeProcess.on('exit', (code) => {
      console.log(`🔌 Bridge server exited with code ${code}`);
    });

    // Wait for bridge to start
    await this.wait(2000);
    
    // Test bridge availability
    try {
      const response = await fetch('http://localhost:9222/json/version');
      if (response.ok) {
        console.log('✅ Multiplexed bridge started successfully');
      } else {
        throw new Error('Bridge not responding');
      }
    } catch (error) {
      throw new Error('Failed to start multiplexed bridge');
    }
  }


  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up processes...');
    
    for (const process of this.processes) {
      try {
        if (!process.killed) {
          process.kill('SIGTERM');
          console.log('🔌 Process terminated');
        }
      } catch (error) {
        console.log('⚠️ Error terminating process:', error.message);
      }
    }
    
    this.processes = [];
  }

  async showInstructions() {
    console.log('\n📋 MANUAL SETUP INSTRUCTIONS');
    console.log('=' .repeat(50));
    console.log('');
    console.log('1. Start Real Chrome (Terminal 1):');
    console.log('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\');
    console.log('     --remote-debugging-port=9223 --headless');
    console.log('');
    console.log('2. Start Multiplexed Bridge (Terminal 2):');
    console.log('   node bridge/bridge_server_multiplexed.js');
    console.log('');
    console.log('3. Update Extension Manifest:');
    console.log('   Replace background.js with background_bridge_client_multiplexed.js');
    console.log('');
    console.log('4. Reload Chrome Extension in chrome://extensions/');
    console.log('');
    console.log('Expected Results:');
    console.log('- ✅ BROP native commands work via extension APIs');
    console.log('- ✅ CDP commands forwarded to real Chrome');
    console.log('- ✅ Playwright page creation succeeds');
    console.log('- ✅ Multiple concurrent CDP clients supported');
  }
}

async function main() {
  const launcher = new MultiplexedSystemLauncher();
  
  const mode = process.argv[2];
  
  if (mode === 'auto') {
    await launcher.startSystem();
  } else {
    await launcher.showInstructions();
  }
  
  // Setup cleanup on exit
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await launcher.cleanup();
    process.exit(0);
  });
}

main().catch(console.error);