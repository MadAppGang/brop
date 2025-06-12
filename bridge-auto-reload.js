#!/usr/bin/env node
/**
 * BROP Bridge Server Auto-Reload
 * Watches for file changes and automatically restarts the bridge server
 * This eliminates the need to manually kill and restart the bridge
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class BridgeAutoReloader {
    constructor() {
        this.bridgeProcess = null;
        this.isRestarting = false;
        this.restartDebounce = null;
        this.watchedFiles = new Set();
        
        // Files and directories to watch
        this.watchPaths = [
            './bridge-server/bridge_server.js',
            './bridge-server/package.json',
            './background_bridge_client.js',
            './content.js',
            './manifest.json',
            './popup_enhanced.js',
            './popup.html'
        ];
        
        console.log('🌉 BROP Bridge Auto-Reload System');
        console.log('=' + '='.repeat(40));
        console.log('📋 Features:');
        console.log('   • Auto-restart bridge server on file changes');
        console.log('   • Auto-reload extension on manifest changes');
        console.log('   • Debounced restarts to avoid rapid cycling');
        console.log('   • Graceful process management');
        console.log('');
        
        this.startBridge();
        this.setupFileWatchers();
        this.setupGracefulShutdown();
    }
    
    startBridge() {
        if (this.bridgeProcess) {
            console.log('🔄 Stopping existing bridge process...');
            this.bridgeProcess.kill('SIGTERM');
        }
        
        console.log('🚀 Starting BROP bridge server...');
        
        this.bridgeProcess = spawn('node', ['bridge_server.js'], {
            cwd: './bridge-server',
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'development' }
        });
        
        this.bridgeProcess.on('error', (error) => {
            console.error('❌ Bridge process error:', error.message);
        });
        
        this.bridgeProcess.on('exit', (code, signal) => {
            if (signal === 'SIGTERM' || signal === 'SIGKILL') {
                console.log('🔄 Bridge process terminated for restart');
            } else if (code !== 0 && !this.isRestarting) {
                console.error(`❌ Bridge process exited with code ${code}`);
                console.log('🔄 Attempting to restart in 2 seconds...');
                setTimeout(() => this.startBridge(), 2000);
            }
            
            this.bridgeProcess = null;
        });
        
        console.log(`✅ Bridge server started (PID: ${this.bridgeProcess.pid})`);
    }
    
    setupFileWatchers() {
        console.log('\\n👀 Setting up file watchers...');
        
        this.watchPaths.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                console.log(`   📁 Watching: ${filePath}`);
                
                const watcher = fs.watch(filePath, (eventType, filename) => {
                    if (eventType === 'change') {
                        console.log(`\\n📝 File changed: ${filePath}`);
                        this.scheduleRestart(filePath);
                    }
                });
                
                this.watchedFiles.add(watcher);
            } else {
                console.log(`   ⚠️  File not found: ${filePath}`);
            }
        });
        
        // Also watch the bridge-server directory for any new files
        if (fs.existsSync('./bridge-server')) {
            console.log('   📁 Watching: ./bridge-server/ (directory)');
            const dirWatcher = fs.watch('./bridge-server', { recursive: true }, (eventType, filename) => {
                if (filename && filename.endsWith('.js') && eventType === 'change') {
                    console.log(`\\n📝 Bridge file changed: ${filename}`);
                    this.scheduleRestart(`./bridge-server/${filename}`);
                }
            });
            this.watchedFiles.add(dirWatcher);
        }
        
        console.log(`✅ Watching ${this.watchedFiles.size} files/directories for changes`);
    }
    
    scheduleRestart(changedFile) {
        // Debounce rapid changes
        if (this.restartDebounce) {
            clearTimeout(this.restartDebounce);
        }
        
        this.restartDebounce = setTimeout(() => {
            this.handleFileChange(changedFile);
        }, 500); // Wait 500ms for multiple rapid changes
    }
    
    async handleFileChange(changedFile) {
        console.log(`🔄 Handling change in: ${changedFile}`);
        
        this.isRestarting = true;
        
        // Different behavior based on file type
        if (changedFile.includes('manifest.json')) {
            console.log('📋 Manifest changed - reloading extension and bridge');
            await this.reloadExtension('Manifest file changed');
            await this.restartBridge();
        } else if (changedFile.includes('bridge-server/')) {
            console.log('🌉 Bridge server file changed - restarting bridge only');
            await this.restartBridge();
        } else if (changedFile.includes('background_bridge_client.js') || 
                   changedFile.includes('content.js') ||
                   changedFile.includes('popup')) {
            console.log('🔧 Extension file changed - reloading extension');
            await this.reloadExtension('Extension file changed');
        } else {
            console.log('📄 Other file changed - restarting bridge');
            await this.restartBridge();
        }
        
        this.isRestarting = false;
    }
    
    async restartBridge() {
        console.log('\\n🔄 Restarting bridge server...');
        this.startBridge();
        
        // Wait a moment for bridge to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('✅ Bridge server restarted');
    }
    
    async reloadExtension(reason) {
        console.log(`\\n🔄 Reloading extension: ${reason}`);
        
        try {
            // Try to connect and reload extension
            const WebSocket = require('ws');
            const ws = new WebSocket('ws://localhost:9223');
            
            await new Promise((resolve, reject) => {
                ws.on('open', resolve);
                ws.on('error', () => {
                    console.log('   ⚠️  Bridge not ready for extension reload');
                    resolve(); // Don't fail if bridge isn't ready
                });
                setTimeout(() => resolve(), 2000); // Timeout after 2s
            });
            
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    id: 'auto_reload',
                    command: {
                        type: 'reload_extension',
                        reason: reason,
                        delay: 500
                    }
                }));
                
                console.log('✅ Extension reload command sent');
                ws.close();
            } else {
                console.log('   ⚠️  Could not connect to bridge for extension reload');
            }
            
        } catch (error) {
            console.log(`   ⚠️  Extension reload failed: ${error.message}`);
        }
    }
    
    setupGracefulShutdown() {
        const shutdown = () => {
            console.log('\\n🔄 Shutting down auto-reload system...');
            
            // Close file watchers
            this.watchedFiles.forEach(watcher => {
                try {
                    watcher.close();
                } catch (error) {
                    // Ignore errors when closing watchers
                }
            });
            
            // Kill bridge process
            if (this.bridgeProcess) {
                console.log('🔄 Stopping bridge server...');
                this.bridgeProcess.kill('SIGTERM');
                
                // Force kill after 5 seconds if it doesn't stop gracefully
                setTimeout(() => {
                    if (this.bridgeProcess) {
                        console.log('🔪 Force killing bridge server...');
                        this.bridgeProcess.kill('SIGKILL');
                    }
                }, 5000);
            }
            
            console.log('✅ Auto-reload system stopped');
            process.exit(0);
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        process.on('exit', shutdown);
    }
    
    showStatus() {
        console.log('\\n📊 Auto-Reload Status:');
        console.log(`   🌉 Bridge Process: ${this.bridgeProcess ? `Running (PID: ${this.bridgeProcess.pid})` : 'Stopped'}`);
        console.log(`   👀 File Watchers: ${this.watchedFiles.size} active`);
        console.log(`   🔄 Is Restarting: ${this.isRestarting ? 'Yes' : 'No'}`);
        console.log('');
        console.log('💡 Auto-reload will trigger on changes to:');
        this.watchPaths.forEach(path => {
            const exists = fs.existsSync(path) ? '✅' : '❌';
            console.log(`   ${exists} ${path}`);
        });
    }
}

// Start the auto-reload system
const autoReloader = new BridgeAutoReloader();

// Show status after initialization
setTimeout(() => {
    autoReloader.showStatus();
    
    console.log('\\n🎯 Auto-reload system is now active!');
    console.log('   • Edit any watched file to trigger restart');
    console.log('   • Press Ctrl+C to stop');
    console.log('');
}, 3000);