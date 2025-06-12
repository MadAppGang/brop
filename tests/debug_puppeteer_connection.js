#!/usr/bin/env node
/**
 * Debug Puppeteer Connection
 * 
 * Detailed debugging to see exactly what Puppeteer is doing
 */

const puppeteer = require('puppeteer');
const WebSocket = require('ws');

// Intercept WebSocket traffic
const originalWebSocket = WebSocket;
global.WebSocket = class extends originalWebSocket {
    constructor(url, protocols) {
        console.log(`🔌 Puppeteer creating WebSocket connection to: ${url}`);
        super(url, protocols);
        
        const originalSend = this.send;
        this.send = function(data) {
            console.log(`📤 PUPPETEER SEND: ${data}`);
            return originalSend.call(this, data);
        };
        
        this.addEventListener('message', (event) => {
            console.log(`📥 PUPPETEER RECV: ${event.data}`);
        });
        
        this.addEventListener('open', () => {
            console.log('✅ Puppeteer WebSocket connection opened');
        });
        
        this.addEventListener('error', (error) => {
            console.log('❌ Puppeteer WebSocket error:', error.message);
        });
        
        this.addEventListener('close', (event) => {
            console.log(`🔌 Puppeteer WebSocket closed: ${event.code} ${event.reason}`);
        });
    }
};

async function debugPuppeteerConnection() {
    console.log('🔍 DEBUGGING PUPPETEER CONNECTION');
    console.log('=' + '='.repeat(60));
    
    try {
        console.log('\n1️⃣ Attempting Puppeteer connection...');
        
        const browser = await puppeteer.connect({
            browserWSEndpoint: 'ws://localhost:9222',
            defaultViewport: null,
            slowMo: 100, // Add delay to see what's happening
        });
        
        console.log('✅ Puppeteer connected successfully!');
        
        console.log('\n2️⃣ Getting browser info...');
        const version = await browser.version();
        console.log(`Browser version: ${version}`);
        
        console.log('\n3️⃣ Listing existing pages...');
        const pages = await browser.pages();
        console.log(`Found ${pages.length} existing pages`);
        
        console.log('\n4️⃣ Creating new page...');
        const page = await browser.newPage();
        console.log('✅ Page created successfully!');
        
        console.log('\n5️⃣ Testing page navigation...');
        await page.goto('data:text/html,<h1>Hello BROP!</h1>');
        
        const title = await page.title();
        console.log(`Page title: "${title}"`);
        
        const content = await page.content();
        console.log(`Page content length: ${content.length}`);
        
        console.log('\n6️⃣ Testing page evaluation...');
        const result = await page.evaluate(() => {
            return {
                userAgent: navigator.userAgent,
                url: window.location.href,
                title: document.title
            };
        });
        console.log('Page evaluation result:', result);
        
        console.log('\n7️⃣ Cleanup...');
        await page.close();
        await browser.disconnect();
        
        console.log('🎉 All tests passed successfully!');
        return true;
        
    } catch (error) {
        console.error('\n❌ Error occurred:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

if (require.main === module) {
    debugPuppeteerConnection().catch(console.error);
}