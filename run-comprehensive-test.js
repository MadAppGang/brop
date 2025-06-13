#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ComprehensiveTestRunner {
    constructor() {
        this.results = {};
        this.testCategories = {
            'Integration Tests': '/Users/jack/mag/mcp-brop/tests/integration/',
            'Console Tests': '/Users/jack/mag/mcp-brop/tests/console/',
            'DOM Tests': '/Users/jack/mag/mcp-brop/tests/dom/',
            'Debug Tests': '/Users/jack/mag/mcp-brop/tests/debug/',
            'Popup Tests': '/Users/jack/mag/mcp-brop/tests/popup/',
            'Root Tests': '/Users/jack/mag/mcp-brop/tests/'
        };
        this.rootTestFiles = [
            'test-basic-functionality.js',
            'comprehensive_brop_protocol_tests.js',
            'brop_protobuf_tests.js',
            'test-session-cleanup.js',
            'test-tab-close-notifications.js',
            'test-wikipedia-extract.js',
            'test_bridge_connection.js',
            'working_brop_test.js'
        ];
    }

    async runTest(testPath, testName) {
        return new Promise((resolve) => {
            console.log(`\n🧪 Running: ${testName}`);
            console.log(`📁 Path: ${testPath}`);
            
            const child = spawn('node', [testPath], {
                stdio: 'pipe',
                cwd: '/Users/jack/mag/mcp-brop'
            });

            let stdout = '';
            let stderr = '';
            let startTime = Date.now();

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                const duration = Date.now() - startTime;
                const output = stdout + stderr;
                
                // Analyze output for specific error types
                const invalidCommandErrors = (output.match(/Invalid command: missing method/g) || []).length;
                const tabIdErrors = (output.match(/tabId.*null|undefined.*tabId|Invalid tabId/gi) || []).length;
                const connectionErrors = (output.match(/connection.*failed|failed.*connect/gi) || []).length;
                
                const result = {
                    testName,
                    testPath,
                    exitCode: code,
                    duration,
                    output,
                    stdout,
                    stderr,
                    analysis: {
                        invalidCommandErrors,
                        tabIdErrors,
                        connectionErrors,
                        passed: code === 0,
                        hasOutput: output.length > 0
                    }
                };

                console.log(`${result.analysis.passed ? '✅' : '❌'} ${testName} - Exit Code: ${code} - Duration: ${duration}ms`);
                if (invalidCommandErrors > 0) {
                    console.log(`   ⚠️  Invalid Command Errors: ${invalidCommandErrors}`);
                }
                if (tabIdErrors > 0) {
                    console.log(`   🔗 TabId Errors: ${tabIdErrors}`);
                }
                if (connectionErrors > 0) {
                    console.log(`   🔌 Connection Errors: ${connectionErrors}`);
                }

                resolve(result);
            });

            // Set timeout for long-running tests
            setTimeout(() => {
                child.kill('SIGTERM');
                resolve({
                    testName,
                    testPath,
                    exitCode: -1,
                    duration: 30000,
                    output: 'Test timed out after 30 seconds',
                    analysis: {
                        invalidCommandErrors: 0,
                        tabIdErrors: 0,
                        connectionErrors: 0,
                        passed: false,
                        hasOutput: false,
                        timedOut: true
                    }
                });
            }, 30000);
        });
    }

    async runTestsInDirectory(directory, categoryName) {
        console.log(`\n📂 Running ${categoryName} in ${directory}`);
        
        if (!fs.existsSync(directory)) {
            console.log(`❌ Directory not found: ${directory}`);
            return [];
        }

        const files = fs.readdirSync(directory)
            .filter(file => file.endsWith('.js'))
            .filter(file => {
                // Skip root level files when in root directory tests
                if (categoryName === 'Root Tests') {
                    return this.rootTestFiles.includes(file);
                }
                return true;
            });

        const results = [];
        for (const file of files) {
            const testPath = path.join(directory, file);
            const result = await this.runTest(testPath, file);
            results.push(result);
        }

        return results;
    }

    generateReport(allResults) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                totalInvalidCommandErrors: 0,
                totalTabIdErrors: 0,
                totalConnectionErrors: 0,
                timedOutTests: 0
            },
            categories: {},
            detailedResults: allResults
        };

        Object.keys(allResults).forEach(category => {
            const categoryResults = allResults[category];
            const categoryStats = {
                totalTests: categoryResults.length,
                passedTests: categoryResults.filter(r => r.analysis.passed).length,
                failedTests: categoryResults.filter(r => !r.analysis.passed).length,
                invalidCommandErrors: categoryResults.reduce((sum, r) => sum + r.analysis.invalidCommandErrors, 0),
                tabIdErrors: categoryResults.reduce((sum, r) => sum + r.analysis.tabIdErrors, 0),
                connectionErrors: categoryResults.reduce((sum, r) => sum + r.analysis.connectionErrors, 0),
                timedOutTests: categoryResults.filter(r => r.analysis.timedOut).length
            };

            report.categories[category] = categoryStats;
            report.summary.totalTests += categoryStats.totalTests;
            report.summary.passedTests += categoryStats.passedTests;
            report.summary.failedTests += categoryStats.failedTests;
            report.summary.totalInvalidCommandErrors += categoryStats.invalidCommandErrors;
            report.summary.totalTabIdErrors += categoryStats.tabIdErrors;
            report.summary.totalConnectionErrors += categoryStats.connectionErrors;
            report.summary.timedOutTests += categoryStats.timedOutTests;
        });

        return report;
    }

    printSummaryReport(report) {
        console.log('\n' + '='.repeat(80));
        console.log('🧪 COMPREHENSIVE TEST RESULTS SUMMARY');
        console.log('='.repeat(80));
        
        console.log(`\n📊 OVERALL STATISTICS:`);
        console.log(`   Total Tests: ${report.summary.totalTests}`);
        console.log(`   ✅ Passed: ${report.summary.passedTests}`);
        console.log(`   ❌ Failed: ${report.summary.failedTests}`);
        console.log(`   ⏰ Timed Out: ${report.summary.timedOutTests}`);
        console.log(`   📈 Success Rate: ${((report.summary.passedTests / report.summary.totalTests) * 100).toFixed(1)}%`);

        console.log(`\n🔍 ERROR ANALYSIS:`);
        console.log(`   ⚠️  Invalid Command Errors: ${report.summary.totalInvalidCommandErrors} (SHOULD BE 0 AFTER FIXES)`);
        console.log(`   🔗 TabId Errors: ${report.summary.totalTabIdErrors} (Expected for tests without proper tab management)`);
        console.log(`   🔌 Connection Errors: ${report.summary.totalConnectionErrors}`);

        console.log(`\n📂 CATEGORY BREAKDOWN:`);
        Object.keys(report.categories).forEach(category => {
            const stats = report.categories[category];
            console.log(`\n   ${category}:`);
            console.log(`     Tests: ${stats.totalTests} | Passed: ${stats.passedTests} | Failed: ${stats.failedTests}`);
            console.log(`     Invalid Command Errors: ${stats.invalidCommandErrors}`);
            console.log(`     TabId Errors: ${stats.tabIdErrors}`);
            console.log(`     Connection Errors: ${stats.connectionErrors}`);
        });

        if (report.summary.totalInvalidCommandErrors === 0) {
            console.log(`\n🎉 SUCCESS: No "Invalid command: missing method" errors found!`);
            console.log(`   Command structure fixes are working correctly.`);
        } else {
            console.log(`\n⚠️  WARNING: Found ${report.summary.totalInvalidCommandErrors} "Invalid command: missing method" errors`);
            console.log(`   Some tests may still need command structure fixes.`);
        }
    }

    async runAllTests() {
        console.log('🚀 Starting Comprehensive Test Suite');
        console.log('📋 Testing command structure fixes: command: { type: ... } → method: ..., params: { ... }');
        
        const allResults = {};

        for (const [categoryName, directory] of Object.entries(this.testCategories)) {
            const results = await this.runTestsInDirectory(directory, categoryName);
            allResults[categoryName] = results;
        }

        const report = this.generateReport(allResults);
        
        // Save detailed report
        const reportPath = `/Users/jack/mag/mcp-brop/comprehensive-test-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n💾 Detailed report saved to: ${reportPath}`);

        this.printSummaryReport(report);

        return report;
    }
}

// Run the comprehensive test suite
if (require.main === module) {
    const runner = new ComprehensiveTestRunner();
    runner.runAllTests().catch(console.error);
}

module.exports = ComprehensiveTestRunner;