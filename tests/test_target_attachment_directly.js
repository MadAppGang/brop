#!/usr/bin/env node
/**
 * Test Target.attachToTarget directly to see if our bridge server implementation works
 */

const WebSocket = require('ws');

async function testTargetAttachment() {
    console.log('🔍 Testing Target.attachToTarget directly with bridge server');
    
    const ws = new WebSocket('ws://localhost:9222');
    
    ws.on('open', () => {
        console.log('✅ Connected to bridge server');
        
        // First, create a target
        const createTargetMessage = {
            id: 1,
            method: 'Target.createTarget',
            params: {
                url: 'about:blank'
            }
        };
        
        console.log('📤 Sending Target.createTarget...');
        ws.send(JSON.stringify(createTargetMessage));
    });
    
    let targetId = null;
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('📥 Received:', JSON.stringify(message, null, 2));
            
            // Handle Target.createTarget response
            if (message.id === 1 && message.result) {
                targetId = message.result.targetId;
                console.log(`✅ Target created: ${targetId}`);
                
                // Now try to attach to the target
                const attachMessage = {
                    id: 2,
                    method: 'Target.attachToTarget',
                    params: {
                        targetId: targetId,
                        flatten: true
                    }
                };
                
                console.log('📤 Sending Target.attachToTarget...');
                ws.send(JSON.stringify(attachMessage));
            }
            
            // Handle Target.attachToTarget response
            if (message.id === 2) {
                if (message.result) {
                    console.log(`✅ Target attached with sessionId: ${message.result.sessionId}`);
                } else {
                    console.log('❌ Target attachment failed:', message.error);
                }
            }
            
            // Handle events
            if (message.method === 'Target.targetCreated') {
                console.log('📡 Target.targetCreated event received');
            }
            
            if (message.method === 'Target.attachedToTarget') {
                console.log('📡 Target.attachedToTarget event received');
                console.log('🎉 Success! Target attachment flow completed');
                ws.close();
            }
            
        } catch (error) {
            console.log('❌ Error parsing message:', error.message);
        }
    });
    
    ws.on('error', (error) => {
        console.log('❌ WebSocket error:', error.message);
    });
    
    ws.on('close', () => {
        console.log('🔌 Connection closed');
        process.exit(0);
    });
}

testTargetAttachment();