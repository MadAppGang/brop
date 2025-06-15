// CDP Server - Chrome DevTools Protocol Implementation
// This class handles all CDP commands using Chrome Extension APIs

class CDPServer {
	constructor() {
		this.pendingRequests = new Map(); // messageId -> { bridgeMessageId, connectionId }
		this.isConnected = true; // Always connected since we're inside Chrome
		this.attachedTabs = new Set();
		this.debuggerSessions = new Map(); // tabId -> sessionInfo

		this.setupCDPEventForwarding();
		console.log("🎭 CDP Server initialized using Chrome Extension APIs");
	}

	setupCDPEventForwarding() {
		// Forward CDP events from debugger to bridge
		chrome.debugger.onEvent.addListener((source, method, params) => {
			console.log(`🎭 CDP Event: ${method} from tab ${source.tabId}`);

			// Forward the event with proper session/target info
			if (this.onEventCallback) {
				const session = this.debuggerSessions.get(source.tabId);
				this.onEventCallback({
					type: "cdp_event",
					method: method,
					params: params,
					tabId: source.tabId,
					sessionId: session?.sessionId,
					targetId: session?.targetId || source.tabId.toString(),
				});
			}
		});

		// Handle debugger detach events
		chrome.debugger.onDetach.addListener((source, reason) => {
			console.log(
				`🎭 CDP Debugger detached from tab ${source.tabId}: ${reason}`,
			);
			this.attachedTabs.delete(source.tabId);
			this.debuggerSessions.delete(source.tabId);
		});

		// Clean up debugger sessions when tabs are closed
		chrome.tabs.onRemoved.addListener((tabId) => {
			if (this.attachedTabs.has(tabId)) {
				console.log(`🎭 Cleaning up CDP session for closed tab ${tabId}`);
				chrome.debugger.detach({ tabId }).catch(() => {
					// Ignore errors when tab is already gone
				});
				this.attachedTabs.delete(tabId);
				this.debuggerSessions.delete(tabId);
			}
		});

		console.log("🎭 CDP event forwarding set up");
	}

	// Process CDP command using Chrome Extension APIs
	async processCDPCommand(message, sendResponseCallback) {
		const { id, method, params, sessionId, connectionId } = message;

		console.log("🎭 CDP Server processing command:", {
			method: method,
			id: id,
			connectionId: connectionId,
			sessionId: sessionId,
			params: params,
		});

		if (!method) {
			console.error("🎭 ERROR: CDP method is undefined!", message);
			sendResponseCallback({
				type: "response",
				id: id,
				error: { code: -32600, message: "Invalid CDP command: missing method" },
			});
			return;
		}

		try {
			// Check domain to determine target type
			const domain = method.split(".")[0];
			const isBrowserDomain = domain === "Browser";
			const isTargetDomain = domain === "Target";

			console.log(
				`🎭 Method: ${method}, Domain: ${domain}, isBrowserDomain: ${isBrowserDomain}, isTargetDomain: ${isTargetDomain}`,
			);

			if (isBrowserDomain || isTargetDomain) {
				// Browser/Target domain - use Chrome extension APIs
				console.log(`🎭 Browser/Target domain command: ${method}`);
				const result = await this.handleBrowserTargetCommand(
					method,
					params || {},
				);

				sendResponseCallback({
					type: "response",
					id: id,
					result: result,
				});
			} else {
				// Non-browser domain - use tab target
				const tabId = this.getTabIdFromParams(params, sessionId);

				if (tabId) {
					// Use specified tab
					if (!this.attachedTabs.has(tabId)) {
						console.log(`🎭 Attaching debugger to tab ${tabId}`);
						try {
							await chrome.debugger.attach({ tabId }, "1.3");
							this.attachedTabs.add(tabId);
							console.log(`✅ Successfully attached to tab ${tabId}`);
						} catch (error) {
							if (error.message.includes("Another debugger is already attached")) {
								console.log(`🎭 Tab ${tabId} already has debugger attached - using existing connection`);
								this.attachedTabs.add(tabId);
							} else {
								console.error(`🎭 Failed to attach to tab ${tabId}:`, error.message);
								throw error;
							}
						}

						// Create session mapping for event routing
						if (!this.debuggerSessions.has(tabId)) {
							const sessionId = `session_${tabId}_${Date.now()}`;
							const targetId = tabId.toString();
							this.debuggerSessions.set(tabId, { sessionId, targetId });
							console.log(
								`🎭 Created session mapping: ${sessionId} -> ${targetId}`,
							);
						}
					}

					const result = await chrome.debugger.sendCommand(
						{ tabId },
						method,
						params || {},
					);

					console.log(`✅ Tab command ${method} completed`);
					sendResponseCallback({
						type: "response",
						id: id,
						result: result,
					});
				} else {
					// Find any available tab
					const tabs = await chrome.tabs.query({});
					const targetTab = tabs.find(
						(tab) =>
							tab.url &&
							!tab.url.startsWith("chrome-extension://") &&
							!tab.url.startsWith("chrome:"),
					);

					if (!targetTab) {
						throw new Error(`No suitable tab found for command ${method}`);
					}

					if (!this.attachedTabs.has(targetTab.id)) {
						console.log(`🎭 Attaching debugger to tab ${targetTab.id}`);
						try {
							await chrome.debugger.attach({ tabId: targetTab.id }, "1.3");
							this.attachedTabs.add(targetTab.id);
							console.log(`✅ Successfully attached to tab ${targetTab.id}`);
						} catch (error) {
							if (error.message.includes("Another debugger is already attached")) {
								console.log(`🎭 Tab ${targetTab.id} already has debugger attached - using existing connection`);
								this.attachedTabs.add(targetTab.id);
							} else {
								console.error(`🎭 Failed to attach to tab ${targetTab.id}:`, error.message);
								throw error;
							}
						}

						// Create session mapping for event routing
						if (!this.debuggerSessions.has(targetTab.id)) {
							const sessionId = `session_${targetTab.id}_${Date.now()}`;
							const targetId = targetTab.id.toString();
							this.debuggerSessions.set(targetTab.id, { sessionId, targetId });
							console.log(
								`🎭 Created session mapping: ${sessionId} -> ${targetId}`,
							);
						}
					}

					const result = await chrome.debugger.sendCommand(
						{ tabId: targetTab.id },
						method,
						params || {},
					);

					console.log(`✅ Tab command ${method} completed`);
					sendResponseCallback({
						type: "response",
						id: id,
						result: result,
					});
				}
			}
		} catch (error) {
			console.error(`🎭 CDP Server error forwarding ${method}:`, error);
			console.error("🎭 Error stack:", error.stack);

			try {
				sendResponseCallback({
					type: "response",
					id: id,
					error: {
						code: -32603,
						message: `CDP command failed: ${error.message}`,
					},
				});
			} catch (callbackError) {
				console.error("🎭 Error in callback:", callbackError);
			}
		}
	}

	getTabIdFromParams(params, sessionId) {
		// Try to get tab ID from sessionId first
		if (sessionId) {
			for (const [tabId, session] of this.debuggerSessions) {
				if (session.sessionId === sessionId) {
					return tabId;
				}
			}
		}

		// Try to get tab ID from targetId in params
		if (params?.targetId) {
			return this.getTabIdFromTarget(params.targetId);
		}

		// No tab ID found
		return null;
	}

	getTabIdFromTarget(targetId) {
		// Extract tab ID from target ID format: "tab_123456"
		if (targetId?.startsWith("tab_")) {
			const tabId = Number.parseInt(targetId.replace("tab_", ""));
			return Number.isNaN(tabId) ? null : tabId;
		}
		return null;
	}

	// Handle Browser and Target domain commands using Chrome extension APIs
	async handleBrowserTargetCommand(method, params) {
		switch (method) {
			// Browser domain
			case "Browser.getVersion":
				return await this.browserGetVersion();

			case "Browser.close":
				return await this.browserClose();

			case "Browser.setDownloadBehavior":
				return await this.browserSetDownloadBehavior(params);

			case "Browser.grantPermissions":
				return await this.browserGrantPermissions(params);

			// Target domain
			case "Target.getTargets":
				return await this.targetGetTargets();

			case "Target.createTarget":
				return await this.targetCreateTarget(params);

			case "Target.closeTarget":
				return await this.targetCloseTarget(params);

			case "Target.activateTarget":
				return await this.targetActivateTarget(params);

			case "Target.attachToTarget":
				return await this.targetAttachToTarget(params);

			case "Target.detachFromTarget":
				return await this.targetDetachFromTarget(params);

			case "Target.sendMessageToTarget":
				return await this.targetSendMessageToTarget(params);

			case "Target.setAutoAttach":
				return await this.targetSetAutoAttach(params);

			case "Target.setDiscoverTargets":
				return await this.targetSetDiscoverTargets(params);

			case "Target.getTargetInfo":
				return await this.targetGetTargetInfo(params);

			case "Target.createBrowserContext":
				return await this.targetCreateBrowserContext(params);

			default:
				throw new Error(`Unsupported Browser/Target command: ${method}`);
		}
	}

	// Browser.getVersion implementation
	async browserGetVersion() {
		try {
			const browserInfo = await chrome.runtime.getBrowserInfo();
			return {
				protocolVersion: "1.3",
				product: browserInfo.name || "Chrome",
				revision: "@0",
				userAgent: navigator.userAgent,
				jsVersion: browserInfo.version || "unknown",
			};
		} catch (error) {
			// Fallback if getBrowserInfo fails
			const manifest = chrome.runtime.getManifest();
			return {
				protocolVersion: "1.3",
				product: "Chrome",
				revision: "@0",
				userAgent: navigator.userAgent,
				jsVersion: manifest.version || "unknown",
			};
		}
	}

	// Browser.close implementation
	async browserClose() {
		const windows = await chrome.windows.getAll({ populate: false });
		for (const window of windows) {
			await chrome.windows.remove(window.id);
		}
		return {};
	}

	// Browser.setDownloadBehavior implementation
	async browserSetDownloadBehavior(params) {
		// In Chrome extension context, we can't control download behavior directly
		// Return success to keep Playwright happy
		console.log(
			"🎭 Browser.setDownloadBehavior called (stubbed in extension context)",
		);
		return {};
	}

	// Browser.grantPermissions implementation
	async browserGrantPermissions(params) {
		// In Chrome extension context, permissions are handled differently
		// Return success to keep Playwright happy
		console.log(
			"🎭 Browser.grantPermissions called (stubbed in extension context)",
		);
		return {};
	}

	// Target.getTargets implementation
	async targetGetTargets() {
		const targets = await new Promise((resolve) => {
			chrome.debugger.getTargets((targets) => {
				resolve(targets);
			});
		});

		const targetInfos = targets.map((target) => ({
			targetId: target.id,
			type: target.type,
			title: target.title || "",
			url: target.url || "",
			attached: target.attached || false,
			canAccessOpener: false,
		}));

		return { targetInfos };
	}

	// Target.createTarget implementation
	async targetCreateTarget(params) {
		const url = params.url || "about:blank";
		const width = params.width;
		const height = params.height;
		const newWindow = params.newWindow;

		let tab;
		if (newWindow) {
			const createData = { url };
			if (width && height) {
				createData.width = width;
				createData.height = height;
			}
			const window = await chrome.windows.create(createData);
			tab = window.tabs[0];
		} else {
			tab = await chrome.tabs.create({ url });
		}

		// Create session mapping for the new tab
		const targetId = tab.id.toString();
		const sessionId = `session_${targetId}_${Date.now()}`;
		this.debuggerSessions.set(tab.id, { sessionId, targetId });
		console.log(
			`🎭 Created session mapping for new target: ${sessionId} -> ${targetId}`,
		);

		return { targetId };
	}

	// Target.closeTarget implementation
	async targetCloseTarget(params) {
		const targetId = params.targetId;
		const tabId = Number.parseInt(targetId, 10);
		await chrome.tabs.remove(tabId);
		return { success: true };
	}

	// Target.activateTarget implementation
	async targetActivateTarget(params) {
		const targetId = params.targetId;
		const tabId = Number.parseInt(targetId, 10);

		// Get tab info to find its window
		const tab = await chrome.tabs.get(tabId);

		// Activate the tab
		await chrome.tabs.update(tabId, { active: true });

		// Focus the window
		await chrome.windows.update(tab.windowId, { focused: true });

		return {};
	}

	// Target.attachToTarget implementation
	async targetAttachToTarget(params) {
		const targetId = params.targetId;
		const tabId = Number.parseInt(targetId, 10);
		// const flatten = params.flatten !== false;

		await new Promise((resolve, reject) => {
			chrome.debugger.attach({ tabId }, "1.3", () => {
				if (chrome.runtime.lastError) {
					const error = chrome.runtime.lastError.message;
					if (error.includes("Another debugger is already attached")) {
						console.log(`🎭 Target.attachToTarget: Tab ${tabId} already has debugger - using existing connection`);
						this.attachedTabs.add(tabId);
						resolve();
					} else {
						reject(new Error(error));
					}
				} else {
					this.attachedTabs.add(tabId);
					console.log(`✅ Target.attachToTarget: Successfully attached to tab ${tabId}`);
					resolve();
				}
			});
		});

		// Generate a session ID
		const sessionId = `session_${targetId}_${Date.now()}`;
		this.debuggerSessions.set(tabId, { sessionId, targetId });

		return { sessionId };
	}

	// Target.detachFromTarget implementation
	async targetDetachFromTarget(params) {
		const sessionId = params.sessionId;

		// Find tab by session ID
		let tabId = null;
		for (const [tid, session] of this.debuggerSessions.entries()) {
			if (session.sessionId === sessionId) {
				tabId = tid;
				break;
			}
		}

		if (tabId) {
			await chrome.debugger.detach({ tabId });
			this.attachedTabs.delete(tabId);
			this.debuggerSessions.delete(tabId);
		}

		return {};
	}

	// Target.sendMessageToTarget implementation
	async targetSendMessageToTarget(params) {
		const sessionId = params.sessionId;
		const message = JSON.parse(params.message);

		// Find tab by session ID
		let tabId = null;
		for (const [tid, session] of this.debuggerSessions.entries()) {
			if (session.sessionId === sessionId) {
				tabId = tid;
				break;
			}
		}

		if (!tabId) {
			throw new Error(`Session not found: ${sessionId}`);
		}

		const result = await new Promise((resolve, reject) => {
			chrome.debugger.sendCommand(
				{ tabId },
				message.method,
				message.params || {},
				(result) => {
					if (chrome.runtime.lastError) {
						reject(new Error(chrome.runtime.lastError.message));
					} else {
						resolve(result);
					}
				},
			);
		});

		return result;
	}

	// Target.setAutoAttach implementation
	async targetSetAutoAttach(params) {
		const autoAttach = params.autoAttach;
		const waitForDebuggerOnStart = params.waitForDebuggerOnStart || false;
		const flatten = params.flatten !== false;

		// Store auto-attach settings for future tabs
		this.autoAttachSettings = { autoAttach, waitForDebuggerOnStart, flatten };
		
		console.log(`🎭 Target.setAutoAttach configured: autoAttach=${autoAttach} (extension context - stored for future tabs)`);

		// In Chrome extension context, we can't directly control auto-attach
		// but we can simulate the behavior by storing the settings
		// Return success to keep Playwright happy
		return {};
	}

	// Target.setDiscoverTargets implementation
	async targetSetDiscoverTargets(params) {
		// This command is not allowed in extension context
		// Return empty result instead of error for compatibility
		console.log(
			"🎭 Target.setDiscoverTargets not allowed in extension context",
		);
		return {};
	}

	// Target.getTargetInfo implementation
	async targetGetTargetInfo(params) {
		const targetId = params.targetId;
		
		// Try to parse as a tab ID
		const tabId = Number.parseInt(targetId, 10);
		if (!Number.isNaN(tabId)) {
			try {
				const tab = await chrome.tabs.get(tabId);
				return {
					targetInfo: {
						targetId: targetId,
						type: "page",
						title: tab.title || "",
						url: tab.url || "",
						attached: this.attachedTabs.has(tabId),
						canAccessOpener: false,
					}
				};
			} catch (error) {
				console.log(`🎭 Tab ${tabId} not found: ${error.message}`);
			}
		}

		// Fallback for unknown target
		return {
			targetInfo: {
				targetId: targetId,
				type: "other",
				title: "",
				url: "",
				attached: false,
				canAccessOpener: false,
			}
		};
	}

	// Target.createBrowserContext implementation
	async targetCreateBrowserContext(params) {
		// In Chrome extension context, we can't create isolated browser contexts
		// Return a fake context ID that we can track
		const browserContextId = `context_${Date.now()}`;
		
		console.log(`🎭 Target.createBrowserContext: Created fake context ${browserContextId} (extension context limitation)`);
		
		return {
			browserContextId: browserContextId
		};
	}

	// Set callback for event forwarding
	setEventCallback(callback) {
		this.onEventCallback = callback;
	}

	// Get connection status
	getStatus() {
		return {
			connected: this.isConnected,
			attachedTabs: this.attachedTabs.size,
			debuggerSessions: this.debuggerSessions.size,
		};
	}

	// Close connection and cleanup
	close() {
		// Detach from all tabs
		for (const tabId of this.attachedTabs) {
			chrome.debugger.detach({ tabId }).catch(() => {
				// Ignore errors during cleanup
			});
		}

		this.attachedTabs.clear();
		this.debuggerSessions.clear();
		this.isConnected = false;
	}
}

// Export for use in background scripts
if (typeof module !== "undefined" && module.exports) {
	module.exports = CDPServer;
} else {
	self.CDPServer = CDPServer;
}
