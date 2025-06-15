/**
 * Simple Wikipedia Text Extraction Test
 *
 * A simplified version that demonstrates text extraction from Wikipedia
 * without the full test framework complexity.
 */

import { chromium } from "playwright";

async function simpleWikipediaTest() {
	console.log("🌍 Simple Wikipedia Text Extraction Test");
	console.log("=".repeat(50));

	let browser = null;

	try {
		// Launch browser
		console.log("🚀 Launching browser...");
		browser = await chromium.launch({
			headless: false, // Set to true for headless mode
		});

		const page = await browser.newPage();

		// Navigate to Wikipedia
		console.log("📍 Navigating to Wikipedia...");
		await page.goto("https://en.wikipedia.org/wiki/Main_Page", {
			waitUntil: "domcontentloaded",
		});

		// Extract page title
		console.log("📖 Extracting page information...");
		const title = await page.title();
		console.log(`   Title: ${title}`);

		// Extract main heading
		const mainHeading = await page.textContent("h1");
		console.log(`   Main Heading: ${mainHeading}`);

		// Extract the first paragraph from the main content
		const firstParagraph = await page.textContent(
			"#mw-content-text .mw-parser-output p",
		);
		if (firstParagraph) {
			const preview =
				firstParagraph.length > 150
					? `${firstParagraph.substring(0, 147)}...`
					: firstParagraph;
			console.log(`   First Paragraph: ${preview}`);
		}

		// Extract featured article section
		console.log("🔍 Looking for featured content...");
		try {
			const featuredSection = await page.$$("#mp-tfa");
			if (featuredSection.length > 0) {
				const featuredText = await featuredSection[0].textContent();
				const featuredPreview =
					featuredText.length > 100
						? `${featuredText.substring(0, 97)}...`
						: featuredText;
				console.log(`   Featured Article: ${featuredPreview}`);
			} else {
				console.log("   Featured Article: Not found");
			}
		} catch (error) {
			console.log("   Featured Article: Error extracting");
		}

		// Extract some navigation links
		console.log("🔗 Extracting navigation links...");
		try {
			const navLinks = await page.$$eval("#p-navigation a", (links) =>
				links.slice(0, 5).map((link) => ({
					text: link.textContent.trim(),
					href: link.href,
				})),
			);

			console.log(`   Found ${navLinks.length} navigation links:`);
			for (const link of navLinks) {
				console.log(`      - ${link.text}`);
			}
		} catch (error) {
			console.log("   Navigation: Error extracting links");
		}

		// Test some basic DOM queries
		console.log("🧪 Testing DOM queries...");

		const elementsInfo = await page.evaluate(() => {
			return {
				paragraphs: document.querySelectorAll("p").length,
				links: document.querySelectorAll("a").length,
				images: document.querySelectorAll("img").length,
				headings: document.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
			};
		});

		console.log("   Page Statistics:");
		console.log(`      Paragraphs: ${elementsInfo.paragraphs}`);
		console.log(`      Links: ${elementsInfo.links}`);
		console.log(`      Images: ${elementsInfo.images}`);
		console.log(`      Headings: ${elementsInfo.headings}`);

		// Take a screenshot (optional)
		console.log("📸 Taking screenshot...");
		await page.screenshot({
			path: "tests/wikipedia-test-screenshot.png",
			fullPage: false,
		});
		console.log("   Screenshot saved: tests/wikipedia-test-screenshot.png");

		console.log("\n✅ Test completed successfully!");
		return true;
	} catch (error) {
		console.error("\n❌ Test failed:", error.message);
		return false;
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

// Run the test
simpleWikipediaTest()
	.then((success) => {
		process.exit(success ? 0 : 1);
	})
	.catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
