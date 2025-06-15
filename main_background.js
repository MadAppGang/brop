// Browser Remote Operations Protocol - Main Background Script
// Clean multiplexing architecture with delegated servers:
// 1. BROP commands → BROPServer (extension APIs)
// 2. CDP commands → CDPServer (real Chrome forwarding)

// Import the BROP and CDP servers
importScripts("brop_server.js");
importScripts("cdp_server.js");

class MainBackground {
	constructor() {
		this.bridgeSocket = null;
		this.reconnectAttempts = 0;
		this.connectionStatus = "disconnected";
		this.isConnected = false;
		this.enabled = true;

		this.bridgeUrl = "ws://localhost:9224"; // Extension server port

		// Initialize BROP server for native commands
		this.bropServer = new BROPServer();
		console.log("🔧 BROP Server initialized for native commands");

		// Initialize CDP server for CDP commands
		this.cdpServer = new CDPServer();
		console.log("🎭 CDP Server initialized for CDP commands");

		// Set up CDP event forwarding
		this.cdpServer.setEventCallback((event) => {
			this.forwardCDPEvent(event);
		});

		this.setupErrorHandlers();
		this.setupPopupMessageHandler();
		this.connectToBridge();
	}

	forwardCDPEvent(event) {
		// Forward CDP events from real Chrome to bridge clients
		if (this.isConnected && this.bridgeSocket) {
			try {
				this.bridgeSocket.send(JSON.stringify(event));
				console.log(`🎭 Forwarded CDP event: ${event.method}`);
			} catch (error) {
				console.error("Error forwarding CDP event:", error);
			}
		}
	}

	setupErrorHandlers() {
		// Enhanced error capture system - delegate to BROP server
		self.addEventListener("error", (event) => {
			if (this.bropServer) {
				this.bropServer.logError(
					"Uncaught Error",
					event.error?.message || event.message,
					event.error?.stack,
				);
			}
		});

		self.addEventListener("unhandledrejection", (event) => {
			if (this.bropServer) {
				this.bropServer.logError(
					"Unhandled Promise Rejection",
					event.reason?.message || String(event.reason),
					event.reason?.stack,
				);
			}
		});
	}

	setupPopupMessageHandler() {
		// Handle messages from popup and other extension components
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			console.log("📨 Popup message received:", message.type);

			const handleAsync = async () => {
				try {
					switch (message.type) {
						case "GET_STATUS":
							return this.getStatus();

						case "SET_ENABLED":
							return await this.setEnabled(message.enabled);

						case "GET_SERVER_STATUS":
							return await this.getServerStatus();

						case "GET_LOGS":
							return this.getLogs(message.limit);

						case "CLEAR_LOGS":
							return await this.clearLogs();

						default:
							throw new Error(`Unknown popup message type: ${message.type}`);
					}
				} catch (error) {
					console.error(`Error handling popup message ${message.type}:`, error);
					return {
						success: false,
						error: error.message,
					};
				}
			};

			// Handle async messages
			handleAsync().then((response) => {
				sendResponse(response);
			});

			return true; // Keep message channel open for async response
		});
	}

	getStatus() {
		return {
			connected: this.isConnected,
			enabled: this.enabled,
			connectionStatus: this.connectionStatus,
			reconnectAttempts: this.reconnectAttempts,
			totalLogs: this.bropServer?.callLogs?.length || 0,
			debuggerAttached: this.cdpServer?.isAttached || false,
			activeSessions: this.isConnected ? 1 : 0,
			controlledTabs: 0, // Will be populated from tab query if needed
		};
	}

	async setEnabled(enabled) {
		this.enabled = enabled;
		if (this.bropServer) {
			this.bropServer.enabled = enabled;
			await this.bropServer.saveSettings();
		}

		console.log(`🔧 BROP service ${enabled ? "enabled" : "disabled"}`);

		return {
			success: true,
			enabled: this.enabled,
			message: `BROP service ${enabled ? "enabled" : "disabled"}`,
		};
	}

	async getServerStatus() {
		// This should query the bridge server for its status
		// For now, return extension status
		return {
			success: true,
			result: {
				connected_clients: {
					total_active_sessions: this.isConnected ? 1 : 0,
				},
				bridge_connected: this.isConnected,
				extension_status: this.getStatus(),
			},
		};
	}

	getLogs(limit = 100) {
		const logs = this.bropServer?.callLogs || [];
		return {
			success: true,
			logs: logs.slice(-limit),
		};
	}

	async clearLogs() {
		if (this.bropServer) {
			this.bropServer.callLogs = [];
			await this.bropServer.saveSettings();
		}

		return {
			success: true,
			message: "Logs cleared successfully",
		};
	}

	logError(type, message, stack = null) {
		// Delegate to BROP server for consistent error handling
		if (this.bropServer) {
			this.bropServer.logError(type, message, stack);
		} else {
			console.error(
				`[BROP Error] ${type}: ${message}`,
				stack ? `\nStack: ${stack}` : "",
			);
		}
	}

	async connectToBridge() {
		try {
			console.log("🔗 Connecting to multiplexed bridge server...");
			this.bridgeSocket = new WebSocket(this.bridgeUrl);

			this.bridgeSocket.onopen = () => {
				console.log("✅ Connected to multiplexed bridge server");
				this.isConnected = true;
				this.connectionStatus = "connected";
				this.reconnectAttempts = 0;
			};

			this.bridgeSocket.onmessage = (event) => {
				this.handleBridgeMessage(event.data);
			};

			this.bridgeSocket.onclose = () => {
				console.log("🔌 Bridge connection closed");
				this.isConnected = false;
				this.connectionStatus = "disconnected";
				this.scheduleReconnect();
			};

			this.bridgeSocket.onerror = (error) => {
				console.error("❌ Bridge connection error:", error);
				this.isConnected = false;
				this.connectionStatus = "disconnected";
			};
		} catch (error) {
			console.error("Failed to connect to bridge:", error);
			this.scheduleReconnect();
		}
	}

	// CDP connection is now handled by CDPServer

	scheduleReconnect() {
		if (this.reconnectAttempts < 10) {
			this.reconnectAttempts++;
			const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
			console.log(
				`🔄 Reconnecting to bridge in ${delay}ms (attempt ${this.reconnectAttempts})`,
			);
			setTimeout(() => this.connectToBridge(), delay);
		}
	}

	async handleBridgeMessage(data) {
		try {
			const message = JSON.parse(data);
			const messageType = message.type;

			console.log("📥 Bridge message type:", messageType);

			if (messageType === "welcome") {
				console.log("👋 Bridge welcome:", message.message);
				return;
			}

			if (messageType === "brop_command") {
				// Native BROP command - handle via extension APIs
				await this.processBROPNativeCommand(message);
			} else if (messageType === "BROP_CDP") {
				// Wrapped CDP command - forward to real Chrome
				await this.processBROPCDPCommand(message);
			} else {
				console.warn("Unknown message type from bridge:", messageType);
			}
		} catch (error) {
			console.error("Error handling bridge message:", error);
		}
	}

	async processBROPNativeCommand(message) {
		const { id, method, params } = message;

		console.log("🔧 Processing BROP native command via BROPServer:", method);

		if (!this.enabled) {
			this.sendToBridge({
				type: "response",
				id: id,
				success: false,
				error: "BROP service is disabled",
			});
			return;
		}

		try {
			// Use the BROP server to process the command
			const result = await this.bropServer.processBROPCommand(message);

			this.sendToBridge({
				type: "response",
				id: id,
				success: true,
				result: result,
			});
		} catch (error) {
			console.error(`BROP command error (${method}):`, error);
			this.logError(
				"BROP Command Error",
				`${method}: ${error.message}`,
				error.stack,
			);

			this.sendToBridge({
				type: "response",
				id: id,
				success: false,
				error: error.message,
			});
		}
	}

	async processBROPCDPCommand(message) {
		console.log(
			"🎭 Processing wrapped CDP command via CDP Server",
			message.method,
		);
		console.log("🎭 Full CDP message:", message);

		try {
			// Use the CDP server to process the command
			await this.cdpServer.processCDPCommand(message, (response) => {
				console.log("🎭 CDP command response:", response);
				this.sendToBridge(response);
			});
		} catch (error) {
			console.error("🎭 Error in processBROPCDPCommand:", error);
			this.sendToBridge({
				type: "response",
				id: message.id,
				error: {
					code: -32603,
					message: `CDP processing failed: ${error.message}`,
				},
			});
		}
	}

	// CDP message handling is now delegated to CDPServer
	// No need for handleRealChromeMessage or handleCDPFallback methods

	sendToBridge(message) {
		if (
			this.isConnected &&
			this.bridgeSocket &&
			this.bridgeSocket.readyState === WebSocket.OPEN
		) {
			this.bridgeSocket.send(JSON.stringify(message));
		} else {
			console.error("Cannot send to bridge: not connected");
		}
	}

	// All CDP commands are now handled by the CDPServer instance
	// All BROP commands are now handled by the BROPServer instance
	// Clean multiplexing layer with delegated command processing
}

// Initialize the main background script
const mainBackground = new MainBackground();

// Export for testing
if (typeof module !== "undefined" && module.exports) {
	module.exports = MainBackground;
}
