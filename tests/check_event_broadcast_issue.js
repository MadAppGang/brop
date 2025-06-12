#!/usr/bin/env node
/**
 * Check Event Broadcast Issue
 * 
 * The bridge logs show that Target events are being broadcast.
 * The assertion error happens right after these events.
 * Let's check if our events have incorrect structure or are sent to wrong sessions.
 */

const WebSocket = require('ws');

async function checkEventStructure() {
    console.log('🔍 Check Event Broadcast Structure');
    console.log('=' + '='.repeat(60));
    console.log('Goal: Verify that broadcasted events have correct structure');
    console.log('');
    
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9222');
        const capturedEvents = [];
        
        ws.on('open', () => {
            console.log('📡 Connected to capture broadcasted events');
            
            // Send Target.createTarget to trigger event broadcasting
            console.log('📤 Sending Target.createTarget to trigger events...');
            ws.send(JSON.stringify({
                id: 999,
                method: 'Target.createTarget',
                params: {
                    url: 'about:blank',
                    browserContextId: 'default'
                }
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                
                if (parsed.method) {
                    // This is an event
                    console.log(`\n📡 EVENT CAPTURED: ${parsed.method}`);
                    console.log(`   Full event: ${JSON.stringify(parsed, null, 2)}`);
                    
                    // Check event structure
                    const hasId = parsed.id !== undefined;
                    const hasMethod = parsed.method !== undefined;
                    const hasParams = parsed.params !== undefined;
                    
                    console.log(`   Structure check:`);
                    console.log(`     Has id: ${hasId} ${hasId ? '🚨 PROBLEM!' : '✅'}`);
                    console.log(`     Has method: ${hasMethod} ${hasMethod ? '✅' : '🚨 PROBLEM!'}`);
                    console.log(`     Has params: ${hasParams} ${hasParams ? '✅' : '⚠️'}`);
                    
                    if (hasId) {
                        console.log(`     🎯 THIS IS THE BUG! Event has id field: ${parsed.id}`);
                        console.log(`     This will cause assert(!object.id) to fail!`);
                    }
                    
                    capturedEvents.push(parsed);
                    
                } else if (parsed.id !== undefined) {
                    // This is a response
                    console.log(`📥 Response: id=${parsed.id}`);
                    
                    if (parsed.id === 999) {
                        console.log('✅ Our Target.createTarget response received');
                        
                        // Wait a bit more for any additional events
                        setTimeout(() => {
                            ws.close();
                        }, 1000);
                    }
                }
                
            } catch (error) {
                console.log(`❌ Parse error: ${error.message}`);
            }
        });
        
        ws.on('close', () => {
            console.log('\n📊 Event analysis complete');
            resolve(capturedEvents);
        });
        
        ws.on('error', (error) => {
            console.log(`❌ Connection error: ${error.message}`);
            resolve([]);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        }, 5000);
    });
}

function analyzeEventBroadcasting() {
    console.log('\n🔍 Analyze Event Broadcasting Logic');
    console.log('=' + '='.repeat(60));
    
    console.log('Current bridge server event broadcasting:');
    console.log('1. Extension sends Target.targetCreated event');
    console.log('2. Bridge calls broadcastExtensionEvent()');
    console.log('3. Bridge calls broadcastToCdpClients() for target events');
    console.log('4. Event sent to ALL CDP clients');
    console.log('');
    console.log('Potential problems:');
    console.log('1. Events sent to wrong session context');
    console.log('2. Events include id field when they shouldn\'t');
    console.log('3. Events sent to clients that don\'t expect them');
    console.log('4. Session routing confusion in Playwright');
    console.log('');
    console.log('💡 Possible solutions:');
    console.log('1. Don\'t broadcast target events to all clients');
    console.log('2. Send events only to specific session context');
    console.log('3. Remove event broadcasting entirely');
    console.log('4. Fix event structure if id field is present');
}

async function main() {
    console.log('🎯 Check Event Broadcast Issue');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find why broadcasted events cause assertion error');
    console.log('');
    
    const events = await checkEventStructure();
    analyzeEventBroadcasting();
    
    console.log(`\n📊 Analysis Results:`);
    console.log(`Captured ${events.length} events`);
    
    const eventsWithId = events.filter(e => e.id !== undefined);
    if (eventsWithId.length > 0) {
        console.log(`\n🚨 FOUND THE BUG! ${eventsWithId.length} events with id field:`);
        eventsWithId.forEach((event, index) => {
            console.log(`${index + 1}. ${event.method} has id: ${event.id}`);
        });
        console.log('\nFIX: Remove id field from events or fix event generation');
    } else {
        console.log('\n🤔 Events have correct structure (no id field)');
        console.log('The issue might be session routing or timing');
    }
    
    console.log('\n🔧 Next Steps:');
    console.log('1. If events have id fields: Fix event structure');
    console.log('2. If events are clean: Disable event broadcasting temporarily');
    console.log('3. Test if Playwright works without broadcasted events');
}

main();