#!/usr/bin/env node

/**
 * Test script for the bridge server
 * Tests both BROP and CDP functionality
 */

import WebSocket from "ws";

class UnifiedBridgeTest {
	constructor() {
		this.bropWs = null;
		this.cdpWs = null;
		this.testResults = [];
	}

	async runTests() {
		console.log("🧪 Starting Unified Bridge Server Tests");
		console.log("=".repeat(50));

		try {
			// Test 1: BROP connection
			await this.testBropConnection();

			// Test 2: CDP connection
			await this.testCdpConnection();

			// Test 3: CDP discovery
			await this.testCdpDiscovery();

			// Test 4: Protocol separation
			await this.testProtocolSeparation();

			this.printResults();
		} catch (error) {
			console.error("❌ Test suite failed:", error);
		} finally {
			this.cleanup();
		}
	}

	async testBropConnection() {
		console.log("\n🔧 Test 1: BROP Connection");

		return new Promise((resolve, reject) => {
			this.bropWs = new WebSocket("ws://localhost:9225?name=test-client");

			this.bropWs.on("open", () => {
				console.log("✅ BROP connection established");
				this.testResults.push({ test: "BROP Connection", status: "PASS" });
				resolve();
			});

			this.bropWs.on("error", (error) => {
				console.log("❌ BROP connection failed:", error.message);
				this.testResults.push({
					test: "BROP Connection",
					status: "FAIL",
					error: error.message,
				});
				reject(error);
			});

			setTimeout(() => {
				reject(new Error("BROP connection timeout"));
			}, 5000);
		});
	}

	async testCdpConnection() {
		console.log("\n🎭 Test 2: CDP Connection");

		return new Promise((resolve, reject) => {
			this.cdpWs = new WebSocket(
				"ws://localhost:9222/devtools/browser/test-browser-session",
			);

			this.cdpWs.on("open", () => {
				console.log("✅ CDP connection established");
				this.testResults.push({ test: "CDP Connection", status: "PASS" });
				resolve();
			});

			this.cdpWs.on("error", (error) => {
				console.log("❌ CDP connection failed:", error.message);
				this.testResults.push({
					test: "CDP Connection",
					status: "FAIL",
					error: error.message,
				});
				reject(error);
			});

			setTimeout(() => {
				reject(new Error("CDP connection timeout"));
			}, 5000);
		});
	}

	async testCdpDiscovery() {
		console.log("\n🌐 Test 3: CDP Discovery Endpoints");

		try {
			// Test /json/version
			const versionResponse = await fetch("http://localhost:9222/json/version");
			const versionData = await versionResponse.json();

			if (versionData.Browser && versionData["Protocol-Version"]) {
				console.log("✅ /json/version endpoint working");
				console.log(`   Browser: ${versionData.Browser}`);
				console.log(`   Protocol: ${versionData["Protocol-Version"]}`);
				this.testResults.push({
					test: "CDP Discovery /json/version",
					status: "PASS",
				});
			} else {
				throw new Error("Invalid version response format");
			}

			// Test /json/list
			const listResponse = await fetch("http://localhost:9222/json/list");
			const listData = await listResponse.json();

			if (Array.isArray(listData) && listData.length > 0) {
				console.log("✅ /json/list endpoint working");
				console.log(`   Found ${listData.length} target(s)`);
				this.testResults.push({
					test: "CDP Discovery /json/list",
					status: "PASS",
				});
			} else {
				throw new Error("Invalid list response format");
			}
		} catch (error) {
			console.log("❌ CDP discovery failed:", error.message);
			this.testResults.push({
				test: "CDP Discovery",
				status: "FAIL",
				error: error.message,
			});
			throw error;
		}
	}

	async testProtocolSeparation() {
		console.log("\n🔀 Test 4: Protocol Separation");

		return new Promise((resolve, reject) => {
			if (!this.bropWs || !this.cdpWs) {
				const error = new Error("Missing connections for protocol test");
				this.testResults.push({
					test: "Protocol Separation",
					status: "FAIL",
					error: error.message,
				});
				reject(error);
				return;
			}

			let bropResponseReceived = false;
			let cdpResponseReceived = false;

			// Set up message handlers
			this.bropWs.on("message", (data) => {
				const message = JSON.parse(data.toString());
				if (message.id === "brop-test-1") {
					console.log("✅ BROP protocol response received");
					bropResponseReceived = true;
					checkComplete();
				}
			});

			this.cdpWs.on("message", (data) => {
				const message = JSON.parse(data.toString());
				if (message.id === "cdp-test-1") {
					console.log("✅ CDP protocol response received");
					cdpResponseReceived = true;
					checkComplete();
				}
			});

			const checkComplete = () => {
				if (bropResponseReceived && cdpResponseReceived) {
					console.log("✅ Protocol separation working correctly");
					this.testResults.push({
						test: "Protocol Separation",
						status: "PASS",
					});
					resolve();
				}
			};

			// Send test messages
			setTimeout(() => {
				// Send BROP command
				this.bropWs.send(
					JSON.stringify({
						id: "brop-test-1",
						method: "get_server_status",
					}),
				);

				// Send CDP command
				this.cdpWs.send(
					JSON.stringify({
						id: "cdp-test-1",
						method: "Browser.getVersion",
					}),
				);
			}, 100);

			// Timeout
			setTimeout(() => {
				if (!bropResponseReceived || !cdpResponseReceived) {
					const error = new Error(
						`Protocol separation incomplete - BROP: ${bropResponseReceived}, CDP: ${cdpResponseReceived}`,
					);
					this.testResults.push({
						test: "Protocol Separation",
						status: "FAIL",
						error: error.message,
					});
					reject(error);
				}
			}, 10000);
		});
	}

	printResults() {
		console.log("\n📊 Test Results");
		console.log("=".repeat(50));

		let passed = 0;
		let failed = 0;

		for (const result of this.testResults) {
			const status = result.status === "PASS" ? "✅" : "❌";
			console.log(`${status} ${result.test}: ${result.status}`);
			if (result.error) {
				console.log(`   Error: ${result.error}`);
			}

			if (result.status === "PASS") passed++;
			else failed++;
		}

		console.log(`\n${"=".repeat(50)}`);
		console.log(
			`Total: ${this.testResults.length}, Passed: ${passed}, Failed: ${failed}`,
		);

		if (failed === 0) {
			console.log(
				"🎉 All tests passed! Unified bridge server is working correctly.",
			);
		} else {
			console.log(
				"⚠️  Some tests failed. Check the bridge server and extension.",
			);
		}
	}

	cleanup() {
		if (this.bropWs) {
			this.bropWs.close();
		}
		if (this.cdpWs) {
			this.cdpWs.close();
		}
	}
}

// Run tests
const tester = new UnifiedBridgeTest();
tester.runTests().catch(console.error);
