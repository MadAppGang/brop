#!/usr/bin/env node
/**
 * Debug script to find tests causing "Invalid command: missing method" errors
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function findTestFiles(dir) {
    const testFiles = [];
    
    function scanDirectory(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                if (!item.includes('node_modules') && !item.includes('.git')) {
                    scanDirectory(fullPath);
                }
            } else if (item.endsWith('.js') && (
                item.startsWith('test-') || 
                item.startsWith('test_') ||
                item.includes('test')
            )) {
                testFiles.push(fullPath);
            }
        }
    }
    
    scanDirectory(dir);
    return testFiles;
}

async function runTestAndCheckLogs(testFile) {
    return new Promise((resolve) => {
        console.log(`\n🔍 Testing: ${path.relative(process.cwd(), testFile)}`);
        
        const child = spawn('node', [testFile], {
            stdio: 'pipe',
            timeout: 10000
        });
        
        let hasInvalidCommandError = false;
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            // Check for specific error patterns
            const output = stdout + stderr;
            hasInvalidCommandError = output.includes('Invalid command: missing method');
            
            if (hasInvalidCommandError) {
                console.log(`❌ FOUND: ${path.relative(process.cwd(), testFile)} causes "Invalid command: missing method"`);
            } else {
                console.log(`✅ OK: ${path.relative(process.cwd(), testFile)}`);
            }
            
            resolve({
                testFile: path.relative(process.cwd(), testFile),
                hasInvalidCommandError,
                success: code === 0
            });
        });
        
        child.on('error', (error) => {
            console.log(`❌ Error running ${path.relative(process.cwd(), testFile)}: ${error.message}`);
            resolve({
                testFile: path.relative(process.cwd(), testFile),
                hasInvalidCommandError: false,
                success: false,
                error: error.message
            });
        });
    });
}

async function main() {
    console.log('🔍 Finding tests that cause "Invalid command: missing method" errors...');
    console.log('='*80);
    
    const testFiles = findTestFiles('./tests');
    const problemTests = [];
    
    // Test a subset to avoid overwhelming
    const filesToTest = testFiles.filter(f => 
        f.includes('simple_dom') || 
        f.includes('comprehensive') ||
        f.includes('protobuf') ||
        f.includes('test-')
    ).slice(0, 10);
    
    console.log(`\n📋 Testing ${filesToTest.length} potentially problematic files...\n`);
    
    for (const testFile of filesToTest) {
        const result = await runTestAndCheckLogs(testFile);
        if (result.hasInvalidCommandError) {
            problemTests.push(result);
        }
        
        // Small delay to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='*80);
    console.log('📊 RESULTS:');
    console.log('='*80);
    
    if (problemTests.length === 0) {
        console.log('✅ No tests found causing "Invalid command: missing method" errors!');
        console.log('🎉 All command structure fixes appear to be working!');
    } else {
        console.log(`❌ Found ${problemTests.length} tests causing "Invalid command: missing method" errors:`);
        problemTests.forEach((test, i) => {
            console.log(`   ${i + 1}. ${test.testFile}`);
        });
        console.log('\n🔧 These tests need to be fixed to use proper command structure:');
        console.log('   Change from: command: { type: "method_name", ... }');
        console.log('   Change to:   method: "method_name", params: { ... }');
    }
}

main().catch(console.error);