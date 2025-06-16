import fs from 'fs';
import readline from 'readline';

async function analyzeSessionIds(filename) {
    const fileStream = fs.createReadStream(filename);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const sessionIds = new Set();
    const sessionIdUsage = {};
    const targetAttachedEvents = [];
    const commandsWithSession = [];
    const responsesWithSession = [];
    let lineCount = 0;

    for await (const line of rl) {
        lineCount++;
        try {
            const entry = JSON.parse(line);
            const cdpData = entry.cdp_data;
            
            // Track Target.attachedToTarget events
            if (cdpData.method === 'Target.attachedToTarget') {
                targetAttachedEvents.push({
                    line: lineCount,
                    sessionId: cdpData.params?.sessionId,
                    targetId: cdpData.params?.targetInfo?.targetId,
                    type: cdpData.params?.targetInfo?.type
                });
                if (cdpData.params?.sessionId) {
                    sessionIds.add(cdpData.params.sessionId);
                }
            }
            
            // Track commands with sessionId
            if (cdpData.id && cdpData.sessionId) {
                commandsWithSession.push({
                    line: lineCount,
                    id: cdpData.id,
                    method: cdpData.method,
                    sessionId: cdpData.sessionId
                });
                sessionIds.add(cdpData.sessionId);
                sessionIdUsage[cdpData.sessionId] = (sessionIdUsage[cdpData.sessionId] || 0) + 1;
            }
            
            // Track responses with sessionId
            if (cdpData.result !== undefined && cdpData.sessionId) {
                responsesWithSession.push({
                    line: lineCount,
                    id: cdpData.id,
                    sessionId: cdpData.sessionId
                });
            }
            
            // Track events with sessionId
            if (cdpData.method && !cdpData.id && cdpData.sessionId) {
                sessionIdUsage[cdpData.sessionId] = (sessionIdUsage[cdpData.sessionId] || 0) + 1;
            }
        } catch (e) {
            console.error(`Error parsing line ${lineCount}: ${e.message}`);
        }
    }

    return {
        filename,
        totalLines: lineCount,
        uniqueSessionIds: Array.from(sessionIds),
        sessionIdCount: sessionIds.size,
        sessionIdUsage,
        targetAttachedEvents,
        commandsWithSessionSample: commandsWithSession.slice(0, 10),
        responsesWithSessionSample: responsesWithSession.slice(0, 10),
        totalCommandsWithSession: commandsWithSession.length,
        totalResponsesWithSession: responsesWithSession.length
    };
}

async function main() {
    console.log('Analyzing CDP dumps for session ID handling...\n');
    
    const nativeAnalysis = await analyzeSessionIds('/Users/jack/mag/mcp-brop/reports/cdp_dump_native.jsonl');
    const bridgeAnalysis = await analyzeSessionIds('/Users/jack/mag/mcp-brop/reports/cdp_dump_bridge.jsonl');
    
    console.log('=== NATIVE CHROME CDP ===');
    console.log(`Total lines: ${nativeAnalysis.totalLines}`);
    console.log(`Unique session IDs: ${nativeAnalysis.sessionIdCount}`);
    console.log(`Session IDs: ${nativeAnalysis.uniqueSessionIds.join(', ')}`);
    console.log(`\nTarget.attachedToTarget events:`);
    nativeAnalysis.targetAttachedEvents.forEach(e => {
        console.log(`  Line ${e.line}: sessionId=${e.sessionId}, targetId=${e.targetId}, type=${e.type}`);
    });
    console.log(`\nCommands with sessionId: ${nativeAnalysis.totalCommandsWithSession}`);
    console.log('Sample:');
    nativeAnalysis.commandsWithSessionSample.forEach(c => {
        console.log(`  Line ${c.line}: ${c.method} (id=${c.id}, sessionId=${c.sessionId})`);
    });
    console.log(`\nResponses with sessionId: ${nativeAnalysis.totalResponsesWithSession}`);
    
    console.log('\n=== BRIDGE CDP ===');
    console.log(`Total lines: ${bridgeAnalysis.totalLines}`);
    console.log(`Unique session IDs: ${bridgeAnalysis.sessionIdCount}`);
    console.log(`Session IDs: ${bridgeAnalysis.uniqueSessionIds.join(', ')}`);
    console.log(`\nTarget.attachedToTarget events:`);
    bridgeAnalysis.targetAttachedEvents.forEach(e => {
        console.log(`  Line ${e.line}: sessionId=${e.sessionId}, targetId=${e.targetId}, type=${e.type}`);
    });
    console.log(`\nCommands with sessionId: ${bridgeAnalysis.totalCommandsWithSession}`);
    console.log('Sample:');
    bridgeAnalysis.commandsWithSessionSample.forEach(c => {
        console.log(`  Line ${c.line}: ${c.method} (id=${c.id}, sessionId=${c.sessionId})`);
    });
    console.log(`\nResponses with sessionId: ${bridgeAnalysis.totalResponsesWithSession}`);
    
    console.log('\n=== KEY DIFFERENCES ===');
    console.log(`1. Session ID format:`);
    console.log(`   Native: ${nativeAnalysis.uniqueSessionIds[0] || 'N/A'}`);
    console.log(`   Bridge: ${bridgeAnalysis.uniqueSessionIds[0] || 'N/A'}`);
    
    console.log(`\n2. Responses with sessionId:`);
    console.log(`   Native: ${nativeAnalysis.totalResponsesWithSession} responses include sessionId`);
    console.log(`   Bridge: ${bridgeAnalysis.totalResponsesWithSession} responses include sessionId`);
    
    console.log(`\n3. Session ID usage count:`);
    console.log('   Native:');
    Object.entries(nativeAnalysis.sessionIdUsage).forEach(([id, count]) => {
        console.log(`     ${id}: ${count} times`);
    });
    console.log('   Bridge:');
    Object.entries(bridgeAnalysis.sessionIdUsage).forEach(([id, count]) => {
        console.log(`     ${id}: ${count} times`);
    });
}

main().catch(console.error);