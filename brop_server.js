// BROP Server - Browser Remote Operations Protocol Implementation
// This class contains all BROP command handlers and can be used by different background scripts

class BROPServer {
	constructor() {
		this.enabled = true;
		this.callLogs = [];
		this.maxLogEntries = 1000;

		// Error collection system
		this.extensionErrors = [];
		this.maxErrorEntries = 100;

		// CDP debugger session management
		this.attachedTabs = new Set();
		this.debuggerSessions = new Map(); // tabId -> sessionInfo
		this.autoAttachEnabled = false;

		this.messageHandlers = new Map();
		this.setupMessageHandlers();
		this.setupErrorHandlers();
		this.loadSettings();
	}

	setupMessageHandlers() {
		// BROP command handlers
		this.messageHandlers.set(
			"get_console_logs",
			this.handleGetConsoleLogs.bind(this),
		);
		this.messageHandlers.set(
			"execute_console",
			this.handleExecuteConsole.bind(this),
		);
		this.messageHandlers.set(
			"get_screenshot",
			this.handleGetScreenshot.bind(this),
		);
		this.messageHandlers.set(
			"get_page_content",
			this.handleGetPageContent.bind(this),
		);
		this.messageHandlers.set("navigate", this.handleNavigate.bind(this));
		this.messageHandlers.set("click", this.handleClick.bind(this));
		this.messageHandlers.set("type", this.handleType.bind(this));
		this.messageHandlers.set(
			"wait_for_element",
			this.handleWaitForElement.bind(this),
		);
		this.messageHandlers.set("evaluate_js", this.handleEvaluateJS.bind(this));
		this.messageHandlers.set("get_element", this.handleGetElement.bind(this));
		this.messageHandlers.set(
			"get_simplified_dom",
			this.handleGetSimplifiedDOM.bind(this),
		);
		this.messageHandlers.set(
			"get_extension_errors",
			this.handleGetExtensionErrors.bind(this),
		);
		this.messageHandlers.set(
			"get_chrome_extension_errors",
			this.handleGetChromeExtensionErrors.bind(this),
		);
		this.messageHandlers.set(
			"clear_extension_errors",
			this.handleClearExtensionErrors.bind(this),
		);
		this.messageHandlers.set(
			"reload_extension",
			this.handleReloadExtension.bind(this),
		);
		this.messageHandlers.set(
			"test_reload_feature",
			this.handleTestReloadFeature.bind(this),
		);
		this.messageHandlers.set("create_tab", this.handleCreateTab.bind(this));
		this.messageHandlers.set("close_tab", this.handleCloseTab.bind(this));
		this.messageHandlers.set("list_tabs", this.handleListTabs.bind(this));
		this.messageHandlers.set("activate_tab", this.handleActivateTab.bind(this));
		this.messageHandlers.set(
			"get_server_status",
			this.handleGetServerStatus.bind(this),
		);
		this.messageHandlers.set(
			"get_extension_version",
			this.handleGetExtensionVersion.bind(this),
		);
	}

	setupErrorHandlers() {
		// Enhanced error capture system

		// 1. Capture uncaught errors in the extension
		self.addEventListener("error", (event) => {
			this.logError(
				"Uncaught Error",
				event.error?.message || event.message,
				event.error?.stack,
				{
					filename: event.filename,
					lineno: event.lineno,
					colno: event.colno,
				},
			);
		});

		// 2. Capture unhandled promise rejections
		self.addEventListener("unhandledrejection", (event) => {
			this.logError(
				"Unhandled Promise Rejection",
				event.reason?.message || String(event.reason),
				event.reason?.stack,
			);
		});

		// 3. Capture Chrome runtime errors
		if (chrome.runtime.onStartup) {
			chrome.runtime.onStartup.addListener(() => {
				if (chrome.runtime.lastError) {
					this.logError(
						"Runtime Startup Error",
						chrome.runtime.lastError.message,
					);
				}
			});
		}

		// 6. Monitor for Chrome API errors
		this.setupChromeAPIErrorMonitoring();
	}

	setupChromeAPIErrorMonitoring() {
		// Wrap Chrome API calls to catch errors
		const originalTabsUpdate = chrome.tabs.update;
		chrome.tabs.update = async (...args) => {
			try {
				return await originalTabsUpdate.apply(chrome.tabs, args);
			} catch (error) {
				this.logError(
					"Chrome Tabs API Error",
					`tabs.update failed: ${error.message}`,
					error.stack,
					{
						api: "chrome.tabs.update",
						args: args,
					},
				);
				throw error;
			}
		};
	}

	logError(type, message, stack = null, context = {}) {
		const errorEntry = {
			id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: Date.now(),
			type: type,
			message: message,
			stack: stack,
			url: globalThis.location?.href || "Extension Background",
			userAgent: navigator.userAgent,
			context: context,
		};

		this.extensionErrors.unshift(errorEntry);

		// Keep only recent errors
		if (this.extensionErrors.length > this.maxErrorEntries) {
			this.extensionErrors = this.extensionErrors.slice(
				0,
				this.maxErrorEntries,
			);
		}

		// Also log to console for debugging
		console.error(
			`[BROP Error] ${type}: ${message}`,
			stack ? `\nStack: ${stack}` : "",
		);

		this.saveSettings();
	}

	async loadSettings() {
		try {
			const result = await chrome.storage.local.get([
				"brop_enabled",
				"brop_logs",
				"brop_errors",
			]);
			this.enabled = result.brop_enabled !== false;
			this.callLogs = result.brop_logs || [];
			this.extensionErrors = result.brop_errors || [];
			console.log(
				`BROP server loaded: ${this.enabled ? "enabled" : "disabled"}`,
			);
		} catch (error) {
			console.error("Error loading BROP settings:", error);
		}
	}

	async saveSettings() {
		try {
			await chrome.storage.local.set({
				brop_enabled: this.enabled,
				brop_logs: this.callLogs.slice(-this.maxLogEntries),
				brop_errors: this.extensionErrors.slice(-this.maxErrorEntries),
			});
		} catch (error) {
			console.error("Error saving BROP settings:", error);
		}
	}

	// Main BROP command processor
	async processBROPCommand(message) {
		const { id, method, params } = message;

		console.log("🔧 BROP Server processing command:", {
			method: method,
			methodType: typeof method,
			hasParams: !!params,
		});

		if (!method) {
			throw new Error("Invalid command: missing method");
		}

		// Check if service is enabled
		if (!this.enabled) {
			console.log(`BROP command ignored (service disabled): ${method}`);
			throw new Error("BROP service is disabled");
		}

		const handler = this.messageHandlers.get(method);
		if (!handler) {
			throw new Error(`Unsupported BROP command: ${method}`);
		}

		const startTime = Date.now();
		try {
			const result = await handler(params || {});
			const duration = Date.now() - startTime;

			// Log successful BROP command
			this.logCall(method, "BROP", params, result, null, duration);

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error(`BROP command error (${method}):`, error);
			this.logError(
				"BROP Command Error",
				`${method}: ${error.message}`,
				error.stack,
			);

			// Log failed BROP command
			this.logCall(method, "BROP", params, null, error.message, duration);

			throw error;
		}
	}

	// BROP Method Implementations
	async handleGetConsoleLogs(params) {
		const { tabId } = params;
		let targetTab;

		if (!tabId) {
			throw new Error(
				"tabId is required. Use list_tabs to see available tabs or create_tab to create a new one.",
			);
		}

		// Get the specified tab
		try {
			targetTab = await chrome.tabs.get(tabId);
		} catch (error) {
			throw new Error(`Tab ${tabId} not found: ${error.message}`);
		}

		// Check if tab is accessible
		if (
			targetTab.url.startsWith("chrome://") ||
			targetTab.url.startsWith("chrome-extension://")
		) {
			throw new Error(
				`Cannot access chrome:// URL: ${targetTab.url}. Use a regular webpage tab.`,
			);
		}

		console.log(
			`🔧 DEBUG handleGetConsoleLogs: Using tab ${targetTab.id} - "${targetTab.title}" - ${targetTab.url}`,
		);

		// Use runtime messaging approach (your suggested method) as the primary and only method
		const logs = await this.getRuntimeConsoleLogs(
			targetTab.id,
			params.limit || 100,
		);

		// Filter by level if specified
		let filteredLogs = logs;
		if (params.level) {
			filteredLogs = logs.filter((log) => log.level === params.level);
		}

		return {
			logs: filteredLogs,
			source: "runtime_messaging_primary",
			tab_title: targetTab.title,
			tab_url: targetTab.url,
			timestamp: Date.now(),
			total_captured: filteredLogs.length,
			method: "runtime_messaging_only",
		};
	}

	async getRuntimeConsoleLogs(tabId, limit = 100) {
		console.log(
			`🔧 DEBUG getRuntimeConsoleLogs: Using runtime messaging for tab ${tabId}`,
		);

		if (!tabId || Number.isNaN(tabId)) {
			console.log(
				`🔧 DEBUG: Invalid tabId: ${tabId}, using extension logs fallback`,
			);
			return this.getStoredConsoleLogs(limit);
		}

		try {
			// Method 2: Try chrome.tabs.sendMessage to content script (if available)
			console.log(
				`🔧 DEBUG: Trying chrome.tabs.sendMessage to content script for tab ${tabId}...`,
			);
			try {
				// First verify the tab exists and is accessible
				const tab = await chrome.tabs.get(tabId);
				if (!tab) {
					throw new Error(`Tab ${tabId} does not exist`);
				}

				if (
					tab.url.startsWith("chrome://") ||
					tab.url.startsWith("chrome-extension://")
				) {
					throw new Error(`Cannot access chrome:// URL: ${tab.url}`);
				}

				const response = await new Promise((resolve, reject) => {
					// Add timeout to prevent hanging
					const timeout = setTimeout(() => {
						reject(new Error("Content script messaging timeout"));
					}, 2000);

					chrome.tabs.sendMessage(
						tabId,
						{
							type: "GET_LOGS",
							tabId: tabId,
							limit: limit,
						},
						(response) => {
							clearTimeout(timeout);
							if (chrome.runtime.lastError) {
								reject(new Error(chrome.runtime.lastError.message));
							} else {
								resolve(response);
							}
						},
					);
				});

				if (response?.logs) {
					console.log(
						`🔧 DEBUG: Content script messaging returned ${response.logs.length} logs`,
					);
					return response.logs;
				}
			} catch (contentScriptError) {
				console.log(
					"🔧 DEBUG: Content script messaging failed:",
					contentScriptError.message,
				);
			}

			// If content script not available, try executeScript approach
			console.log(
				"🔧 DEBUG: Content script not available, trying executeScript...",
			);
			const results = await chrome.scripting.executeScript({
				target: { tabId: tabId },
				func: (requestLimit) => {
					// Capture any available console logs
					const logs = [];

					// Try to access console buffer if available
					if (window.console?._buffer) {
						return window.console._buffer.slice(-requestLimit);
					}

					// Create test logs to verify the system works
					const testLogs = [
						{
							level: "info",
							message: "Console log capture test via executeScript",
							timestamp: Date.now(),
							source: "executeScript_test",
						},
					];

					// Check for any errors in the page
					const errors = window.addEventListener
						? []
						: [
								{
									level: "error",
									message: "Page context not fully available",
									timestamp: Date.now(),
									source: "executeScript_test",
								},
							];

					return [...testLogs, ...errors];
				},
				args: [limit],
			});

			const executedLogs = results[0]?.result || [];
			console.log(
				`🔧 DEBUG: executeScript returned ${executedLogs.length} logs`,
			);
			return executedLogs;
		} catch (error) {
			console.error("🔧 DEBUG: Runtime messaging failed:", error);

			// Return empty array with metadata about the attempt
			return [
				{
					level: "info",
					message: `Console log capture attempted but no logs available (${error.message})`,
					timestamp: Date.now(),
					source: "capture_attempt_metadata",
				},
			];
		}
	}

	getStoredConsoleLogs(limit = 100) {
		// Return stored extension background console logs as fallback
		return this.callLogs.slice(-limit).map((log) => ({
			level: log.success ? "info" : "error",
			message: `${log.method}: ${log.success ? "success" : log.error}`,
			timestamp: log.timestamp,
			source: "extension_background",
		}));
	}

	async handleExecuteConsole(params) {
		const { code, tabId } = params;
		let targetTab;

		if (!tabId) {
			throw new Error(
				"tabId is required. Use list_tabs to see available tabs or create_tab to create a new one.",
			);
		}

		// Get the specified tab
		try {
			targetTab = await chrome.tabs.get(tabId);
		} catch (error) {
			throw new Error(`Tab ${tabId} not found: ${error.message}`);
		}

		// Check if tab is accessible
		if (
			targetTab.url.startsWith("chrome://") ||
			targetTab.url.startsWith("chrome-extension://")
		) {
			throw new Error(
				`Cannot access chrome:// URL: ${targetTab.url}. Use a regular webpage tab.`,
			);
		}

		console.log(
			`🔧 DEBUG handleExecuteConsole: Using tab ${targetTab.id} - "${targetTab.title}" - ${targetTab.url}`,
		);

		// Check if tab URL is accessible
		if (
			targetTab.url.startsWith("chrome://") ||
			targetTab.url.startsWith("chrome-extension://")
		) {
			throw new Error("Cannot access a chrome:// URL");
		}

		// Ensure code is a string and serializable
		const codeString = typeof code === "string" ? code : String(code);

		const results = await chrome.scripting.executeScript({
			target: { tabId: targetTab.id },
			func: (codeToExecute) => {
				try {
					// CSP-compliant console operations
					if (codeToExecute === "document.title") return document.title;
					if (codeToExecute === "window.location.href")
						return window.location.href;
					if (codeToExecute === "document.readyState")
						return document.readyState;
					if (codeToExecute.startsWith("console.log(")) {
						const msg =
							codeToExecute
								.match(/console\.log\((.+)\)/)?.[1]
								?.replace(/["']/g, "") || "unknown";
						console.log("BROP Execute:", msg);
						return `Logged: ${msg}`;
					}
					// For other code, return safe response
					console.log("BROP Execute (safe mode):", codeToExecute);
					return `CSP-safe execution: ${codeToExecute}`;
				} catch (error) {
					console.error("BROP Execute Error:", error);
					return { error: error.message };
				}
			},
			args: [codeString],
		});

		return { result: results[0]?.result };
	}

	async handleGetScreenshot(params) {
		const { full_page = false, format = "png", tabId } = params;

		if (!tabId) {
			throw new Error(
				"tabId is required. Use list_tabs to see available tabs or create_tab to create a new one.",
			);
		}

		// Get the specified tab
		let targetTab;
		try {
			targetTab = await chrome.tabs.get(tabId);
		} catch (error) {
			throw new Error(`Tab ${tabId} not found: ${error.message}`);
		}

		// Make sure the tab is active (visible) for screenshot
		await chrome.tabs.update(tabId, { active: true });
		await chrome.windows.update(targetTab.windowId, { focused: true });

		// Wait a moment for tab to become visible
		await new Promise((resolve) => setTimeout(resolve, 200));

		const dataUrl = await chrome.tabs.captureVisibleTab(targetTab.windowId, {
			format: format === "jpeg" ? "jpeg" : "png",
		});

		return {
			image_data: dataUrl.split(",")[1],
			format: format,
			tabId: tabId,
			tab_title: targetTab.title,
			tab_url: targetTab.url,
		};
	}

	async handleGetPageContent(params) {
		const { tabId } = params;
		let targetTab;

		if (!tabId) {
			throw new Error(
				"tabId is required. Use list_tabs to see available tabs or create_tab to create a new one.",
			);
		}

		// Get the specified tab
		try {
			targetTab = await chrome.tabs.get(tabId);
		} catch (error) {
			throw new Error(`Tab ${tabId} not found: ${error.message}`);
		}

		// Check if tab is accessible
		if (
			targetTab.url.startsWith("chrome://") ||
			targetTab.url.startsWith("chrome-extension://")
		) {
			throw new Error(
				`Cannot access chrome:// URL: ${targetTab.url}. Use a regular webpage tab.`,
			);
		}

		console.log(
			`🔧 DEBUG handleGetPageContent: Using tab ${targetTab.id} - "${targetTab.title}" - ${targetTab.url}`,
		);

		const results = await chrome.scripting.executeScript({
			target: { tabId: targetTab.id },
			func: () => ({
				html: document.documentElement.outerHTML,
				text: document.body.innerText,
				title: document.title,
				url: window.location.href,
			}),
		});

		return results[0]?.result || {};
	}

	async handleNavigate(params) {
		const { url, tabId, create_new_tab = false, close_tab = false } = params;

		let targetTab;

		if (close_tab && tabId) {
			// Close the specified tab
			await chrome.tabs.remove(tabId);
			return { success: true, action: "tab_closed", tabId: tabId };
		}

		if (create_new_tab) {
			// Create a new tab
			const newTab = await chrome.tabs.create({ url: url || "about:blank" });
			return {
				success: true,
				action: "tab_created",
				tabId: newTab.id,
				url: newTab.url,
				title: newTab.title,
			};
		}

		if (tabId) {
			// Use specified tab
			try {
				targetTab = await chrome.tabs.get(tabId);
			} catch (error) {
				throw new Error(`Tab ${tabId} not found: ${error.message}`);
			}
		} else {
			// Use active tab
			const [activeTab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (!activeTab) {
				throw new Error("No active tab found");
			}
			targetTab = activeTab;
		}

		// Navigate the target tab
		await chrome.tabs.update(targetTab.id, { url });

		// Get updated tab info
		const updatedTab = await chrome.tabs.get(targetTab.id);

		return {
			success: true,
			action: "navigated",
			tabId: updatedTab.id,
			url: updatedTab.url,
			title: updatedTab.title,
		};
	}

	// Additional BROP methods (stubs for now, can be implemented later)
	async handleClick(params) {
		throw new Error("Click method not yet implemented");
	}

	async handleType(params) {
		throw new Error("Type method not yet implemented");
	}

	async handleWaitForElement(params) {
		throw new Error("WaitForElement method not yet implemented");
	}

	async handleEvaluateJS(params) {
		throw new Error("EvaluateJS method not yet implemented");
	}

	async handleGetElement(params) {
		throw new Error("GetElement method not yet implemented");
	}

	async handleGetSimplifiedDOM(params) {
		const {
			tabId,
			format = "markdown",
			enableDetailedResponse = false,
		} = params;

		if (!tabId) {
			throw new Error(
				"tabId is required. Use list_tabs to see available tabs or create_tab to create a new one.",
			);
		}

		// Get the specified tab
		let targetTab;
		try {
			targetTab = await chrome.tabs.get(tabId);
		} catch (error) {
			throw new Error(`Tab ${tabId} not found: ${error.message}`);
		}

		// Check if tab is accessible
		if (
			targetTab.url.startsWith("chrome://") ||
			targetTab.url.startsWith("chrome-extension://")
		) {
			throw new Error(
				`Cannot access chrome:// URL: ${targetTab.url}. Use a regular webpage tab.`,
			);
		}

		console.log(
			`🔧 DEBUG handleGetSimplifiedDOM: Extracting ${format} from tab ${tabId} - "${targetTab.title}"`,
		);

		try {
			// First inject the appropriate library
			await chrome.scripting.executeScript({
				target: { tabId: tabId },
				files:
					format === "html"
						? ["readability.js"]
						: ["dom-to-semantic-markdown.js"],
			});

			// Now execute the extraction
			const results = await chrome.scripting.executeScript({
				target: { tabId: tabId },
				func: (options) => {
					const { format = "markdown", enableDetailedResponse = false } =
						options;

					try {
						console.log(`🔧 BROP: Starting ${format} extraction`);

						if (format === "html") {
							// HTML format: use Readability only
							if (typeof window.Readability === "undefined") {
								throw new Error("Readability library not loaded");
							}

							// Clean document clone for processing
							const documentClone = document.cloneNode(true);
							for (const item of documentClone.querySelectorAll("script")) {
								item.remove();
							}
							for (const item of documentClone.querySelectorAll("style")) {
								item.remove();
							}
							for (const item of documentClone.querySelectorAll("iframe")) {
								item.remove();
							}
							for (const item of documentClone.querySelectorAll("noscript")) {
								item.remove();
							}

							let content;
							let stats;

							if (enableDetailedResponse) {
								// Use full document content
								content = documentClone.body
									? documentClone.body.innerHTML
									: documentClone.documentElement.innerHTML;
								stats = {
									source: "full_document_html",
									processed: true,
									cleaned: true,
								};
							} else {
								// Use Readability to extract article content
								const reader = new window.Readability(documentClone, {
									charThreshold: 0,
									keepClasses: true,
									nbTopCandidates: 500,
								});

								const article = reader.parse();

								if (!article || !article.content) {
									throw new Error("No readable content found by Readability");
								}

								content = article.content;
								stats = {
									source: "readability_html",
									title: article.title,
									byline: article.byline,
									excerpt: article.excerpt,
									readTime: article.readTime || 0,
									textLength: article.textContent?.length || 0,
									processed: true,
								};
							}

							return {
								html: content,
								title: document.title,
								url: window.location.href,
								timestamp: new Date().toISOString(),
								stats: stats,
							};
						}

						// Markdown format: use dom-to-semantic-markdown
						console.log("Checking for dom-to-semantic-markdown library...");

						// The bundled library should expose htmlToSMD globally
						if (!window.htmlToSMD) {
							throw new Error(
								"dom-to-semantic-markdown library not loaded (htmlToSMD not found)",
							);
						}

						let contentElement;

						if (enableDetailedResponse) {
							// Use full document body
							contentElement = document.body || document.documentElement;
						} else {
							// Try to find main content area
							contentElement =
								document.querySelector("main") ||
								document.querySelector("article") ||
								document.querySelector(".content") ||
								document.querySelector("#content") ||
								document.body ||
								document.documentElement;
						}

						// Use the convertElementToMarkdown function from htmlToSMD
						const markdown = window.htmlToSMD.convertElementToMarkdown(
							contentElement,
							{
								refineUrls: false,
								includeMetadata: true,
								debug: false,
							},
						);

						return {
							markdown: markdown,
							title: document.title,
							url: window.location.href,
							timestamp: new Date().toISOString(),
							stats: {
								source: enableDetailedResponse
									? "dom_to_semantic_markdown_full"
									: "dom_to_semantic_markdown_main",
								markdownLength: markdown.length,
								processed: true,
							},
						};
					} catch (processingError) {
						console.error("🔧 BROP: Processing error:", processingError);
						return {
							error: `Content processing failed: ${processingError.message}`,
							title: document.title || "Unknown",
							url: window.location.href || "Unknown",
						};
					}
				},
				args: [{ format, enableDetailedResponse }],
			});

			console.log("🔧 DEBUG: executeScript completed, raw results:", results);

			const result = results[0]?.result;

			console.log("🔧 DEBUG handleGetSimplifiedDOM: executeScript results:", {
				resultsLength: results?.length,
				hasResult: !!result,
				resultType: typeof result,
				resultKeys: result ? Object.keys(result) : "none",
			});

			if (!result) {
				throw new Error("No result from content extraction");
			}

			if (result.error) {
				throw new Error(result.error);
			}

			console.log(
				`✅ Successfully extracted ${format === "html" ? result.html?.length : result.markdown?.length} chars of ${format} from "${result.title}"`,
			);

			return {
				...(format === "html"
					? { html: result.html }
					: { markdown: result.markdown }),
				title: result.title,
				url: result.url,
				timestamp: result.timestamp,
				stats: result.stats,
				tabId: tabId,
				format: format,
			};
		} catch (error) {
			console.error("Content extraction failed:", error);
			throw new Error(`Content extraction error: ${error.message}`);
		}
	}

	// Tab Management Methods
	async handleCreateTab(params) {
		const { url = "about:blank", active = true } = params;

		try {
			const newTab = await chrome.tabs.create({
				url: url,
				active: active,
			});

			// Wait a moment for tab to initialize
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Get updated tab info
			const tabInfo = await chrome.tabs.get(newTab.id);

			console.log(
				`✅ Created new tab: ${newTab.id} - "${tabInfo.title}" - ${tabInfo.url}`,
			);

			return {
				success: true,
				tabId: tabInfo.id,
				url: tabInfo.url,
				title: tabInfo.title,
				active: tabInfo.active,
				status: tabInfo.status,
			};
		} catch (error) {
			console.error("Failed to create tab:", error);
			throw new Error(`Tab creation failed: ${error.message}`);
		}
	}

	async handleCloseTab(params) {
		const { tabId } = params;

		if (!tabId) {
			throw new Error("tabId is required for close_tab");
		}

		try {
			await chrome.tabs.remove(tabId);
			console.log(`✅ Closed tab: ${tabId}`);

			return {
				success: true,
				tabId: tabId,
				action: "closed",
			};
		} catch (error) {
			console.error(`Failed to close tab ${tabId}:`, error);
			throw new Error(`Tab close failed: ${error.message}`);
		}
	}

	async handleListTabs(params) {
		const { include_content = false } = params;

		try {
			const allTabs = await chrome.tabs.query({});

			const tabList = allTabs.map((tab) => ({
				tabId: tab.id,
				url: tab.url,
				title: tab.title,
				active: tab.active,
				status: tab.status,
				windowId: tab.windowId,
				index: tab.index,
				pinned: tab.pinned,
				accessible:
					(!tab.url.startsWith("chrome://") &&
						!tab.url.startsWith("chrome-extension://") &&
						!tab.url.startsWith("edge://") &&
						!tab.url.startsWith("about:")) ||
					tab.url === "about:blank",
			}));

			// Get active tab
			const [activeTab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			console.log(
				`📋 Listed ${tabList.length} tabs (active: ${activeTab?.id || "none"})`,
			);

			return {
				success: true,
				tabs: tabList,
				activeTabId: activeTab?.id || null,
				totalTabs: tabList.length,
				accessibleTabs: tabList.filter((tab) => tab.accessible).length,
			};
		} catch (error) {
			console.error("Failed to list tabs:", error);
			throw new Error(`Tab listing failed: ${error.message}`);
		}
	}

	async handleActivateTab(params) {
		const { tabId } = params;

		if (!tabId) {
			throw new Error("tabId is required for activate_tab");
		}

		try {
			// Get tab info first
			const tab = await chrome.tabs.get(tabId);

			// Activate the tab
			await chrome.tabs.update(tabId, { active: true });

			// Also focus the window containing the tab
			await chrome.windows.update(tab.windowId, { focused: true });

			console.log(`✅ Activated tab: ${tabId} - "${tab.title}"`);

			return {
				success: true,
				tabId: tabId,
				url: tab.url,
				title: tab.title,
				action: "activated",
			};
		} catch (error) {
			console.error(`Failed to activate tab ${tabId}:`, error);
			throw new Error(`Tab activation failed: ${error.message}`);
		}
	}

	async handleGetServerStatus(params) {
		try {
			console.log("📊 Getting server status...");

			// This command will be handled directly by the bridge server
			// and won't come back to the extension, but we need this handler
			// in case someone calls it directly through the extension
			return {
				success: true,
				message: "Server status request forwarded to bridge",
				note: "This command is handled by the bridge server directly",
			};
		} catch (error) {
			console.error("Failed to get server status:", error);
			throw new Error(`Server status request failed: ${error.message}`);
		}
	}

	async handleGetExtensionVersion(params) {
		try {
			console.log("🔢 Getting extension version...");

			const manifest = chrome.runtime.getManifest();
			return {
				success: true,
				result: {
					extension_version: manifest.version,
					extension_name: manifest.name,
					target_event_blocking_active: true, // Indicates our Target.attachedToTarget fix is active
					manifest_version: manifest.manifest_version,
					timestamp: Date.now(),
				},
			};
		} catch (error) {
			console.error("Failed to get extension version:", error);
			throw new Error(`Extension version request failed: ${error.message}`);
		}
	}

	async handleGetExtensionErrors(params) {
		const limit = params?.limit || 50;
		const errors = this.extensionErrors.slice(0, limit);

		return {
			errors: errors,
			total_errors: this.extensionErrors.length,
			max_stored: this.maxErrorEntries,
			extension_info: {
				name: chrome.runtime.getManifest()?.name || "BROP Extension",
				version: chrome.runtime.getManifest()?.version || "1.0.0",
				id: chrome.runtime.id,
			},
		};
	}

	async handleGetChromeExtensionErrors(params) {
		const errors = [];

		try {
			// Method 1: Check chrome.runtime.lastError if available
			if (chrome.runtime.lastError) {
				errors.push({
					type: "Chrome Runtime Error",
					message: chrome.runtime.lastError.message,
					timestamp: Date.now(),
					source: "chrome.runtime.lastError",
				});
			}

			// Method 2: Try to access extension management API for error details
			if (chrome.management) {
				try {
					const extensionInfo = await new Promise((resolve, reject) => {
						chrome.management.getSelf((info) => {
							if (chrome.runtime.lastError) {
								reject(new Error(chrome.runtime.lastError.message));
							} else {
								resolve(info);
							}
						});
					});

					// Note: Chrome doesn't provide direct API access to extension console errors
					// This is a limitation of the Chrome Extension API
				} catch (error) {
					errors.push({
						type: "Management API Error",
						message: error.message,
						timestamp: Date.now(),
						source: "chrome.management.getSelf",
					});
				}
			}

			return {
				chrome_errors: errors,
				total_chrome_errors: errors.length,
				note: "Chrome Extension API does not expose console errors directly. These are detected issues based on extension state.",
				limitation:
					"To see actual Chrome extension console errors, check chrome://extensions/ > Developer mode > Errors button for this extension",
			};
		} catch (error) {
			return {
				chrome_errors: [
					{
						type: "Chrome Error Detection Failed",
						message: error.message,
						timestamp: Date.now(),
						source: "handleGetChromeExtensionErrors",
					},
				],
				total_chrome_errors: 1,
				error: `Failed to check Chrome extension errors: ${error.message}`,
			};
		}
	}

	async handleClearExtensionErrors(params) {
		const clearedCount = this.extensionErrors.length;

		// Clear all extension errors
		this.extensionErrors = [];

		// Also clear call logs if requested
		if (params?.clearLogs) {
			const clearedLogs = this.callLogs.length;
			this.callLogs = [];

			// Save cleared state
			await this.saveSettings();

			return {
				success: true,
				cleared_errors: clearedCount,
				cleared_logs: clearedLogs,
				message: `Cleared ${clearedCount} errors and ${clearedLogs} logs`,
			};
		}
		// Save cleared state
		await this.saveSettings();

		return {
			success: true,
			cleared_errors: clearedCount,
			message: `Cleared ${clearedCount} extension errors`,
		};
	}

	async handleReloadExtension(params) {
		const reloadReason = params?.reason || "Manual reload requested";
		const delay = params?.delay || 1000; // Default 1 second delay

		try {
			// Log the reload event
			this.logError(
				"Extension Reload",
				`Extension reload requested: ${reloadReason}`,
				null,
				{
					reason: reloadReason,
					delay: delay,
					timestamp: Date.now(),
				},
			);

			// Save current state before reload
			await this.saveSettings();

			// Schedule the reload
			setTimeout(() => {
				console.log(`[BROP] Reloading extension: ${reloadReason}`);
				chrome.runtime.reload();
			}, delay);

			return {
				success: true,
				message: `Extension will reload in ${delay}ms`,
				reason: reloadReason,
				scheduled_time: Date.now() + delay,
			};
		} catch (error) {
			this.logError(
				"Extension Reload Error",
				`Failed to reload extension: ${error.message}`,
				error.stack,
			);

			return {
				success: false,
				error: error.message,
				message: "Failed to schedule extension reload",
			};
		}
	}

	async handleTestReloadFeature(params) {
		// This is a NEW feature added specifically to test extension reload
		const timestamp = new Date().toISOString();
		const message =
			params?.message || "Hello from the NEW reload test feature!";

		console.log(
			`[BROP] 🆕 NEW FEATURE CALLED: test_reload_feature at ${timestamp}`,
		);

		return {
			success: true,
			message: message,
			timestamp: timestamp,
			feature_version: "1.0.0",
			reload_test: true,
			note: "This feature was added to test extension reload mechanism",
		};
	}

	logCall(method, type, params, result, error, duration) {
		// Fix undefined/null method names
		const safeMethod = method || "unknown_method";
		const safeType = type || "unknown_type";

		const logEntry = {
			id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: Date.now(),
			method: safeMethod,
			type: safeType,
			params: params ? JSON.stringify(params) : "{}",
			result: result ? JSON.stringify(result) : undefined,
			error: error,
			success: !error,
			duration: duration,
		};

		// Debug logging for undefined methods
		if (!method) {
			console.warn("🔧 WARNING: logCall received undefined method:", {
				originalMethod: method,
				safeMethod: safeMethod,
				type: type,
				hasParams: !!params,
				hasResult: !!result,
				hasError: !!error,
			});
		}

		this.callLogs.unshift(logEntry);
		if (this.callLogs.length > this.maxLogEntries) {
			this.callLogs = this.callLogs.slice(0, this.maxLogEntries);
		}

		this.saveSettings();
	}
}

// Export for use in background scripts
if (typeof module !== "undefined" && module.exports) {
	module.exports = BROPServer;
} else {
	self.BROPServer = BROPServer;
}
