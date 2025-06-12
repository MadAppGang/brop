#!/usr/bin/env node
/**
 * Compare Connection Internals between working headless and BROP
 */

const { chromium } = require('playwright');

async function inspectConnection(connection, label) {
    console.log(`\n🔍 ${label} CONNECTION INSPECTION:`);
    console.log('-'.repeat(50));
    
    console.log('Connection type:', connection.constructor.name);
    console.log('Connection._url:', connection._url);
    console.log('Connection._transport exists:', !!connection._transport);
    console.log('Connection._sessions exists:', !!connection._sessions);
    console.log('Connection._onMessage exists:', typeof connection._onMessage);
    console.log('Connection._rootSession exists:', !!connection._rootSession);
    
    if (connection._transport) {
        console.log('Transport type:', connection._transport.constructor.name);
        console.log('Transport readyState:', connection._transport.readyState);
        console.log('Transport url:', connection._transport.url);
    }
    
    if (connection._sessions) {
        console.log('Sessions count:', Object.keys(connection._sessions).length);
        console.log('Session IDs:', Object.keys(connection._sessions));
    }
    
    if (connection._rootSession) {
        console.log('Root session exists:', true);
        console.log('Root session type:', connection._rootSession.constructor.name);
    }
    
    // Check available methods
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(connection));
    console.log('Available methods:', methods.slice(0, 10).join(', '), '...');
}

async function compareConnections() {
    console.log('🆚 COMPARING CONNECTION INTERNALS');
    console.log('=' + '='.repeat(70));
    
    console.log('\n1️⃣ Testing WORKING headless browser...');
    let workingBrowser = null;
    let workingContext = null;
    
    try {
        workingBrowser = await chromium.launch({ 
            headless: true,
            args: ['--disable-web-security']
        });
        workingContext = await workingBrowser.newContext();
        
        console.log('✅ Headless browser and context created successfully');
        
        // Inspect the working connection
        await inspectConnection(workingContext._connection, 'WORKING HEADLESS');
        await inspectConnection(workingBrowser._connection, 'WORKING BROWSER');
        
    } catch (error) {
        console.log('❌ Error with headless browser:', error.message);
    }
    
    console.log('\n2️⃣ Testing BROP connection...');
    let bropBrowser = null;
    let bropContext = null;
    
    try {
        bropBrowser = await chromium.connectOverCDP('ws://localhost:9222');
        bropContext = await bropBrowser.newContext();
        
        console.log('✅ BROP browser and context created successfully');
        
        // Inspect the BROP connection
        await inspectConnection(bropContext._connection, 'BROP CONTEXT');
        await inspectConnection(bropBrowser._connection, 'BROP BROWSER');
        
    } catch (error) {
        console.log('❌ Error with BROP connection:', error.message);
    }
    
    console.log('\n3️⃣ COMPARISON ANALYSIS:');
    console.log('=' + '='.repeat(50));
    
    if (workingContext && bropContext) {
        const workingHasTransport = !!workingContext._connection._transport;
        const bropHasTransport = !!bropContext._connection._transport;
        
        const workingHasSessions = !!workingContext._connection._sessions;
        const bropHasSessions = !!bropContext._connection._sessions;
        
        console.log(`Working transport: ${workingHasTransport}, BROP transport: ${bropHasTransport}`);
        console.log(`Working sessions: ${workingHasSessions}, BROP sessions: ${bropHasSessions}`);
        
        if (workingHasTransport && !bropHasTransport) {
            console.log('🔍 KEY DIFFERENCE: BROP missing transport connection!');
            console.log('   This is likely why page creation fails.');
        }
        
        if (workingHasSessions && !bropHasSessions) {
            console.log('🔍 KEY DIFFERENCE: BROP missing sessions object!');
            console.log('   This prevents proper CDP session management.');
        }
    }
    
    // Cleanup
    if (workingContext) await workingContext.close();
    if (workingBrowser) await workingBrowser.close();
    if (bropContext) await bropContext.close();
    if (bropBrowser) await bropBrowser.close();
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. The BROP bridge server needs to provide a proper transport connection');
    console.log('2. Session management (_sessions) needs to be initialized');
    console.log('3. Root session might need to be established during connectOverCDP');
}

if (require.main === module) {
    compareConnections().catch(console.error);
}