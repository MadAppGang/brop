# BROP + Stagehand AI Integration Test

This test demonstrates the powerful combination of BROP (Browser Remote Operations Protocol) with Stagehand's AI capabilities, using Anthropic's Claude for intelligent browser automation.

## 🤖 What This Test Does

The AI integration test performs the following advanced automation tasks:

1. **🔌 BROP Connection**: Connects to BROP's CDP server using existing Chrome session
2. **🧠 AI Initialization**: Sets up Stagehand with Anthropic Claude for intelligent automation
3. **👁️ AI Observation**: Uses AI to analyze and understand webpage structure
4. **📊 Smart Extraction**: Extracts meaningful content using natural language queries
5. **🎯 AI Interaction**: Performs complex interactions using AI reasoning
6. **🌳 DOM Analysis**: Leverages BROP's simplified DOM for enhanced AI understanding

## 🚀 Quick Start

### Prerequisites

1. **BROP Extension**: Loaded and active in Chrome
2. **BROP Bridge Server**: Running on localhost:9222
3. **Anthropic API Key**: Set in `.env` file
4. **Chrome Tab**: Open tab for extension activation

### Environment Setup

The test uses these environment variables from `.env`:

```bash
# Anthropic API Key (already configured)
ANTHROPIC_API_KEY=sk-ant-api03-027O_8litG1cU5ozpS107-...

# BROP Configuration
BROP_CDP_PORT=9222
BROP_NATIVE_PORT=9223

# Stagehand AI Configuration
STAGEHAND_MODEL=claude-3-sonnet-20240229
STAGEHAND_PROVIDER=anthropic
STAGEHAND_VERBOSE=true
```

### Running the Test

```bash
# Navigate to stagehand integration directory
cd stagehand-integration

# Install dependencies (if not already done)
npm install

# Run the AI integration test
npm run test:ai

# Or run directly
node test-with-ai.js
```

## 🧪 Test Scenarios

### Scenario 1: Wikipedia Article Analysis
- **Page**: Wikipedia Artificial Intelligence article
- **AI Tasks**:
  - Analyze page structure and content
  - Extract article title, summary, categories
  - Identify key information and metadata
  - Understand page layout and navigation

### Scenario 2: Intelligent Search Interaction
- **AI Tasks**:
  - Find search functionality using visual understanding
  - Interact with search box using natural commands
  - Type search query with AI reasoning
  - Navigate through search results

### Scenario 3: Advanced Content Extraction
- **AI Capabilities**:
  - Answer questions about page content
  - Identify page type and purpose
  - Extract structured information
  - Understand accessibility features

### Scenario 4: BROP Enhancement Testing
- **Combined Features**:
  - Use BROP's simplified DOM for AI understanding
  - Leverage interactive element detection
  - Smart selector generation for AI actions
  - Performance metrics and capability assessment

## 📊 Expected Output

When running successfully, you'll see output like:

```
🤖 BROP + Stagehand AI Integration Test
==================================================
✅ Anthropic API key found
🔑 Using API key: sk-ant-api03-027O_8li...

📋 Step 1: Checking BROP availability...
✅ BROP services are ready

📋 Step 2: Initializing Stagehand with BROP backend...
✅ Stagehand initialized with BROP backend

📋 Step 3: Setting up page and checking BROP integration...
🔍 BROP Integration Status: {
  hasBROP: true,
  hasDOMSimplifier: true,
  pageUrl: 'https://en.wikipedia.org/wiki/Artificial_intelligence'
}

📋 Step 4: Navigating to Wikipedia for AI testing...
✅ Navigation completed

📋 Step 5: Using AI to observe the page...
👁️ AI Page Observation:
   - Page analyzed by AI

📋 Step 6: AI-powered content extraction...
📊 AI-Extracted Article Data:
   📄 title: Artificial intelligence
   📄 summary: Artificial intelligence (AI) is intelligence demonstrated by machines...
   📄 categories: Computer science, Technology, Machine learning

📋 Step 7: AI-powered page interaction...
🔍 AI task: Find and use the search functionality
⌨️ AI task: Search for "machine learning"
🚀 AI task: Submit the search
✅ AI successfully performed search interaction

🎉 BROP + Stagehand AI Test Completed Successfully!
```

## 🔧 Configuration Options

### Stagehand AI Configuration

```javascript
stagehand = new Stagehand({
    env: "LOCAL",                    // Use local browser (BROP)
    verbose: 1,                      // Enable detailed logging
    debugDom: true,                  // Debug DOM interactions
    enableCaching: false,            // Disable caching for testing
    llmClient: {
        provider: "anthropic",       // Use Anthropic Claude
        model: "claude-3-sonnet-20240229",
        apiKey: process.env.ANTHROPIC_API_KEY
    },
    browserUrl: "ws://localhost:9222" // Connect to BROP CDP
});
```

### BROP Integration Options

```javascript
// Check BROP status
const bropStatus = await page.evaluate(() => ({
    hasBROP: typeof window.BROP !== 'undefined',
    hasDOMSimplifier: typeof window.DOMSimplifier !== 'undefined',
    pageUrl: window.location.href
}));

// Use BROP simplified DOM
const simplifiedDOM = await page.evaluate(() => {
    return window.BROP?.getSimplifiedDOM({
        max_depth: 3,
        include_hidden: false
    });
});
```

## 🎯 AI Capabilities Demonstrated

### 1. Natural Language Understanding
- **Page Analysis**: AI understands webpage structure and content
- **Content Extraction**: Extract specific information using questions
- **Element Recognition**: Identify interactive elements and their purposes

### 2. Intelligent Automation
- **Smart Interaction**: AI figures out how to interact with page elements
- **Context Awareness**: Understands current page state and navigation
- **Adaptive Behavior**: Adjusts actions based on page responses

### 3. Structured Data Extraction
- **Question-Driven**: Extract data by asking natural language questions
- **Schema-Free**: No need to define complex extraction schemas
- **Contextual**: Understands relationships between different data points

### 4. Enhanced BROP Integration
- **Simplified DOM**: Leverages BROP's AI-optimized page representation
- **Smart Selectors**: Uses BROP's intelligent element targeting
- **Performance Optimization**: Combines AI reasoning with BROP efficiency

## 🚨 Troubleshooting

### Common Issues

1. **"BROP not available"**
   ```bash
   cd bridge-server && node bridge_server.js
   ```

2. **"Anthropic API key not found"**
   - Check `.env` file exists and contains `ANTHROPIC_API_KEY`
   - Verify API key format starts with `sk-ant-api03-`

3. **"AI actions failing"**
   - This is normal - AI actions may not always succeed on first try
   - AI is learning and adapting to different page structures

4. **"Content script not loaded"**
   - Reload BROP extension in Chrome
   - Navigate to a webpage to activate content script

### Debug Mode

Enable maximum verbosity for troubleshooting:

```javascript
stagehand = new Stagehand({
    verbose: 2,              // Maximum verbosity
    debugDom: true,          // Debug DOM operations
    enableCaching: false,    // Disable caching
    // ... other options
});
```

## 📈 Performance Metrics

The test measures several performance aspects:

- **Page Load Time**: How fast pages load through BROP
- **AI Response Time**: How quickly Claude processes requests
- **Action Success Rate**: Percentage of successful AI actions
- **DOM Analysis Speed**: Time to analyze page structure
- **Integration Efficiency**: Overall BROP + Stagehand performance

## 🔮 Advanced Usage

### Custom AI Prompts

```javascript
// Custom extraction with specific questions
const customData = await stagehand.page.extract({
    mainTopic: "What is the primary topic of this page?",
    keyPoints: "What are the 3 most important points mentioned?",
    difficulty: "What level of expertise is needed to understand this content?",
    actions: "What actions can a user take on this page?"
});
```

### Conditional AI Logic

```javascript
// AI-driven conditional automation
const pageType = await stagehand.page.extract({
    type: "What type of page is this?"
});

if (pageType.type.includes("search")) {
    await stagehand.page.act("refine the search with more specific terms");
} else if (pageType.type.includes("article")) {
    await stagehand.page.act("find related articles or references");
}
```

### Multi-Step AI Workflows

```javascript
// Complex multi-step automation
await stagehand.page.act("find the main navigation menu");
await stagehand.page.act("look for a products or services section");
await stagehand.page.act("click on the most relevant category");

const results = await stagehand.page.extract({
    products: "What products or services are available?",
    pricing: "What pricing information is visible?"
});
```

## 🎉 Success Indicators

A successful test run should show:

- ✅ BROP backend connection established
- ✅ Anthropic Claude AI responding to queries
- ✅ Page navigation and content loading
- ✅ AI successfully analyzing page content
- ✅ Content extraction with meaningful results
- ✅ AI attempting page interactions
- ✅ BROP-specific features working
- ✅ Performance metrics within acceptable ranges

The combination of BROP's browser integration with Stagehand's AI capabilities creates a powerful platform for intelligent browser automation that can understand and interact with web pages in human-like ways.