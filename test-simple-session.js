#!/usr/bin/env node

/**
 * Simple test to capture exactly what messages our bridge sends vs native Chrome
 * This will help us identify the exact protocol differences causing Playwright assertion errors
 */

import WebSocket from 'ws';

const cdpUrl = 'ws://localhost:9222/devtools/browser/brop-bridge-uuid-12345678';

console.log('🎯 SIMPLE SESSION TEST: Connecting to our bridge');
console.log('📡 URL:', cdpUrl);

const ws = new WebSocket(cdpUrl);
const messages = [];

ws.on('open', () => {
  console.log('✅ Connected to bridge');
  
  // Send the exact same sequence that causes Playwright assertion error
  console.log('📤 Sending Browser.getVersion');
  ws.send(JSON.stringify({
    id: 1,
    method: 'Browser.getVersion',
    params: {}
  }));
  
  setTimeout(() => {
    console.log('📤 Sending Target.createTarget');
    ws.send(JSON.stringify({
      id: 2,
      method: 'Target.createTarget',
      params: {
        url: 'about:blank'
      }
    }));
  }, 100);
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  messages.push({
    timestamp: Date.now(),
    direction: 'received',
    data: message
  });
  
  console.log('📥 Received:', JSON.stringify(message, null, 2));
  
  // If we got Target.createTarget response, try to send a session command
  if (message.id === 2 && message.result && message.result.targetId) {
    console.log('🎯 Got Target.createTarget response, waiting for Target.attachedToTarget event...');
  }
  
  // If we got Target.attachedToTarget event, try session command
  if (message.method === 'Target.attachedToTarget') {
    const sessionId = message.params.sessionId;
    console.log(`🔧 Got Target.attachedToTarget with sessionId: ${sessionId}`);
    console.log('📤 Sending Page.enable to session');
    
    ws.send(JSON.stringify({
      id: 3,
      method: 'Page.enable',
      params: {},
      sessionId: sessionId
    }));
  }
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
  console.log('\n📊 SUMMARY:');
  console.log(`Total messages received: ${messages.length}`);
  
  messages.forEach((msg, i) => {
    console.log(`${i + 1}. ${msg.data.method || 'response'} (ID: ${msg.data.id || 'none'})`);
  });
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

// Auto-close after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - closing');
  ws.close();
}, 10000);