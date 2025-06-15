import WebSocket from "ws";

class CDPRelayTester {
	constructor() {
		this.proxyWS = null;
		this.results = [];
	}

	async setup() {
		console.log("🚀 Setting up CDP Relay Test...");

		// Connect to our unified bridge CDP endpoint
		this.proxyWS = new WebSocket(
			"ws://localhost:9222/devtools/browser/brop-bridge-comprehensive-test",
		);

		await new Promise((resolve, reject) => {
			this.proxyWS.on("open", () => {
				console.log("✅ Connected to unified bridge CDP endpoint");
				resolve();
			});
			this.proxyWS.on("error", reject);
			setTimeout(() => reject(new Error("Connection timeout")), 5000);
		});
	}

	async runTests() {
		console.log("\n🧪 Running Comprehensive CDP Tests...\n");

		const tests = [
			{
				name: "Browser Version",
				command: { id: 1, method: "Browser.getVersion", params: {} },
			},
			{
				name: "Target Discovery",
				command: { id: 2, method: "Target.getTargets", params: {} },
			},
			{
				name: "Create Target",
				command: {
					id: 3,
					method: "Target.createTarget",
					params: { url: "about:blank" },
				},
			},
			{
				name: "Runtime Evaluation",
				command: {
					id: 4,
					method: "Runtime.evaluate",
					params: { expression: "2 + 2" },
				},
			},
			{
				name: "Page Navigation",
				command: {
					id: 5,
					method: "Page.navigate",
					params: { url: "https://example.com" },
				},
			},
			{
				name: "DOM Query",
				command: { id: 6, method: "DOM.getDocument", params: {} },
			},
		];

		for (const test of tests) {
			try {
				const result = await this.runTest(test.name, test.command);
				this.results.push({ test: test.name, success: !result.error, result });
				await new Promise((resolve) => setTimeout(resolve, 500));
			} catch (error) {
				this.results.push({
					test: test.name,
					success: false,
					error: error.message,
				});
			}
		}
	}

	runTest(testName, command) {
		return new Promise((resolve, reject) => {
			console.log(`Testing: ${testName}`);

			const timeout = setTimeout(() => {
				reject(new Error(`Timeout waiting for response to ${testName}`));
			}, 10000);

			const messageHandler = (data) => {
				try {
					const response = JSON.parse(data);
					if (response.id === command.id) {
						clearTimeout(timeout);
						this.proxyWS.off("message", messageHandler);

						if (response.error) {
							console.log(
								`  ❌ Error: ${response.error.message || JSON.stringify(response.error)}`,
							);
						} else {
							console.log(
								`  ✅ Success: ${JSON.stringify(response.result).substring(0, 100)}...`,
							);
						}
						resolve(response);
					}
				} catch (error) {
					clearTimeout(timeout);
					reject(error);
				}
			};

			this.proxyWS.on("message", messageHandler);
			this.proxyWS.send(JSON.stringify(command));
		});
	}

	printResults() {
		console.log("\n📊 Test Results Summary");
		console.log("========================");

		let passed = 0;
		let failed = 0;

		for (const result of this.results) {
			const status = result.success ? "✅" : "❌";
			console.log(
				`${status} ${result.test}: ${result.success ? "PASS" : "FAIL"}`,
			);
			if (!result.success && result.error) {
				console.log(`   Error: ${result.error}`);
			}

			if (result.success) passed++;
			else failed++;
		}

		console.log("\n========================");
		console.log(
			`Total: ${this.results.length}, Passed: ${passed}, Failed: ${failed}`,
		);

		if (failed === 0) {
			console.log("🎉 All CDP tests passed!");
			return true;
		}
		console.log("⚠️  Some CDP tests failed.");
		return false;
	}

	async cleanup() {
		console.log("\n🧹 Cleaning up...");
		if (this.proxyWS) this.proxyWS.close();
		console.log("✅ Cleanup complete");
	}
}

async function main() {
	console.log("🧪 Comprehensive CDP Relay Test");
	console.log("================================\n");

	const tester = new CDPRelayTester();
	let success = false;

	try {
		await tester.setup();
		await tester.runTests();
		success = tester.printResults();
	} catch (error) {
		console.error("❌ Test suite failed:", error);
	} finally {
		await tester.cleanup();
	}

	if (success) {
		console.log("\n🎉 Comprehensive test completed successfully!");
		process.exit(0);
	} else {
		console.log("\n💥 Some tests failed!");
		process.exit(1);
	}
}

main().catch(console.error);

export default CDPRelayTester;
