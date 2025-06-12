#!/usr/bin/env node
/**
 * Start Development Environment
 * Convenience script to start the auto-reload development environment
 */

const { spawn } = require('child_process');
const fs = require('fs');

function startDevelopmentEnvironment() {
    console.log('🚀 Starting BROP Development Environment');
    console.log('=' + '='.repeat(45));
    
    // Check if required files exist
    const requiredFiles = [
        './bridge-server/bridge_server.js',
        './bridge-auto-reload.js'
    ];
    
    let allFilesExist = true;
    requiredFiles.forEach(file => {
        if (!fs.existsSync(file)) {
            console.error(`❌ Required file missing: ${file}`);
            allFilesExist = false;
        }
    });
    
    if (!allFilesExist) {
        console.error('\\n❌ Cannot start development environment - missing files');
        process.exit(1);
    }
    
    console.log('✅ All required files found');
    console.log('\\n📋 Development environment features:');
    console.log('   • Auto-restart bridge server on code changes');
    console.log('   • Auto-reload extension on manifest changes');
    console.log('   • File watching for rapid development');
    console.log('   • Graceful shutdown handling');
    
    console.log('\\n🔄 Starting auto-reload system...');
    
    // Start the auto-reload system
    const autoReload = spawn('node', ['bridge-auto-reload.js'], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'development' }
    });
    
    autoReload.on('error', (error) => {
        console.error('❌ Failed to start auto-reload system:', error.message);
        process.exit(1);
    });
    
    autoReload.on('exit', (code) => {
        if (code !== 0) {
            console.error(`❌ Auto-reload system exited with code ${code}`);
        } else {
            console.log('✅ Development environment stopped');
        }
        process.exit(code);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\\n🔄 Stopping development environment...');
        autoReload.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
        console.log('\\n🔄 Stopping development environment...');
        autoReload.kill('SIGTERM');
    });
}

startDevelopmentEnvironment();