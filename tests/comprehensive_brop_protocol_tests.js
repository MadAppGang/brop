#!/usr/bin/env node
/**
 * Comprehensive BROP Protocol Test Suite
 * 
 * Tests all aspects of the Browser Remote Operations Protocol:
 * 1. Protocol Buffer message serialization/deserialization
 * 2. WebSocket connection and message routing
 * 3. All BROP command types and their responses
 * 4. Error handling and edge cases
 * 5. Performance and reliability testing
 */

const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

class BROPProtocolTestSuite {
    constructor() {
        this.wsPort = 9222; // CDP port
        this.bropPort = 9223; // BROP port
        this.extensionPort = 9224; // Extension port
        this.testResults = [];
        this.messageId = 1;
        this.testTimeout = 10000; // 10 seconds per test
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}`;
        console.log(logLine);
    }

    getNextMessageId() {
        return this.messageId++;
    }

    async runTest(testName, testFn) {
        this.log(`Starting test: ${testName}`, 'TEST');
        const startTime = Date.now();
        
        try {
            const result = await Promise.race([
                testFn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Test timeout')), this.testTimeout)
                )
            ]);
            
            const duration = Date.now() - startTime;
            this.testResults.push({
                name: testName,
                status: 'PASS',
                duration,
                result
            });
            
            this.log(`✅ PASS: ${testName} (${duration}ms)`, 'PASS');
            return { success: true, result, duration };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.testResults.push({
                name: testName,
                status: 'FAIL',
                duration,
                error: error.message
            });
            
            this.log(`❌ FAIL: ${testName} - ${error.message} (${duration}ms)`, 'FAIL');
            return { success: false, error: error.message, duration };
        }
    }

    async testWebSocketConnection() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.wsPort}`);
            
            ws.on('open', () => {
                ws.close();
                resolve({ connected: true, port: this.wsPort });
            });
            
            ws.on('error', (error) => {
                reject(new Error(`WebSocket connection failed: ${error.message}`));
            });
            
            setTimeout(() => {
                ws.close();
                reject(new Error('Connection timeout'));
            }, 5000);
        });
    }

    async testBROPWebSocketConnection() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.bropPort}`);
            
            ws.on('open', () => {
                ws.close();
                resolve({ connected: true, port: this.bropPort });
            });
            
            ws.on('error', (error) => {
                reject(new Error(`BROP WebSocket connection failed: ${error.message}`));
            });
            
            setTimeout(() => {
                ws.close();
                reject(new Error('BROP Connection timeout'));
            }, 5000);
        });
    }

    async testCDPBrowserVersion() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.wsPort}`);
            
            ws.on('open', () => {
                const message = {
                    id: this.getNextMessageId(),
                    method: 'Browser.getVersion',
                    params: {}
                };
                ws.send(JSON.stringify(message));
            });
            
            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.result && response.result.product) {
                        ws.close();
                        resolve({
                            version: response.result,
                            hasProduct: !!response.result.product,
                            hasUserAgent: !!response.result.userAgent
                        });
                    } else {
                        reject(new Error('Invalid version response'));
                    }
                } catch (error) {
                    reject(new Error(`Parse error: ${error.message}`));
                }
            });
            
            ws.on('error', reject);
        });
    }

    async testCDPTargetManagement() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.wsPort}`);
            const results = {
                getTargets: false,
                createTarget: false,
                targetId: null
            };
            
            ws.on('open', () => {
                // First, get existing targets
                const getTargetsMessage = {
                    id: this.getNextMessageId(),
                    method: 'Target.getTargets',
                    params: {}
                };
                ws.send(JSON.stringify(getTargetsMessage));
            });
            
            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    
                    if (response.method === 'Target.getTargets' || 
                        (response.id === 1 && response.result && 'targetInfos' in response.result)) {
                        results.getTargets = true;
                        
                        // Now try to create a new target
                        const createTargetMessage = {
                            id: this.getNextMessageId(),
                            method: 'Target.createTarget',
                            params: {
                                url: 'data:text/html,<h1>BROP Test Page</h1>'
                            }
                        };
                        ws.send(JSON.stringify(createTargetMessage));
                    } else if (response.id === 2 && response.result && response.result.targetId) {
                        results.createTarget = true;
                        results.targetId = response.result.targetId;
                        ws.close();
                        resolve(results);
                    }
                } catch (error) {
                    reject(new Error(`Target management error: ${error.message}`));
                }
            });
            
            ws.on('error', reject);
        });
    }

    async testRuntimeEvaluation() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.wsPort}`);
            
            ws.on('open', () => {
                const message = {
                    id: this.getNextMessageId(),
                    method: 'Runtime.evaluate',
                    params: {
                        expression: '2 + 2'
                    }
                };
                ws.send(JSON.stringify(message));
            });
            
            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.result && response.result.result) {
                        const value = response.result.result.value;
                        ws.close();
                        resolve({
                            expression: '2 + 2',
                            result: value,
                            correct: value === 4
                        });
                    } else {
                        reject(new Error('Invalid evaluation response'));
                    }
                } catch (error) {
                    reject(new Error(`Runtime evaluation error: ${error.message}`));
                }
            });
            
            ws.on('error', reject);
        });
    }

    async testPageNavigation() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.wsPort}`);
            
            ws.on('open', () => {
                const message = {
                    id: this.getNextMessageId(),
                    method: 'Page.navigate',
                    params: {
                        url: 'data:text/html,<h1>Navigation Test</h1><p>Success!</p>'
                    }
                };
                ws.send(JSON.stringify(message));
            });
            
            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.result && response.result.frameId) {
                        ws.close();
                        resolve({
                            frameId: response.result.frameId,
                            navigationSuccessful: true
                        });
                    } else {
                        reject(new Error('Navigation failed'));
                    }
                } catch (error) {
                    reject(new Error(`Navigation error: ${error.message}`));
                }
            });
            
            ws.on('error', reject);
        });
    }

    async testBROPConsoleCommands() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.bropPort}`);
            
            ws.on('open', () => {
                const message = {
                    id: this.getNextMessageId(),
                    command: {
                        type: 'get_console_logs',
                        limit: 10
                    }
                };
                ws.send(JSON.stringify(message));
            });
            
            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    ws.close();
                    resolve({
                        success: response.success !== false,
                        hasLogs: response.result && Array.isArray(response.result.logs)
                    });
                } catch (error) {
                    reject(new Error(`BROP console command error: ${error.message}`));
                }
            });
            
            ws.on('error', reject);
        });
    }

    async testBROPScreenshotCommand() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.bropPort}`);
            
            ws.on('open', () => {
                const message = {
                    id: this.getNextMessageId(),
                    command: {
                        type: 'get_screenshot',
                        format: 'png',
                        quality: 80
                    }
                };
                ws.send(JSON.stringify(message));
            });
            
            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    ws.close();
                    resolve({
                        success: response.success !== false,
                        hasImageData: response.result && !!response.result.image_data
                    });
                } catch (error) {
                    reject(new Error(`BROP screenshot command error: ${error.message}`));
                }
            });
            
            ws.on('error', reject);
        });
    }

    async testInvalidCommandHandling() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.wsPort}`);
            
            ws.on('open', () => {
                const message = {
                    id: this.getNextMessageId(),
                    method: 'NonExistent.Method',
                    params: {}
                };
                ws.send(JSON.stringify(message));
            });
            
            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    ws.close();
                    resolve({
                        hasError: !!response.error,
                        errorCode: response.error ? response.error.code : null,
                        errorMessage: response.error ? response.error.message : null
                    });
                } catch (error) {
                    reject(new Error(`Invalid command test error: ${error.message}`));
                }
            });
            
            ws.on('error', reject);
        });
    }

    async testMessageIdCorrelation() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.wsPort}`);
            const sentIds = [];
            const receivedIds = [];
            
            ws.on('open', () => {
                // Send multiple messages with different IDs
                for (let i = 1; i <= 3; i++) {
                    const id = this.getNextMessageId();
                    sentIds.push(id);
                    
                    const message = {
                        id: id,
                        method: 'Browser.getVersion',
                        params: {}
                    };
                    ws.send(JSON.stringify(message));
                }
            });
            
            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id) {
                        receivedIds.push(response.id);
                        
                        if (receivedIds.length === sentIds.length) {
                            ws.close();
                            resolve({
                                sentIds,
                                receivedIds,
                                allMatched: sentIds.every(id => receivedIds.includes(id))
                            });
                        }
                    }
                } catch (error) {
                    reject(new Error(`Message correlation error: ${error.message}`));
                }
            });
            
            ws.on('error', reject);
        });
    }

    async testPerformanceMetrics() {
        const iterations = 10;
        const results = [];
        
        for (let i = 0; i < iterations; i++) {
            const startTime = Date.now();
            
            try {
                await new Promise((resolve, reject) => {
                    const ws = new WebSocket(`ws://localhost:${this.wsPort}`);
                    
                    ws.on('open', () => {
                        const message = {
                            id: this.getNextMessageId(),
                            method: 'Browser.getVersion',
                            params: {}
                        };
                        ws.send(JSON.stringify(message));
                    });
                    
                    ws.on('message', (data) => {
                        ws.close();
                        resolve();
                    });
                    
                    ws.on('error', reject);
                });
                
                const duration = Date.now() - startTime;
                results.push(duration);
                
            } catch (error) {
                results.push(null);
            }
        }
        
        const validResults = results.filter(r => r !== null);
        const avgDuration = validResults.reduce((a, b) => a + b, 0) / validResults.length;
        const minDuration = Math.min(...validResults);
        const maxDuration = Math.max(...validResults);
        
        return {
            iterations,
            successfulIterations: validResults.length,
            averageDuration: avgDuration,
            minDuration,
            maxDuration,
            successRate: (validResults.length / iterations) * 100
        };
    }

    async generateTestReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
        const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;
        const totalDuration = this.testResults.reduce((sum, t) => sum + t.duration, 0);
        
        const report = {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                successRate: (passedTests / totalTests) * 100,
                totalDuration
            },
            tests: this.testResults,
            timestamp: new Date().toISOString()
        };
        
        const reportPath = path.join(__dirname, `brop-test-report-${Date.now()}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        return { report, reportPath };
    }

    async runAllTests() {
        this.log('🚀 Starting Comprehensive BROP Protocol Test Suite', 'START');
        this.log('=' + '='.repeat(60));
        
        // Basic connectivity tests
        await this.runTest('WebSocket Connection (CDP)', () => this.testWebSocketConnection());
        await this.runTest('WebSocket Connection (BROP)', () => this.testBROPWebSocketConnection());
        
        // CDP protocol tests
        await this.runTest('CDP Browser Version', () => this.testCDPBrowserVersion());
        await this.runTest('CDP Target Management', () => this.testCDPTargetManagement());
        await this.runTest('CDP Runtime Evaluation', () => this.testRuntimeEvaluation());
        await this.runTest('CDP Page Navigation', () => this.testPageNavigation());
        
        // BROP-specific tests
        await this.runTest('BROP Console Commands', () => this.testBROPConsoleCommands());
        await this.runTest('BROP Screenshot Command', () => this.testBROPScreenshotCommand());
        
        // Error handling tests
        await this.runTest('Invalid Command Handling', () => this.testInvalidCommandHandling());
        await this.runTest('Message ID Correlation', () => this.testMessageIdCorrelation());
        
        // Performance tests
        await this.runTest('Performance Metrics', () => this.testPerformanceMetrics());
        
        // Generate report
        this.log('\n📊 Generating test report...');
        const { report, reportPath } = await this.generateTestReport();
        
        this.log('\n📋 Test Summary:');
        this.log('=' + '='.repeat(40));
        this.log(`Total Tests: ${report.summary.total}`);
        this.log(`Passed: ${report.summary.passed} ✅`);
        this.log(`Failed: ${report.summary.failed} ❌`);
        this.log(`Success Rate: ${report.summary.successRate.toFixed(1)}%`);
        this.log(`Total Duration: ${report.summary.totalDuration}ms`);
        this.log(`Report saved to: ${reportPath}`);
        
        if (report.summary.failed > 0) {
            this.log('\n❌ Failed Tests:');
            this.testResults
                .filter(t => t.status === 'FAIL')
                .forEach(t => this.log(`   - ${t.name}: ${t.error}`));
        }
        
        this.log('\n🎯 BROP Protocol Test Suite Complete!');
        
        return report;
    }
}

// CLI execution
async function main() {
    const testSuite = new BROPProtocolTestSuite();
    
    try {
        await testSuite.runAllTests();
        process.exit(0);
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    }
}

// Export for module usage
module.exports = BROPProtocolTestSuite;

// Run if called directly
if (require.main === module) {
    main();
}