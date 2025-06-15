import readline from "node:readline";
import { chromium } from "playwright";
import WebSocket from "ws";

class InteractiveCDPTester {
	constructor() {
		this.browser = null;
		this.page = null;
		this.ws = null;
		this.messageId = 1;
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
	}

	async setup() {
		console.log("🚀 Starting Interactive CDP Test Environment\n");

		// Launch browser
		console.log("Launching browser with CDP...");
		this.browser = await chromium.launch({
			headless: false,
			args: ["--remote-debugging-port=9223"],
		});
		this.page = await this.browser.newPage();

		// Connect to proxy
		console.log("Connecting to CDP proxy (ws://localhost:9222)...");
		this.ws = new WebSocket("ws://localhost:9222");

		await new Promise((resolve, reject) => {
			this.ws.on("open", () => {
				console.log("✅ Connected to CDP proxy\n");
				resolve();
			});
			this.ws.on("error", reject);
		});

		// Setup message handling
		this.ws.on("message", (data) => {
			try {
				const response = JSON.parse(data);
				console.log("📨 Response:", JSON.stringify(response, null, 2));
			} catch (error) {
				console.log("📨 Raw response:", data.toString());
			}
		});
	}

	async sendCommand(method, params = {}) {
		const id = this.messageId++;
		const command = { id, method, params };

		console.log("📤 Sending:", JSON.stringify(command, null, 2));
		this.ws.send(JSON.stringify(command));
	}

	showHelp() {
		console.log("\n📚 Available Commands:");
		console.log("  version                    - Get browser version");
		console.log("  targets                    - List all targets");
		console.log("  navigate <url>             - Navigate to URL");
		console.log("  eval <expression>          - Evaluate JavaScript");
		console.log("  title                      - Get page title");
		console.log("  screenshot                 - Take screenshot");
		console.log("  create <url>               - Create new target");
		console.log("  document                   - Get DOM document");
		console.log("  custom <method> [params]   - Send custom CDP command");
		console.log("  help                       - Show this help");
		console.log("  exit                       - Exit the tester\n");
	}

	async handleInput(input) {
		const [command, ...args] = input.trim().split(" ");

		switch (command.toLowerCase()) {
			case "version":
				await this.sendCommand("Browser.getVersion");
				break;

			case "targets":
				await this.sendCommand("Target.getTargets");
				break;

			case "navigate":
				if (!args[0]) {
					console.log("❌ Usage: navigate <url>");
					break;
				}
				await this.sendCommand("Page.navigate", { url: args[0] });
				break;

			case "eval": {
				if (!args[0]) {
					console.log("❌ Usage: eval <expression>");
					break;
				}
				const expression = args.join(" ");
				await this.sendCommand("Runtime.evaluate", { expression });
				break;
			}

			case "title":
				await this.sendCommand("Runtime.evaluate", {
					expression: "document.title",
				});
				break;

			case "screenshot":
				await this.sendCommand("Page.captureScreenshot", { format: "png" });
				break;

			case "create": {
				const url = args[0] || "about:blank";
				await this.sendCommand("Target.createTarget", { url });
				break;
			}

			case "document":
				await this.sendCommand("DOM.getDocument");
				break;

			case "custom": {
				if (!args[0]) {
					console.log("❌ Usage: custom <method> [params as JSON]");
					break;
				}
				const method = args[0];
				let params = {};
				if (args[1]) {
					try {
						params = JSON.parse(args.slice(1).join(" "));
					} catch (error) {
						console.log("❌ Invalid JSON params:", error.message);
						break;
					}
				}
				await this.sendCommand(method, params);
				break;
			}

			case "help":
				this.showHelp();
				break;

			case "exit":
				return false;

			default:
				if (command) {
					console.log(`❌ Unknown command: ${command}`);
					console.log('Type "help" for available commands');
				}
				break;
		}

		return true;
	}

	async start() {
		await this.setup();
		this.showHelp();

		console.log("🎮 Interactive CDP Tester Ready!");
		console.log('Type commands below (type "help" for available commands):\n');

		while (true) {
			const input = await new Promise((resolve) => {
				this.rl.question("CDP> ", resolve);
			});

			const shouldContinue = await this.handleInput(input);
			if (!shouldContinue) break;
		}

		await this.cleanup();
	}

	async cleanup() {
		console.log("\n🧹 Cleaning up...");

		if (this.ws) {
			this.ws.close();
		}

		if (this.browser) {
			await this.browser.close();
		}

		this.rl.close();
		console.log("✅ Goodbye!");
	}
}

// Predefined test scenarios
const scenarios = {
	basic: async (tester) => {
		console.log("🧪 Running Basic Test Scenario\n");
		await tester.sendCommand("Browser.getVersion");
		await new Promise((resolve) => setTimeout(resolve, 1000));

		await tester.sendCommand("Target.getTargets");
		await new Promise((resolve) => setTimeout(resolve, 1000));

		await tester.sendCommand("Page.navigate", { url: "https://example.com" });
		await new Promise((resolve) => setTimeout(resolve, 3000));

		await tester.sendCommand("Runtime.evaluate", {
			expression: "document.title",
		});
	},

	advanced: async (tester) => {
		console.log("🧪 Running Advanced Test Scenario\n");
		await tester.sendCommand("Target.createTarget", {
			url: "https://httpbin.org/json",
		});
		await new Promise((resolve) => setTimeout(resolve, 2000));

		await tester.sendCommand("Runtime.evaluate", {
			expression:
				'fetch("/html").then(r => r.text()).then(html => html.length)',
		});
		await new Promise((resolve) => setTimeout(resolve, 1000));

		await tester.sendCommand("Page.captureScreenshot", { format: "png" });
	},
};

// Run the interactive tester
if (import.meta.url === `file://${process.argv[1]}`) {
	const tester = new InteractiveCDPTester();

	// Check for scenario argument
	const scenario = process.argv[2];

	if (scenario && scenarios[scenario]) {
		tester
			.setup()
			.then(() => scenarios[scenario](tester))
			.then(() => {
				console.log(`\n✅ ${scenario} scenario completed!`);
				return tester.cleanup();
			})
			.then(() => process.exit(0))
			.catch((error) => {
				console.error("❌ Scenario failed:", error);
				process.exit(1);
			});
	} else if (scenario) {
		console.log(`❌ Unknown scenario: ${scenario}`);
		console.log("Available scenarios:", Object.keys(scenarios).join(", "));
		process.exit(1);
	} else {
		tester.start().catch((error) => {
			console.error("❌ Interactive tester failed:", error);
			process.exit(1);
		});
	}
}

export default InteractiveCDPTester;
