#!/usr/bin/env node
/**
 * Utility functions for BROP tests
 */

const WebSocket = require('ws');
const path = require('path');

/**
 * Get the current test filename for connection naming
 * @returns {string} The current test filename
 */
function getCurrentTestName() {
    // Get the calling file's name from the stack trace
    const originalFunc = Error.prepareStackTrace;
    
    let callerFile;
    try {
        const err = new Error();
        Error.prepareStackTrace = function (err, stack) {
            return stack;
        };
        
        const currentfile = err.stack.shift().getFileName();
        
        // Find the first stack frame that's not this utility file
        while (err.stack.length) {
            const frame = err.stack.shift();
            const filename = frame.getFileName();
            
            if (filename !== currentfile && filename !== __filename) {
                callerFile = filename;
                break;
            }
        }
    } catch (e) {
        // Fallback
        callerFile = null;
    } finally {
        Error.prepareStackTrace = originalFunc;
    }
    
    if (callerFile) {
        return path.basename(callerFile);
    }
    
    // Fallback: try to extract from process.argv
    if (process.argv[1]) {
        return path.basename(process.argv[1]);
    }
    
    return 'unknown-test';
}

/**
 * Create a WebSocket connection to BROP bridge with automatic test name
 * @param {string} [customName] Optional custom name override
 * @returns {WebSocket} WebSocket connection with test name
 */
function createBROPConnection(customName) {
    const testName = customName || getCurrentTestName();
    const url = `ws://localhost:9223?name=${encodeURIComponent(testName)}`;
    return new WebSocket(url);
}

/**
 * Create a WebSocket connection to BROP bridge with test name and optional suffix
 * @param {string} [suffix] Optional suffix to add to test name (e.g., 'step1', 'cleanup')
 * @returns {WebSocket} WebSocket connection with test name and suffix
 */
function createNamedBROPConnection(suffix) {
    const testName = getCurrentTestName();
    const fullName = suffix ? `${testName}:${suffix}` : testName;
    const url = `ws://localhost:9223?name=${encodeURIComponent(fullName)}`;
    return new WebSocket(url);
}

module.exports = {
    getCurrentTestName,
    createBROPConnection,
    createNamedBROPConnection
};