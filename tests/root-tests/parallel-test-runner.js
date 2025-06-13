#!/usr/bin/env node
/**
 * Parallel Test Runner for BROP Test Suite
 * Runs tests in parallel with configurable concurrency
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ParallelTestRunner {
    constructor(concurrency = 5) {
        this.concurrency = concurrency;
        this.running = new Set();
        this.queue = [];
        this.results = [];
        this.startTime = Date.now();
    }

    // Find all test files recursively
    findTestFiles(dir) {
        const testFiles = [];
        
        function scanDirectory(currentDir) {
            const items = fs.readdirSync(currentDir);
            
            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    // Skip node_modules and other non-test directories
                    if (!item.includes('node_modules') && !item.includes('.git')) {
                        scanDirectory(fullPath);
                    }
                } else if (item.endsWith('.js') && (
                    item.startsWith('test-') || 
                    item.startsWith('test_') ||
                    item.includes('test') ||
                    item.startsWith('debug-') ||
                    item.startsWith('verify-') ||
                    item.startsWith('get-')
                )) {
                    testFiles.push(fullPath);
                }
            }
        }
        
        scanDirectory(dir);
        return testFiles;
    }

    // Run a single test
    runTest(testFile) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const testName = path.relative(process.cwd(), testFile);
            
            console.log(`🚀 Starting: ${testName}`);
            
            const child = spawn('node', [testFile], {
                stdio: 'pipe',
                timeout: 30000 // 30 second timeout per test
            });
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            child.on('close', (code) => {
                const duration = Date.now() - startTime;
                const success = code === 0;
                
                const result = {
                    testFile: testName,
                    success,
                    code,
                    duration,
                    stdout,
                    stderr,
                    hasInvalidCommandError: stdout.includes('Invalid command: missing method') || stderr.includes('Invalid command: missing method'),
                    hasTabIdError: stdout.includes('tabId is required') || stderr.includes('tabId is required'),
                    hasTimeoutError: stdout.includes('timeout') || stderr.includes('timeout'),
                    hasConnectionError: stdout.includes('Connection error') || stderr.includes('Connection error')
                };
                
                const status = success ? '✅' : '❌';
                const timeStr = `${duration}ms`;
                console.log(`${status} Completed: ${testName} (${timeStr})`);
                
                resolve(result);
            });
            
            child.on('error', (error) => {
                const duration = Date.now() - startTime;
                const result = {
                    testFile: testName,
                    success: false,
                    code: -1,
                    duration,
                    stdout: '',
                    stderr: error.message,
                    error: error.message,
                    hasInvalidCommandError: false,
                    hasTabIdError: false,
                    hasTimeoutError: false,
                    hasConnectionError: true
                };
                
                console.log(`❌ Error: ${testName} (${duration}ms) - ${error.message}`);
                resolve(result);
            });
        });
    }

    // Process the test queue
    async processQueue() {
        while (this.queue.length > 0 || this.running.size > 0) {
            // Start new tests up to concurrency limit
            while (this.running.size < this.concurrency && this.queue.length > 0) {
                const testFile = this.queue.shift();
                const testPromise = this.runTest(testFile);
                
                this.running.add(testPromise);
                
                // When test completes, remove from running set and add to results
                testPromise.then((result) => {
                    this.results.push(result);
                    this.running.delete(testPromise);
                });
            }
            
            // Wait for at least one test to complete
            if (this.running.size > 0) {
                await Promise.race(Array.from(this.running));
            }
        }
    }

    // Generate comprehensive report
    generateReport() {
        const totalTime = Date.now() - this.startTime;
        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        
        // Error categorization
        const invalidCommandErrors = this.results.filter(r => r.hasInvalidCommandError).length;
        const tabIdErrors = this.results.filter(r => r.hasTabIdError).length;
        const timeoutErrors = this.results.filter(r => r.hasTimeoutError).length;
        const connectionErrors = this.results.filter(r => r.hasConnectionError).length;
        
        console.log('\n' + '='.repeat(80));
        console.log('🧪 PARALLEL TEST EXECUTION REPORT');
        console.log('='.repeat(80));
        console.log(`📊 Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests} (${Math.round(passedTests/totalTests*100)}%)`);
        console.log(`❌ Failed: ${failedTests} (${Math.round(failedTests/totalTests*100)}%)`);
        console.log(`⏱️  Total Time: ${(totalTime/1000).toFixed(1)}s`);
        console.log(`🔀 Concurrency: ${this.concurrency} parallel executions`);
        console.log(`⚡ Average: ${(totalTime/totalTests).toFixed(0)}ms per test`);
        
        console.log('\n📋 ERROR ANALYSIS:');
        console.log(`❌ Invalid Command Errors: ${invalidCommandErrors} (should be 0 after fixes)`);
        console.log(`⚠️  TabId Required Errors: ${tabIdErrors} (expected for tests without tab management)`);
        console.log(`⏰ Timeout Errors: ${timeoutErrors}`);
        console.log(`🔌 Connection Errors: ${connectionErrors}`);
        
        // Top 10 fastest tests
        const fastestTests = [...this.results]
            .filter(r => r.success)
            .sort((a, b) => a.duration - b.duration)
            .slice(0, 5);
        
        console.log('\n🏆 FASTEST SUCCESSFUL TESTS:');
        fastestTests.forEach((test, i) => {
            console.log(`   ${i + 1}. ${test.testFile} (${test.duration}ms)`);
        });
        
        // Tests with invalid command errors (should be empty now)
        const invalidCommandTests = this.results.filter(r => r.hasInvalidCommandError);
        if (invalidCommandTests.length > 0) {
            console.log('\n❌ TESTS WITH INVALID COMMAND ERRORS:');
            invalidCommandTests.forEach(test => {
                console.log(`   - ${test.testFile}`);
            });
        } else {
            console.log('\n✅ NO INVALID COMMAND ERRORS FOUND! Command structure fixes successful!');
        }
        
        // Failed tests breakdown
        const failedTestsList = this.results.filter(r => !r.success);
        if (failedTestsList.length > 0) {
            console.log('\n❌ FAILED TESTS BREAKDOWN:');
            
            // Group by error type
            const byErrorType = {
                tabId: failedTestsList.filter(r => r.hasTabIdError),
                timeout: failedTestsList.filter(r => r.hasTimeoutError),
                connection: failedTestsList.filter(r => r.hasConnectionError),
                other: failedTestsList.filter(r => !r.hasTabIdError && !r.hasTimeoutError && !r.hasConnectionError)
            };
            
            console.log(`📝 TabId Required (${byErrorType.tabId.length}): Expected - tests need proper tab management`);
            byErrorType.tabId.slice(0, 3).forEach(test => {
                console.log(`   - ${test.testFile}`);
            });
            
            console.log(`⏰ Timeouts (${byErrorType.timeout.length}): Tests taking too long`);
            byErrorType.timeout.slice(0, 3).forEach(test => {
                console.log(`   - ${test.testFile}`);
            });
            
            console.log(`🔌 Connection Issues (${byErrorType.connection.length}): Bridge/network problems`);
            byErrorType.connection.slice(0, 3).forEach(test => {
                console.log(`   - ${test.testFile}`);
            });
            
            console.log(`❓ Other Errors (${byErrorType.other.length}): Needs investigation`);
            byErrorType.other.slice(0, 3).forEach(test => {
                console.log(`   - ${test.testFile}`);
            });
        }
        
        // Save detailed report
        const reportData = {
            timestamp: Date.now(),
            summary: {
                totalTests,
                passedTests,
                failedTests,
                successRate: Math.round(passedTests/totalTests*100),
                totalTimeMs: totalTime,
                concurrency: this.concurrency
            },
            errorAnalysis: {
                invalidCommandErrors,
                tabIdErrors,
                timeoutErrors,
                connectionErrors
            },
            results: this.results.map(r => ({
                testFile: r.testFile,
                success: r.success,
                duration: r.duration,
                errorTypes: {
                    invalidCommand: r.hasInvalidCommandError,
                    tabId: r.hasTabIdError,
                    timeout: r.hasTimeoutError,
                    connection: r.hasConnectionError
                }
            }))
        };
        
        const reportPath = `parallel-test-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`\n💾 Detailed report saved to: ${reportPath}`);
        
        return reportData;
    }

    // Main execution method
    async runAllTests() {
        console.log('🔍 Finding all test files...');
        const testFiles = this.findTestFiles('./tests');
        
        console.log(`📋 Found ${testFiles.length} test files`);
        console.log(`🔀 Running with ${this.concurrency} parallel executions\n`);
        
        // Add all tests to queue
        this.queue = [...testFiles];
        
        // Process the queue
        await this.processQueue();
        
        // Generate and display report
        return this.generateReport();
    }
}

// Main execution
async function main() {
    const concurrency = process.argv[2] ? parseInt(process.argv[2]) : 5;
    
    console.log('🧪 BROP Parallel Test Runner');
    console.log(`🔀 Concurrency Level: ${concurrency}`);
    console.log('=' + '='.repeat(50));
    
    const runner = new ParallelTestRunner(concurrency);
    
    try {
        await runner.runAllTests();
        console.log('\n🎉 All tests completed!');
    } catch (error) {
        console.error('❌ Test runner error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = ParallelTestRunner;