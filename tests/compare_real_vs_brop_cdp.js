#!/usr/bin/env node
/**
 * Compare Real CDP vs BROP CDP
 * 
 * Let's compare what a real Chrome CDP server sends vs what our BROP
 * implementation sends to understand the difference.
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');

async function testRealChromeNewPage() {
    console.log('🔍 Test Real Chrome newPage()');
    console.log('=' + '='.repeat(60));
    
    try {
        // This should work with real Chrome
        const browser = await chromium.launch({ headless: true });
        console.log('✅ Real Chrome browser launched');
        
        const context = await browser.newContext();
        console.log('✅ Real Chrome context created');
        
        const page = await context.newPage();
        console.log('✅ Real Chrome newPage() SUCCESS!');
        
        await page.goto('data:text/html,<h1>Real Chrome Test</h1>');
        console.log('✅ Real Chrome navigation works');
        
        await page.close();
        await context.close();
        await browser.close();
        
        return true;
        
    } catch (error) {
        console.log('❌ Real Chrome failed:', error.message);
        return false;
    }
}

async function interceptRealChromeMessages() {
    console.log('\n🔍 Intercept Real Chrome CDP Messages');
    console.log('=' + '='.repeat(60));
    
    // Launch Chrome with a specific debug port
    const { spawn } = require('child_process');
    
    console.log('🚀 Launching Chrome with CDP on port 9333...');
    const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
        '--headless',
        '--remote-debugging-port=9333',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage'
    ]);
    
    // Give Chrome time to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const messages = [];
    
    try {
        // Connect to real Chrome CDP
        const ws = new WebSocket('ws://localhost:9333');
        
        ws.on('open', () => {
            console.log('📡 Connected to real Chrome CDP');
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                messages.push(parsed);
                console.log(`📥 Real Chrome: ${parsed.method || `Response(${parsed.id})`}`);
                
                // Log important message details
                if (parsed.method === 'Target.targetCreated') {
                    console.log(`   Target created: ${parsed.params.targetInfo.targetId}`);
                } else if (parsed.method === 'Runtime.executionContextCreated') {
                    console.log(`   Execution context: ${parsed.params.context.id}`);
                } else if (parsed.id && parsed.result) {
                    console.log(`   Response result keys: ${Object.keys(parsed.result).join(', ')}`);
                }
                
            } catch (error) {
                console.log(`❌ Parse error: ${error.message}`);
            }
        });
        
        // Now test Playwright with real Chrome
        setTimeout(async () => {
            try {
                console.log('\n🎭 Testing Playwright with real Chrome...');
                const browser = await chromium.connectOverCDP('ws://localhost:9333');
                const context = await browser.newContext();
                const page = await context.newPage();
                console.log('✅ Real Chrome + Playwright newPage() works!');
                
                await page.close();
                await context.close();
                await browser.close();
                
            } catch (error) {
                console.log('❌ Real Chrome + Playwright failed:', error.message);
            }
            
            ws.close();
            chrome.kill();
        }, 2000);
        
        // Wait for completion
        await new Promise(resolve => {
            ws.on('close', () => {
                console.log('\n📊 Real Chrome Message Analysis:');
                console.log(`Captured ${messages.length} messages`);
                
                const events = messages.filter(m => m.method);
                const responses = messages.filter(m => m.id && !m.method);
                
                console.log(`Events: ${events.length}`);
                console.log(`Responses: ${responses.length}`);
                
                console.log('\nKey events:');
                events.forEach(e => {
                    if (['Target.targetCreated', 'Runtime.executionContextCreated', 'Page.frameNavigated'].includes(e.method)) {
                        console.log(`  ${e.method}`);
                    }
                });
                
                resolve();
            });
        });
        
    } catch (error) {
        console.log('❌ Real Chrome connection failed:', error.message);
        chrome.kill();
    }
}

async function compareBropMessages() {
    console.log('\n🔍 Compare BROP Messages');
    console.log('=' + '='.repeat(60));
    
    const bropMessages = [];
    
    try {
        const ws = new WebSocket('ws://localhost:9222');
        
        ws.on('open', () => {
            console.log('📡 Connected to BROP CDP');
            
            // Send the same commands that Playwright would send
            const commands = [
                { id: 1, method: 'Target.createTarget', params: { url: 'about:blank' } },
                { id: 2, method: 'Page.enable', params: {} },
                { id: 3, method: 'Runtime.enable', params: {} },
                { id: 4, method: 'Page.getFrameTree', params: {} }
            ];
            
            commands.forEach((cmd, index) => {
                setTimeout(() => {
                    console.log(`📤 BROP: Sending ${cmd.method}`);
                    ws.send(JSON.stringify(cmd));
                }, index * 500);
            });
        });
        
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                bropMessages.push(parsed);
                console.log(`📥 BROP: ${parsed.method || `Response(${parsed.id})`}`);
                
                if (parsed.id && parsed.result) {
                    console.log(`   Response result keys: ${Object.keys(parsed.result).join(', ')}`);
                }
                
            } catch (error) {
                console.log(`❌ Parse error: ${error.message}`);
            }
        });
        
        await new Promise(resolve => {
            setTimeout(() => {
                ws.close();
            }, 3000);
            
            ws.on('close', () => {
                console.log('\n📊 BROP Message Analysis:');
                console.log(`Captured ${bropMessages.length} messages`);
                
                const responses = bropMessages.filter(m => m.id && !m.method);
                console.log(`Responses: ${responses.length}`);
                
                responses.forEach(r => {
                    console.log(`  ID ${r.id}: ${Object.keys(r.result || {}).join(', ')}`);
                });
                
                resolve();
            });
        });
        
    } catch (error) {
        console.log('❌ BROP connection failed:', error.message);
    }
}

async function main() {
    console.log('🎯 Compare Real CDP vs BROP CDP');
    console.log('=' + '='.repeat(70));
    console.log('Goal: Find what BROP is missing compared to real Chrome CDP');
    console.log('');
    
    const realChromeWorks = await testRealChromeNewPage();
    console.log(`\nReal Chrome newPage(): ${realChromeWorks ? '✅ WORKS' : '❌ FAILS'}`);
    
    if (realChromeWorks) {
        await interceptRealChromeMessages();
        await compareBropMessages();
        
        console.log('\n🔧 Analysis:');
        console.log('Compare the messages above to see what BROP is missing:');
        console.log('1. Missing events (Target.targetCreated, Runtime.executionContextCreated)');
        console.log('2. Different response structure');
        console.log('3. Missing session or timing information');
        console.log('4. Incorrect frame/page relationships');
    }
}

main();