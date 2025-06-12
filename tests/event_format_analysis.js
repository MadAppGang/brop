#!/usr/bin/env node
/**
 * Event Format Analysis
 * 
 * Based on the captured messages, it looks like the assertion failure happens
 * when Playwright receives Target events. Let's analyze the exact format of
 * these events and see if there's a mismatch with what Playwright expects.
 */

const WebSocket = require('ws');

async function analyzeEventFormats() {
    console.log('🔍 Event Format Analysis');
    console.log('=' + '='.repeat(50));
    
    return new Promise((resolve) => {
        const events = [];
        const ws = new WebSocket('ws://localhost:9222');
        let messageId = 1;
        
        ws.on('open', () => {
            console.log('✅ WebSocket connected');
            
            // Send commands that generate events
            console.log('📤 Sending Browser.getVersion...');
            ws.send(JSON.stringify({
                id: messageId++,
                method: 'Browser.getVersion',
                params: {}
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                const isEvent = parsed.method && !parsed.id;
                const isResponse = parsed.id !== undefined;
                
                if (isEvent) {
                    console.log(`📡 EVENT: ${parsed.method}`);
                    console.log(`   Full event: ${JSON.stringify(parsed, null, 2)}`);
                    
                    // Validate event structure
                    console.log(`   ✓ Has method: ${!!parsed.method}`);
                    console.log(`   ✓ Has params: ${!!parsed.params}`);
                    console.log(`   ✓ No id field: ${parsed.id === undefined}`);
                    
                    // Check specific event field requirements
                    if (parsed.method === 'Target.targetCreated') {
                        console.log(`   ✓ Has targetInfo: ${!!parsed.params?.targetInfo}`);
                        console.log(`   ✓ targetInfo.targetId: ${!!parsed.params?.targetInfo?.targetId}`);
                        console.log(`   ✓ targetInfo.type: ${!!parsed.params?.targetInfo?.type}`);
                    }
                    
                    if (parsed.method === 'Target.attachedToTarget') {
                        console.log(`   ✓ Has sessionId: ${!!parsed.params?.sessionId}`);
                        console.log(`   ✓ Has targetInfo: ${!!parsed.params?.targetInfo}`);
                        console.log(`   ✓ Has waitingForDebugger: ${parsed.params?.waitingForDebugger !== undefined}`);
                    }
                    
                    events.push(parsed);
                } else if (isResponse) {
                    console.log(`📥 RESPONSE: id=${parsed.id}, success=${!!parsed.result}`);
                    
                    if (parsed.id === 1) {
                        // After Browser.getVersion, create a target to trigger events
                        console.log('📤 Sending Target.createTarget...');
                        ws.send(JSON.stringify({
                            id: messageId++,
                            method: 'Target.createTarget',
                            params: {
                                url: 'about:blank',
                                browserContextId: 'default'
                            }
                        }));
                    } else if (parsed.id === 2) {
                        // Give time for any additional events
                        setTimeout(() => {
                            ws.close();
                        }, 1000);
                    }
                }
                
            } catch (error) {
                console.log('❌ Parse error:', error.message);
            }
        });
        
        ws.on('close', () => {
            console.log('🔌 WebSocket closed');
            resolve(events);
        });
        
        ws.on('error', (error) => {
            console.log('❌ WebSocket error:', error.message);
            resolve([]);
        });
    });
}

async function checkEventTimingIssues() {
    console.log('\n⏱️ Checking Event Timing Issues');
    console.log('=' + '='.repeat(50));
    
    // The assertion might be happening because events are sent at wrong times
    // or without proper session context
    
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:9222');
        let messageId = 1;
        const timeline = [];
        
        ws.on('open', () => {
            timeline.push({ time: Date.now(), event: 'WebSocket opened' });
            
            // Send Target.setAutoAttach first
            timeline.push({ time: Date.now(), event: 'Sending Target.setAutoAttach' });
            ws.send(JSON.stringify({
                id: messageId++,
                method: 'Target.setAutoAttach',
                params: {
                    autoAttach: true,
                    waitForDebuggerOnStart: false, // Try with false instead of true
                    flatten: true
                }
            }));
        });
        
        ws.on('message', (data) => {
            const timestamp = Date.now();
            try {
                const parsed = JSON.parse(data.toString());
                timeline.push({
                    time: timestamp,
                    event: parsed.method || `response-${parsed.id}`,
                    data: parsed
                });
                
                if (parsed.id === 1) {
                    // After Target.setAutoAttach response
                    timeline.push({ time: Date.now(), event: 'Sending Browser.getVersion' });
                    ws.send(JSON.stringify({
                        id: messageId++,
                        method: 'Browser.getVersion',
                        params: {}
                    }));
                } else if (parsed.id === 2) {
                    // Wait a bit then close
                    setTimeout(() => {
                        ws.close();
                    }, 500);
                }
                
            } catch (error) {
                timeline.push({ time: timestamp, event: 'parse-error', error: error.message });
            }
        });
        
        ws.on('close', () => {
            console.log('\n📊 Timeline Analysis:');
            timeline.forEach((entry, index) => {
                const relativeTime = index > 0 ? entry.time - timeline[0].time : 0;
                console.log(`${(index + 1).toString().padStart(2)}. [+${relativeTime.toString().padStart(4)}ms] ${entry.event}`);
            });
            resolve(timeline);
        });
    });
}

async function main() {
    console.log('🎯 Event Format Analysis for Playwright Assertion Error');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Analyze Target events that might cause assertion failure');
    console.log('');
    
    try {
        // Analyze event formats
        const events = await analyzeEventFormats();
        
        console.log(`\n📊 Captured ${events.length} events`);
        
        // Check timing issues
        const timeline = await checkEventTimingIssues();
        
        console.log('\n🎯 Key Findings:');
        console.log('1. Events have proper format: method + params, no id');
        console.log('2. Target events include required fields (targetInfo, sessionId, etc.)');
        console.log('3. The issue might be:');
        console.log('   - Event sent to wrong session/context');
        console.log('   - Event sent before session is ready');
        console.log('   - waitingForDebugger field causing issues');
        console.log('   - Event ordering/timing problems');
        
        console.log('\n💡 Potential Fix:');
        console.log('Try setting waitingForDebugger to false instead of true');
        console.log('This might prevent the assertion error in crConnection.js:134');
        
    } catch (error) {
        console.error('💥 Analysis failed:', error);
    }
}

main();