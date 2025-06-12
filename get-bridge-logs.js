#!/usr/bin/env node
/**
 * Get Bridge Server Logs
 * Utility to fetch bridge server logs for debugging
 */

const http = require('http');

async function getBridgeLogs(options = {}) {
    console.log('📋 Getting Bridge Server Logs');
    console.log('=' + '='.repeat(30));
    
    const {
        limit = 50,
        level = null,
        format = 'detailed'
    } = options;
    
    try {
        console.log('📋 Connecting to bridge server...');
        
        // Build query string
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (level) params.append('level', level);
        
        const queryString = params.toString();
        const url = `http://localhost:9225/logs${queryString ? `?${queryString}` : ''}`;
        
        const response = await makeHttpRequest(url);
        
        if (response.statusCode !== 200) {
            throw new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`);
        }
        
        const logsData = JSON.parse(response.body);
        
        console.log('✅ Bridge logs retrieved');
        console.log(`📊 Total logs: ${logsData.total}, Returned: ${logsData.returned}`);
        
        if (format === 'summary') {
            displayLogsSummary(logsData);
        } else {
            displayLogsDetailed(logsData);
        }
        
        return logsData;
        
    } catch (error) {
        console.error('❌ Failed to get bridge logs:', error.message);
        throw error;
    }
}

function displayLogsSummary(logsData) {
    console.log('\n📋 Recent Bridge Activity:');
    console.log('-'.repeat(40));
    
    logsData.logs.slice(-10).forEach((log, index) => {
        const time = log.timestamp.split(' ')[1]; // Just the time part
        console.log(`${time} - ${log.fullMessage}`);
    });
}

function displayLogsDetailed(logsData) {
    console.log('\n📋 Bridge Server Logs:');
    console.log('-'.repeat(60));
    
    logsData.logs.forEach((log, index) => {
        console.log(`[${log.timestamp}] ${log.fullMessage}`);
    });
    
    if (logsData.logs.length === 0) {
        console.log('   No logs found');
    }
}

function makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    body: body
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--limit' && i + 1 < args.length) {
            options.limit = parseInt(args[i + 1]);
            i++; // Skip next argument
        } else if (arg === '--level' && i + 1 < args.length) {
            options.level = args[i + 1];
            i++; // Skip next argument
        } else if (arg === '--summary') {
            options.format = 'summary';
        } else if (arg === '--help') {
            console.log('Get Bridge Server Logs');
            console.log('');
            console.log('Usage: node get-bridge-logs.js [options]');
            console.log('');
            console.log('Options:');
            console.log('  --limit <number>    Number of recent logs to return (default: 50)');
            console.log('  --level <level>     Filter by log level (info, error, etc.)');
            console.log('  --summary          Show summary format instead of detailed');
            console.log('  --help             Show this help message');
            console.log('');
            console.log('Examples:');
            console.log('  node get-bridge-logs.js');
            console.log('  node get-bridge-logs.js --limit 20 --summary');
            console.log('  node get-bridge-logs.js --level error');
            process.exit(0);
        }
    }
    
    getBridgeLogs(options).catch(error => {
        console.error('\n💥 Operation failed:', error.message);
        process.exit(1);
    });
}

module.exports = { getBridgeLogs };