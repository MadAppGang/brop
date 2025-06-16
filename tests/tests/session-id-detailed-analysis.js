import fs from 'fs';
import readline from 'readline';

async function analyzeResponsesWithSessionId(filename) {
    const fileStream = fs.createReadStream(filename);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const responsesWithSession = [];
    const responsesWithoutSession = [];
    const eventsWithSession = [];
    const eventsWithoutSession = [];
    let lineCount = 0;

    for await (const line of rl) {
        lineCount++;
        try {
            const entry = JSON.parse(line);
            const cdpData = entry.cdp_data;
            
            // Check responses (has id and result)
            if (cdpData.id !== undefined && cdpData.result !== undefined) {
                if (cdpData.sessionId) {
                    responsesWithSession.push({
                        line: lineCount,
                        id: cdpData.id,
                        sessionId: cdpData.sessionId,
                        hasEmptyResult: Object.keys(cdpData.result).length === 0
                    });
                } else {
                    responsesWithoutSession.push({
                        line: lineCount,
                        id: cdpData.id,
                        hasEmptyResult: Object.keys(cdpData.result).length === 0
                    });
                }
            }
            
            // Check events (has method but no id)
            if (cdpData.method && cdpData.id === undefined) {
                if (cdpData.sessionId) {
                    eventsWithSession.push({
                        line: lineCount,
                        method: cdpData.method,
                        sessionId: cdpData.sessionId
                    });
                } else {
                    eventsWithoutSession.push({
                        line: lineCount,
                        method: cdpData.method
                    });
                }
            }
        } catch (e) {
            // Skip parse errors
        }
    }

    return {
        filename,
        responsesWithSession,
        responsesWithoutSession,
        eventsWithSession,
        eventsWithoutSession
    };
}

async function main() {
    console.log('Detailed Session ID Analysis\n');
    
    const nativeAnalysis = await analyzeResponsesWithSessionId('/Users/jack/mag/mcp-brop/reports/cdp_dump_native.jsonl');
    const bridgeAnalysis = await analyzeResponsesWithSessionId('/Users/jack/mag/mcp-brop/reports/cdp_dump_bridge.jsonl');
    
    console.log('=== NATIVE CHROME ===');
    console.log(`Responses WITH sessionId: ${nativeAnalysis.responsesWithSession.length}`);
    console.log(`Responses WITHOUT sessionId: ${nativeAnalysis.responsesWithoutSession.length}`);
    console.log(`Events WITH sessionId: ${nativeAnalysis.eventsWithSession.length}`);
    console.log(`Events WITHOUT sessionId: ${nativeAnalysis.eventsWithoutSession.length}`);
    
    console.log('\nFirst 5 responses with sessionId:');
    nativeAnalysis.responsesWithSession.slice(0, 5).forEach(r => {
        console.log(`  Line ${r.line}: id=${r.id}, sessionId=${r.sessionId}, empty=${r.hasEmptyResult}`);
    });
    
    console.log('\nFirst 5 responses without sessionId:');
    nativeAnalysis.responsesWithoutSession.slice(0, 5).forEach(r => {
        console.log(`  Line ${r.line}: id=${r.id}, empty=${r.hasEmptyResult}`);
    });
    
    console.log('\n=== BRIDGE ===');
    console.log(`Responses WITH sessionId: ${bridgeAnalysis.responsesWithSession.length}`);
    console.log(`Responses WITHOUT sessionId: ${bridgeAnalysis.responsesWithoutSession.length}`);
    console.log(`Events WITH sessionId: ${bridgeAnalysis.eventsWithSession.length}`);
    console.log(`Events WITHOUT sessionId: ${bridgeAnalysis.eventsWithoutSession.length}`);
    
    console.log('\nFirst 5 responses with sessionId:');
    bridgeAnalysis.responsesWithSession.slice(0, 5).forEach(r => {
        console.log(`  Line ${r.line}: id=${r.id}, sessionId=${r.sessionId}, empty=${r.hasEmptyResult}`);
    });
    
    console.log('\nFirst 5 responses without sessionId:');
    bridgeAnalysis.responsesWithoutSession.slice(0, 5).forEach(r => {
        console.log(`  Line ${r.line}: id=${r.id}, empty=${r.hasEmptyResult}`);
    });
    
    console.log('\n=== KEY FINDING ===');
    console.log('Native Chrome includes sessionId in responses to commands that had sessionId.');
    console.log('The bridge is NOT including sessionId in its responses.');
    console.log('\nThis is likely why Playwright fails - it expects responses to maintain sessionId.');
}

main().catch(console.error);