#!/usr/bin/env node
/**
 * Direct CDP Comparison
 * 
 * Compare CDP messages between native Chrome and our bridge using the exact same command sequence
 */

import WebSocket from 'ws';
import fs from 'fs';

class CDPMessageCapture {
  constructor(name, url) {
    this.name = name;
    this.url = url;
    this.messages = [];
    this.commandId = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`🔗 ${this.name}: Connecting to ${this.url}`);
      
      this.ws = new WebSocket(this.url);
      
      this.ws.on('open', () => {
        console.log(`✅ ${this.name}: Connected`);
        resolve();
      });
      
      this.ws.on('message', (data) => {
        const message = data.toString();
        console.log(`📥 ${this.name}: ${message}`);
        
        this.messages.push({
          direction: 'received',
          timestamp: Date.now(),
          data: message,
          parsed: JSON.parse(message)
        });
      });
      
      this.ws.on('error', (error) => {
        console.log(`💥 ${this.name}: Error: ${error.message}`);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log(`❌ ${this.name}: Disconnected`);
      });
    });
  }

  async sendCommand(method, params = {}) {
    const id = ++this.commandId;
    const command = { id, method, params };
    const commandStr = JSON.stringify(command);
    
    console.log(`📤 ${this.name}: ${commandStr}`);
    
    this.messages.push({
      direction: 'sent',
      timestamp: Date.now(),
      data: commandStr,
      parsed: command
    });
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command ${method} timed out`));
      }, 5000);
      
      const originalMessageHandler = this.ws.listeners('message');
      
      const responseHandler = (data) => {
        const message = JSON.parse(data.toString());
        if (message.id === id) {
          clearTimeout(timeout);
          this.ws.removeListener('message', responseHandler);
          resolve(message);
        }
      };
      
      this.ws.on('message', responseHandler);
      this.ws.send(commandStr);
    });
  }

  async runPlaywrightSequence() {
    console.log(`\n🎯 ${this.name}: PLAYWRIGHT SEQUENCE`);
    console.log('='.repeat(50));
    
    try {
      await this.connect();
      
      // The exact sequence Playwright uses for creating a page
      console.log('\n[1] Browser.getVersion');
      const version = await this.sendCommand('Browser.getVersion');
      
      console.log('\n[2] Target.setDiscoverTargets');
      const discover = await this.sendCommand('Target.setDiscoverTargets', { discover: true });
      
      console.log('\n[3] Target.setAutoAttach');
      const autoAttach = await this.sendCommand('Target.setAutoAttach', {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true
      });
      
      console.log('\n[4] Target.createBrowserContext');
      const context = await this.sendCommand('Target.createBrowserContext');
      const browserContextId = context.result?.browserContextId;
      
      console.log('\n[5] Target.createTarget');
      const target = await this.sendCommand('Target.createTarget', {
        url: 'about:blank',
        browserContextId: browserContextId
      });
      
      // Wait for any additional async messages (events)
      console.log('\n[6] Waiting for events...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`\n✅ ${this.name}: Sequence complete`);
      
    } catch (error) {
      console.log(`❌ ${this.name}: Failed: ${error.message}`);
    }
    
    this.ws?.close();
    return this.saveMessages();
  }

  saveMessages() {
    const filename = `CDP_MESSAGES_${this.name.toUpperCase().replace(/\s+/g, '_')}.json`;
    const data = {
      testName: this.name,
      url: this.url,
      timestamp: new Date().toISOString(),
      totalMessages: this.messages.length,
      messages: this.messages
    };
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`💾 ${this.name}: Saved ${this.messages.length} messages to ${filename}`);
    return filename;
  }
}

async function main() {
  console.log('🔍 DIRECT CDP MESSAGE COMPARISON');
  console.log('=================================');
  console.log('Running identical command sequences against native Chrome and our bridge');
  console.log('to identify the exact protocol differences');
  console.log('');
  
  // Test native Chrome - this should work perfectly
  const nativeCapture = new CDPMessageCapture(
    'NATIVE CHROME',
    'ws://localhost:9223/devtools/browser/02f7b28d-8947-4215-a1ee-68f5d4d99458'
  );
  
  const nativeFile = await nativeCapture.runPlaywrightSequence();
  
  // Test our bridge - this will show any differences
  const bridgeCapture = new CDPMessageCapture(
    'BROP BRIDGE',
    'ws://localhost:9222/devtools/browser/brop-bridge-uuid-12345678'
  );
  
  const bridgeFile = await bridgeCapture.runPlaywrightSequence();
  
  console.log('\n🎯 COMPARISON COMPLETE');
  console.log('======================');
  console.log(`Native Chrome: ${nativeFile}`);
  console.log(`BROP Bridge: ${bridgeFile}`);
  console.log('');
  console.log('Compare these files to find the exact protocol differences');
  console.log('that cause Playwright\'s _page undefined issue');
}

main().catch(console.error);