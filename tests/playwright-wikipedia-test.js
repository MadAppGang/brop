/**
 * Simple Playwright Wikipedia Test
 *
 * This test connects to an existing Chrome instance (via CDP) instead of launching a new one.
 * It extracts text from Wikipedia using simple, direct function calls.
 */

import { chromium } from "playwright";

async function testWikipediaExtraction() {
	console.log("🌍 Simple Playwright Wikipedia Test");
	console.log("=".repeat(50));

	let browser = null;
	let page = null;

	try {
		// Connect to existing CDP instance
		console.log("🔗 Connecting to existing Chrome CDP...");
		browser = await chromium.connectOverCDP("http://localhost:9222");

		// Create a new page
		console.log("📄 Creating new page...");
		page = await browser.newPage();

		// Navigate to Wikipedia
		console.log("🌍 Navigating to Wikipedia...");
		await page.goto("https://en.wikipedia.org/wiki/Main_Page");

		// Extract page title
		console.log("\n📖 Extracting content...");
		const title = await page.title();
		console.log(`   Title: ${title}`);

		// Extract main heading
		const mainHeading = await page.textContent("h1");
		console.log(`   Main Heading: ${mainHeading}`);

		// Extract first paragraph
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
		console.log("\n🔍 Looking for featured content...");
		const featuredSection = await page.$("#mp-tfa");
		if (featuredSection) {
			const featuredText = await featuredSection.textContent();
			const featuredPreview =
				featuredText.length > 100
					? `${featuredText.substring(0, 97)}...`
					: featuredText;
			console.log(`   Featured Article: ${featuredPreview}`);
		} else {
			console.log("   Featured Article: Not found");
		}

		// Extract navigation links
		console.log("\n🔗 Extracting navigation links...");
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

		// Get page statistics
		console.log("\n🧪 Page statistics...");
		const stats = await page.evaluate(() => ({
			paragraphs: document.querySelectorAll("p").length,
			links: document.querySelectorAll("a").length,
			images: document.querySelectorAll("img").length,
			headings: document.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
		}));

		console.log(`   Paragraphs: ${stats.paragraphs}`);
		console.log(`   Links: ${stats.links}`);
		console.log(`   Images: ${stats.images}`);
		console.log(`   Headings: ${stats.headings}`);

		// Extract specific content sections
		console.log("\n📄 Extracting content sections...");

		// Get all paragraph text
		const allParagraphs = await page.$$eval(
			"#mw-content-text p",
			(paragraphs) =>
				paragraphs
					.map((p) => p.textContent.trim())
					.filter((text) => text.length > 0),
		);

		console.log(`   Total paragraphs with content: ${allParagraphs.length}`);
		if (allParagraphs.length > 0) {
			const totalLength = allParagraphs.reduce((sum, p) => sum + p.length, 0);
			console.log(`   Total text length: ${totalLength} characters`);
		}

		// Get main content area text
		const mainContent = await page.textContent("#mw-content-text");
		if (mainContent) {
			console.log(`   Main content area: ${mainContent.length} characters`);
		}

		// Test some Wikipedia-specific elements
		console.log("\n🏛️ Wikipedia-specific elements...");

		// Check for infobox
		const infobox = await page.$(".infobox");
		console.log(`   Infobox present: ${infobox ? "Yes" : "No"}`);

		// Check for categories
		const categories = await page.$$eval("#mw-normal-catlinks a", (links) =>
			links.map((link) => link.textContent.trim()),
		);
		console.log(`   Categories: ${categories.length}`);

		// Take a screenshot
		console.log("\n📸 Taking screenshot...");
		await page.screenshot({
			path: "tests/wikipedia-playwright-screenshot.png",
			fullPage: false,
		});
		console.log(
			"   Screenshot saved: tests/wikipedia-playwright-screenshot.png",
		);

		console.log("\n✅ Test completed successfully!");
		return true;
	} catch (error) {
		console.error(`\n❌ Test failed: ${error.message}`);
		return false;
	} finally {
		// Cleanup
		if (page) {
			await page.close();
			console.log("🧹 Page closed");
		}
		if (browser) {
			await browser.close();
			console.log("🧹 Browser connection closed");
		}
	}
}

// Execute the test
if (import.meta.url === `file://${process.argv[1]}`) {
	testWikipediaExtraction()
		.then((success) => {
			process.exit(success ? 0 : 1);
		})
		.catch((error) => {
			console.error("Fatal error:", error);
			process.exit(1);
		});
}

export { testWikipediaExtraction };
