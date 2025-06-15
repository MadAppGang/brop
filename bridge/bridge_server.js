#!/usr/bin/env node
/**
 * BROP Unified Bridge Server (Node.js)
 *
 * Unified architecture that combines:
 * 1. BROP multiplexing for native BROP commands (port 9225)
 * 2. CDP server for 3rd party tools like Playwright (port 9222)
 * 3. Chrome extension connection (port 9224)
 * 4. CDP discovery endpoints
 *
 * NO REAL CHROME DEPENDENCY - Everything routes through Chrome Extension APIs
 *
 * Key Features:
 * - Clean protocol separation: BROP vs CDP
 * - Multiplexed BROP clients for native commands
 * - CDP compatibility for Playwright/Puppeteer
 * - Proper session management for Target.* commands
 * - HTTP discovery endpoints for CDP clients
 */

import http from "node:http";
import url from "node:url";
import WebSocket, { WebSocketServer } from "ws";

class TableLogger {
	constructor(options = {}) {
		this.tsWidth = 19;
		this.statusWidth = 3;
		this.typeWidth = 6;
		this.commandWidth = 20;
		this.connWidth = 50;
		this.errorWidth = 20;
		this.outputStream = options.outputStream || "stdout";
		this.mcpMode = options.mcpMode || false;
	}

	getTimestamp() {
		return new Date().toISOString().replace("T", " ").slice(0, 19);
	}

	formatField(text, width, align = "left") {
		const str = String(text || "").slice(0, width);
		if (str === "✅" || str === "❌" || str === "🔗" || str === "🔌") {
			return str.padEnd(1) + " ".repeat(width - 1);
		}
		return align === "right" ? str.padStart(width) : str.padEnd(width);
	}

	formatRow(status, type, command, connection, error = "") {
		const timestamp = this.getTimestamp();
		const parts = [
			this.formatField(timestamp, this.tsWidth),
			this.formatField(status, this.statusWidth),
			this.formatField(type, this.typeWidth),
			this.formatField(command, this.commandWidth),
			this.formatField(connection, this.connWidth),
			this.formatField(error, this.errorWidth),
		];
		return parts.join(" │ ");
	}

	log(message) {
		if (this.outputStream === "stderr" || this.mcpMode) {
			console.error(message);
		} else {
			console.log(message);
		}
	}

	printHeader() {
		const header = this.formatRow(
			"STS",
			"TYPE",
			"COMMAND/EVENT",
			"CONNECTION",
			"ERROR/DETAILS",
		);
		this.log("─".repeat(header.length));
		this.log(header);
		this.log("─".repeat(header.length));
	}

	logConnect(type, connection) {
		this.log(this.formatRow("🔗", type, "connect", connection));
	}

	logDisconnect(type, connection) {
		this.log(this.formatRow("🔌", type, "disconnect", connection));
	}

	logSuccess(type, command, connection, details = "") {
		this.log(this.formatRow("✅", type, command, connection, details));
	}

	logError(type, command, connection, error) {
		this.log(this.formatRow("❌", type, command, connection, error));
	}

	logSystem(message) {
		this.log(`[${this.getTimestamp()}] ${message}`);
	}
}

class UnifiedBridgeServer {
	constructor(options = {}) {
		this.startTime = Date.now();

		// Extension connection (single point of truth)
		this.extensionClient = null;

		// BROP client multiplexing
		this.bropClients = new Set();
		this.bropConnections = new Map(); // client -> connection info

		// CDP client multiplexing with session management
		this.cdpClients = new Map(); // clientId -> client info
		this.cdpClientCounter = 0;
		this.sessionChannels = new Map(); // sessionId -> session info
		this.targetToSession = new Map(); // targetId -> sessionId
		this.sessionToTarget = new Map(); // sessionId -> targetId
		this.targetToClient = new Map(); // targetId -> clientId

		// Message routing
		this.pendingBropRequests = new Map(); // messageId -> bropClient
		this.pendingCdpRequests = new Map(); // messageId -> requestInfo
		this.pendingCommandInfo = new Map(); // messageId -> { command, connection } for response logging
		this.messageCounter = 0;
		this.connectionCounter = 0;

		// Server instances
		this.bropServer = null;
		this.extensionServer = null;
		this.cdpServer = null;
		this.httpServer = null;
		this.running = false;

		// Chrome-compatible browser info for CDP discovery
		this.browserInfo = {
			Browser: "Chrome/138.0.7204.15",
			"Protocol-Version": "1.3",
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
			"V8-Version": "13.8.258.9",
			"WebKit-Version": "537.36 (@9f1120d029eadbc8ecc5c3d9b298c16d08aabf9f)",
			webSocketDebuggerUrl:
				"ws://localhost:9222/devtools/browser/brop-bridge-uuid-12345678",
		};

		// Logs for debugging
		this.logs = [];
		this.maxLogs = 1000;

		// Table logger
		this.logger = new TableLogger({
			outputStream: options.logToStderr ? "stderr" : "stdout",
			mcpMode: options.mcpMode || false,
		});
	}

	log(message, ...args) {
		// Store all logs for debugging endpoint
		const logEntry = {
			timestamp: this.logger.getTimestamp(),
			message: message,
			args: args,
			fullMessage: args.length > 0 ? `${message} ${args.join(" ")}` : message,
			level: "info",
		};

		this.logs.push(logEntry);

		// Keep only the last maxLogs entries
		if (this.logs.length > this.maxLogs) {
			this.logs.splice(0, this.logs.length - this.maxLogs);
		}

		// Use system logging for non-structured messages
		this.logger.logSystem(message);
	}

	getNextMessageId() {
		this.messageCounter++;
		return `bridge_${this.messageCounter}`;
	}

	getNextConnectionId() {
		this.connectionCounter++;
		return `conn_${this.connectionCounter}`;
	}

	// Helper to format connection display with name
	getConnectionDisplay(client) {
		const clientInfo = this.bropConnections.get(client);
		if (!clientInfo) return "unknown";

		return clientInfo.name
			? `${clientInfo.id}:${clientInfo.name}`
			: clientInfo.id;
	}

	async startServers() {
		this.running = true;
		this.logger.printHeader();

		try {
			// Start BROP server (port 9225 - BROP clients)
			this.bropServer = new WebSocketServer({
				port: 9225,
				host: "127.0.0.1",
				perMessageDeflate: false,
			});
			this.bropServer.on("connection", (ws, req) =>
				this.handleBropClient(ws, req),
			);
			this.log("🔧 BROP Server started on ws://localhost:9225");

			// Start Extension server (port 9224 - extension connects here)
			this.extensionServer = new WebSocketServer({
				port: 9224,
				host: "127.0.0.1",
				perMessageDeflate: false,
			});
			this.extensionServer.on("connection", (ws, req) =>
				this.handleExtensionClient(ws, req),
			);
			this.log("🔌 Extension Server started on ws://localhost:9224");

			// Start HTTP server for CDP discovery
			this.httpServer = http.createServer((req, res) =>
				this.handleHttpRequest(req, res),
			);

			// Start CDP server (port 9222 - CDP clients like Playwright)
			this.cdpServer = new WebSocketServer({
				server: this.httpServer,
				perMessageDeflate: false,
			});
			this.cdpServer.on("connection", (ws, req) =>
				this.handleCdpClient(ws, req),
			);

			await new Promise((resolve, reject) => {
				this.httpServer.on("error", reject);
				this.httpServer.listen(9222, "127.0.0.1", () => {
					this.log("🎭 CDP Server started on ws://localhost:9222");
					this.log(
						"🌐 HTTP Server started on http://localhost:9222 (CDP discovery)",
					);
					resolve();
				});
			});

			this.log("📡 Waiting for Chrome extension to connect...");
		} catch (error) {
			console.error("Failed to start servers:", error);
			throw error;
		}
	}

	handleHttpRequest(req, res) {
		const pathname = url.parse(req.url).pathname;

		// Enable CORS
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");
		res.setHeader("Content-Type", "application/json");

		if (req.method === "OPTIONS") {
			res.writeHead(200);
			res.end();
			return;
		}

		if (pathname === "/json/version" || pathname === "/json/version/") {
			res.writeHead(200);
			res.end(JSON.stringify(this.browserInfo));
		} else if (
			pathname === "/json" ||
			pathname === "/json/" ||
			pathname === "/json/list" ||
			pathname === "/json/list/"
		) {
			// Return Chrome-compatible target list
			const tabs = [
				{
					description: "",
					devtoolsFrontendUrl:
						"/devtools/inspector.html?ws=localhost:9222/devtools/browser/brop-bridge-uuid-12345678",
					id: "brop-bridge-uuid-12345678",
					title: "Chrome",
					type: "browser",
					url: "",
					webSocketDebuggerUrl:
						"ws://localhost:9222/devtools/browser/brop-bridge-uuid-12345678",
				},
			];
			res.writeHead(200);
			res.end(JSON.stringify(tabs));
		} else if (pathname === "/logs") {
			// Return bridge server logs for debugging
			const urlParams = new URLSearchParams(url.parse(req.url).query);
			const limit = Number.parseInt(urlParams.get("limit")) || this.logs.length;
			const logsToReturn = this.logs.slice(-limit);

			const response = {
				total: this.logs.length,
				returned: logsToReturn.length,
				logs: logsToReturn,
			};

			res.writeHead(200);
			res.end(JSON.stringify(response, null, 2));
		} else {
			res.writeHead(404);
			res.end(JSON.stringify({ error: "Not found" }));
		}
	}

	handleBropClient(ws, req) {
		const connectionId = this.getNextConnectionId();
		const queryParams = url.parse(req.url, true).query;
		const clientName = queryParams.name || null;

		const clientInfo = {
			id: connectionId,
			name: clientName,
			connectedAt: Date.now(),
			remoteAddress: req.socket.remoteAddress || "unknown",
		};

		this.bropConnections.set(ws, clientInfo);
		const connectionDisplay = clientName
			? `${connectionId}:${clientName}`
			: connectionId;

		this.logger.logConnect("BROP", connectionDisplay);
		this.bropClients.add(ws);

		ws.on("message", (message) => {
			this.processBropMessage(ws, message.toString());
		});

		ws.on("close", () => {
			this.logger.logDisconnect("BROP", connectionDisplay);
			this.bropClients.delete(ws);
			this.bropConnections.delete(ws);
		});

		ws.on("error", (error) => {
			this.logger.logError(
				"BROP",
				"connection",
				connectionDisplay,
				error.message,
			);
		});
	}

	handleCdpClient(ws, req) {
		const pathname = url.parse(req.url).pathname;
		const clientId = `cdp_${++this.cdpClientCounter}`;

		this.logger.logConnect("CDP", `${clientId}:${pathname}`);

		// Parse connection type from pathname
		let isMainBrowser = true;
		let clientType = "browser";
		let targetSessionId = null;

		if (pathname.startsWith("/devtools/browser/")) {
			isMainBrowser = true;
			clientType = "browser";
		} else if (pathname.startsWith("/devtools/page/")) {
			const pageId = pathname.substring("/devtools/page/".length);
			targetSessionId = pageId;
			isMainBrowser = false;
			clientType = "page";
		} else if (pathname.startsWith("/session/")) {
			targetSessionId = pathname.substring("/session/".length);
			isMainBrowser = false;
			clientType = "session";
		} else {
			isMainBrowser = this.cdpClients.size === 0;
		}

		const clientInfo = {
			ws: ws,
			sessionId: targetSessionId || `session_${clientId}`,
			pathname: pathname,
			connected: true,
			targets: new Set(),
			isMainBrowser: isMainBrowser,
			isSessionConnection: !isMainBrowser,
			targetSessionId: targetSessionId,
			clientType: clientType,
			created: Date.now(),
		};

		this.cdpClients.set(clientId, clientInfo);

		ws.on("message", (message) => {
			this.processCdpMessage(clientId, message.toString());
		});

		ws.on("close", () => {
			this.logger.logDisconnect("CDP", `${clientId}:${pathname}`);
			this.cleanupCdpClient(clientId);
		});

		ws.on("error", (error) => {
			this.logger.logError(
				"CDP",
				"connection",
				`${clientId}:${pathname}`,
				error.message,
			);
			this.cleanupCdpClient(clientId);
		});
	}

	cleanupCdpClient(clientId) {
		const clientInfo = this.cdpClients.get(clientId);
		if (clientInfo) {
			clientInfo.connected = false;

			// Clean up pending requests
			for (const [
				messageId,
				requestInfo,
			] of this.pendingCdpRequests.entries()) {
				if (requestInfo.clientId === clientId) {
					this.pendingCdpRequests.delete(messageId);
				}
			}

			// Clean up session mappings
			for (const targetId of clientInfo.targets) {
				this.targetToClient.delete(targetId);
				const sessionId = this.targetToSession.get(targetId);
				if (sessionId) {
					this.sessionChannels.delete(sessionId);
					this.targetToSession.delete(targetId);
					this.sessionToTarget.delete(sessionId);
				}
			}

			this.cdpClients.delete(clientId);
		}
	}

	handleExtensionClient(ws, req) {
		this.logger.logConnect("EXT", "extension");
		this.extensionClient = ws;

		ws.send(
			JSON.stringify({
				type: "welcome",
				message: "BROP Unified Bridge Server - Extension connected",
				timestamp: Date.now(),
			}),
		);

		ws.on("message", (message) => {
			this.processExtensionMessage(message.toString());
		});

		ws.on("close", () => {
			this.logger.logDisconnect("EXT", "extension");
			this.extensionClient = null;
		});

		ws.on("error", (error) => {
			this.logger.logError("EXT", "connection", "extension", error.message);
		});
	}

	processBropMessage(client, message) {
		try {
			const data = JSON.parse(message);
			const commandType = data.method || data.command?.type;
			const messageId = data.id || this.getNextMessageId();

			const clientInfo = this.bropConnections.get(client);
			const connectionDisplay = clientInfo?.name
				? `${clientInfo.id}:${clientInfo.name}`
				: clientInfo?.id || "unknown";

			if (
				!this.extensionClient ||
				this.extensionClient.readyState !== WebSocket.OPEN
			) {
				const errorResponse = {
					id: messageId,
					success: false,
					error: "Chrome extension not connected",
				};
				client.send(JSON.stringify(errorResponse));
				this.logger.logError(
					"BROP",
					commandType,
					connectionDisplay,
					"Extension not connected",
				);
				return;
			}

			// Add ID and type for extension processing
			data.id = messageId;
			data.type = "brop_command";

			// Store client for response routing
			this.pendingBropRequests.set(messageId, client);

			// Store command info for response logging
			this.pendingCommandInfo.set(messageId, {
				command: commandType,
				connection: connectionDisplay,
			});

			// Forward to extension
			this.extensionClient.send(JSON.stringify(data));
		} catch (error) {
			this.logger.logError("BROP", "parse", "unknown", error.message);
		}
	}

	processCdpMessage(clientId, message) {
		try {
			const data = JSON.parse(message);
			const method = data.method;
			const messageId = data.id;
			const sessionId = data.sessionId;

			this.logger.logSuccess("CDP", method, `${clientId}:${messageId}`);

			const clientInfo = this.cdpClients.get(clientId);
			if (!clientInfo) {
				this.logger.logError(
					"CDP",
					method,
					`${clientId}:${messageId}`,
					"Client not found",
				);
				return;
			}

			if (
				!this.extensionClient ||
				this.extensionClient.readyState !== WebSocket.OPEN
			) {
				const errorResponse = {
					id: messageId,
					error: { code: -32000, message: "Chrome extension not connected" },
				};
				clientInfo.ws.send(JSON.stringify(errorResponse));
				this.logger.logError(
					"CDP",
					method,
					`${clientId}:${messageId}`,
					"Extension not connected",
				);
				return;
			}

			// Store request info for response routing
			this.pendingCdpRequests.set(messageId, {
				clientId: clientId,
				originalClient: clientInfo.ws,
				method: method,
				sessionId: sessionId,
				originalParams: data.params,
				originalCommand: data,
			});

			// Track Target.createTarget commands for session management
			if (method === "Target.createTarget") {
				this.pendingTargetCreations = this.pendingTargetCreations || new Map();
				this.pendingTargetCreations.set(messageId, clientId);
			}

			// Forward CDP command to extension (wrapped as BROP_CDP)
			const extensionMessage = {
				type: "BROP_CDP",
				id: messageId,
				method: method,
				params: data.params || {},
				sessionId: sessionId,
				connectionId: clientId,
			};

			this.extensionClient.send(JSON.stringify(extensionMessage));
		} catch (error) {
			this.logger.logError("CDP", "parse", clientId, error.message);
		}
	}

	processExtensionMessage(message) {
		try {
			const data = JSON.parse(message);
			const messageType = data.type;

			if (messageType === "response") {
				const requestId = data.id;

				// Handle BROP responses
				if (this.pendingBropRequests.has(requestId)) {
					const client = this.pendingBropRequests.get(requestId);
					this.pendingBropRequests.delete(requestId);

					if (client.readyState === WebSocket.OPEN) {
						client.send(JSON.stringify(data));

						// Log BROP command result with connection display using stored command info
						const cmdInfo = this.pendingCommandInfo?.get(requestId);
						if (cmdInfo) {
							this.pendingCommandInfo.delete(requestId);
							if (data.success) {
								this.logger.logSuccess(
									"BROP",
									cmdInfo.command,
									cmdInfo.connection,
								);
							} else {
								this.logger.logError(
									"BROP",
									cmdInfo.command,
									cmdInfo.connection,
									data.error || "Unknown error",
								);
							}
						}
					}
					return;
				}

				// Handle CDP responses
				if (this.pendingCdpRequests.has(requestId)) {
					const requestInfo = this.pendingCdpRequests.get(requestId);
					this.pendingCdpRequests.delete(requestId);

					// Handle Target.createTarget response with session creation
					if (this.pendingTargetCreations?.has(requestId)) {
						const clientId = this.pendingTargetCreations.get(requestId);
						this.pendingTargetCreations.delete(requestId);

						if (data.result?.targetId) {
							const targetId = data.result.targetId;
							this.targetToClient.set(targetId, clientId);

							const clientInfo = this.cdpClients.get(clientId);
							if (clientInfo) {
								clientInfo.targets.add(targetId);
								// Send Target.attachedToTarget event
								this.sendTargetAttachedEvent(clientId, targetId);
							}
						}
					}

					// Send CDP response back to client
					if (requestInfo.originalClient.readyState === WebSocket.OPEN) {
						const cdpResponse = {
							id: requestId,
							result: data.result,
							error: data.error,
						};
						requestInfo.originalClient.send(JSON.stringify(cdpResponse));
					}
				}
			} else if (messageType === "cdp_event") {
				// Extension sending a CDP event
				this.routeCdpEvent(data);
			}
		} catch (error) {
			this.logger.logError("EXT", "parse", "extension", error.message);
		}
	}

	sendTargetAttachedEvent(clientId, targetId) {
		const sessionId = this.generateSessionId();

		// Create session mapping
		this.targetToSession.set(targetId, sessionId);
		this.sessionToTarget.set(sessionId, targetId);
		this.sessionChannels.set(sessionId, {
			clientId: clientId,
			targetId: targetId,
			created: Date.now(),
		});

		const clientInfo = this.cdpClients.get(clientId);
		if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
			const attachedEvent = {
				method: "Target.attachedToTarget",
				params: {
					sessionId: sessionId,
					targetInfo: {
						targetId: targetId,
						type: "page",
						title: "",
						url: "about:blank",
						attached: true,
						canAccessOpener: false,
						browserContextId: "default",
					},
					waitingForDebugger: false,
				},
			};

			clientInfo.ws.send(JSON.stringify(attachedEvent));
			this.logger.logSuccess(
				"CDP",
				"event:Target.attachedToTarget",
				`${clientId}:${targetId}`,
			);
		}
	}

	routeCdpEvent(eventData) {
		const method = eventData.method;
		const params = eventData.params;
		const tabId = eventData.tabId;
		const sessionId = eventData.sessionId;

		// Log the event for debugging
		this.logger.logSuccess("CDP", `event:${method}`, `tab_${tabId || 'unknown'}`);

		const cdpEventMessage = {
			method: method,
			params: params,
		};

		// Add sessionId if this is a session-specific event
		if (sessionId) {
			cdpEventMessage.sessionId = sessionId;
		}

		const messageStr = JSON.stringify(cdpEventMessage);

		// Route to appropriate CDP client(s)
		if (method.startsWith("Target.")) {
			// Browser-level events go to main browser client
			const mainClient = this.getMainBrowserClient();
			if (mainClient) {
				mainClient.ws.send(messageStr);
			}
		} else if (tabId) {
			// Tab-specific events route to session client
			const targetId = `tab_${tabId}`;
			const sessionClient = this.getSessionClientForTarget(targetId);
			if (sessionClient) {
				sessionClient.ws.send(messageStr);
			} else {
				// Fallback to main client
				const mainClient = this.getMainBrowserClient();
				if (mainClient) {
					mainClient.ws.send(messageStr);
				}
			}
		}
	}

	getMainBrowserClient() {
		for (const [clientId, clientInfo] of this.cdpClients) {
			if (
				clientInfo.isMainBrowser &&
				clientInfo.connected &&
				clientInfo.ws.readyState === WebSocket.OPEN
			) {
				return clientInfo;
			}
		}
		return null;
	}

	getSessionClientForTarget(targetId) {
		const sessionId = this.targetToSession.get(targetId);
		if (sessionId) {
			const sessionInfo = this.sessionChannels.get(sessionId);
			if (sessionInfo) {
				const clientInfo = this.cdpClients.get(sessionInfo.clientId);
				if (
					clientInfo?.connected &&
					clientInfo.ws.readyState === WebSocket.OPEN
				) {
					return clientInfo;
				}
			}
		}
		return null;
	}

	generateSessionId() {
		return Array.from({ length: 32 }, () =>
			Math.floor(Math.random() * 16)
				.toString(16)
				.toUpperCase(),
		).join("");
	}

	async shutdown() {
		this.log("🛑 Shutting down unified bridge server...");
		this.running = false;

		if (this.bropServer) this.bropServer.close();
		if (this.extensionServer) this.extensionServer.close();
		if (this.cdpServer) this.cdpServer.close();
		if (this.httpServer) this.httpServer.close();
	}
}

// Main function
async function main() {
	console.log("🌉 BROP Unified Bridge Server");
	console.log("=".repeat(50));
	console.log("🔧 BROP Port: 9225 (BROP clients)");
	console.log("🔌 Extension Port: 9224 (extension connects here)");
	console.log("🎭 CDP Port: 9222 (Playwright/CDP clients)");
	console.log("🌐 NO REAL CHROME DEPENDENCY");
	console.log("");

	const bridge = new UnifiedBridgeServer();

	// Setup signal handlers
	process.on("SIGINT", () => {
		console.log("🛑 Received SIGINT");
		bridge.shutdown().then(() => process.exit(0));
	});

	process.on("SIGTERM", () => {
		console.log("🛑 Received SIGTERM");
		bridge.shutdown().then(() => process.exit(0));
	});

	try {
		await bridge.startServers();
	} catch (error) {
		console.error("💥 Server error:", error);
		process.exit(1);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { UnifiedBridgeServer };
