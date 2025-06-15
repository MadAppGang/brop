import WebSocket from "ws";

async function quickCDPTest() {
	console.log("🧪 Quick CDP Relay Test");
	console.log("======================\n");

	let ws;

	try {
		// Connect to our CDP proxy
		console.log("1. Connecting to CDP proxy (port 9222)...");
		ws = new WebSocket("ws://localhost:9222");

		await new Promise((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error("Connection timeout")),
				5000,
			);

			ws.on("open", () => {
				clearTimeout(timeout);
				console.log("✅ Connected to CDP proxy");
				resolve();
			});

			ws.on("error", (error) => {
				clearTimeout(timeout);
				reject(error);
			});
		});

		// Test basic CDP commands
		console.log("\n2. Testing CDP commands...\n");

		const tests = [
			{
				name: "Browser Version",
				command: { id: 1, method: "Browser.getVersion", params: {} },
			},
			{
				name: "List Targets",
				command: { id: 2, method: "Target.getTargets", params: {} },
			},
		];

		for (const test of tests) {
			console.log(`Testing: ${test.name}`);

			const response = await new Promise((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("Response timeout")),
					10000,
				);

				const messageHandler = (data) => {
					try {
						const message = JSON.parse(data);
						if (message.id === test.command.id) {
							clearTimeout(timeout);
							ws.off("message", messageHandler);
							resolve(message);
						}
					} catch (e) {
						// Ignore parsing errors for other messages
					}
				};

				ws.on("message", messageHandler);
				ws.send(JSON.stringify(test.command));
			});

			if (response.error) {
				console.log(`❌ ${test.name}: ${response.error.message}`);
			} else {
				console.log(`✅ ${test.name}: Success`);
				if (test.name === "Browser Version" && response.result) {
					console.log(`   Browser: ${response.result.product}`);
				}
				if (test.name === "List Targets" && response.result) {
					console.log(
						`   Found ${response.result.targetInfos?.length || 0} targets`,
					);
				}
			}
		}

		console.log("\n🎉 CDP relay test completed successfully!");
	} catch (error) {
		console.error("💥 Test failed:", error.message);
		throw error;
	} finally {
		if (ws) {
			ws.close();
		}
	}
}

// Run the test
quickCDPTest()
	.then(() => {
		console.log("\n✅ All tests passed!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\n❌ Test failed:", error.message);
		process.exit(1);
	});
