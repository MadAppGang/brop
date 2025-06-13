# BROP Protocol Comprehensive Test Suite

This directory contains a comprehensive test suite for the Browser Remote Operations Protocol (BROP), covering all aspects of the protocol implementation, performance, and reliability.

## Test Suite Overview

### 🧪 Test Components

1. **Protocol Buffer Tests** (`brop_protobuf_tests.js`)

   - Message serialization/deserialization validation
   - Command structure validation
   - Response format verification
   - Error condition handling
   - Message size validation

2. **Comprehensive Protocol Tests** (`comprehensive_brop_protocol_tests.js`)

   - WebSocket connectivity testing
   - CDP (Chrome DevTools Protocol) command validation
   - BROP-specific command testing
   - Performance benchmarking
   - Concurrent connection handling

3. **Integration Tests** (`brop_integration_tests.py`)

   - End-to-end workflow testing
   - Real browser automation scenarios
   - Error handling validation
   - Large payload handling
   - Service discovery endpoint testing

4. **Test Runner** (`run_all_brop_tests.sh`)
   - Automated test execution
   - Service availability checking
   - Consolidated reporting
   - Dependency validation

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v14+ recommended)
2. **Python 3** (v3.7+ recommended)
3. **BROP Bridge Server** running
4. **jq** for report processing

### Install Dependencies

```bash
# JavaScript dependencies (in project root)
npm install

# Python dependencies
pip3 install websockets aiohttp

# System dependencies (macOS)
brew install jq

# System dependencies (Ubuntu)
apt-get install jq
```

### Start BROP Services

Before running tests, ensure the BROP bridge server is running:

```bash
cd bridge
node bridge_server.js
```

This will start services on:

- **Port 9222**: CDP (Chrome DevTools Protocol) server
- **Port 9223**: BROP native command server
- **Port 9224**: Extension WebSocket server
- **Port 9225**: HTTP discovery endpoints

### Run All Tests

```bash
# Run complete test suite
./run_all_brop_tests.sh

# Run offline tests only (no services required)
./run_all_brop_tests.sh --offline
```

### Run Individual Test Suites

```bash
# Protocol Buffer tests (offline)
node brop_protobuf_tests.js

# Comprehensive protocol tests (requires services)
node comprehensive_brop_protocol_tests.js

# Integration tests (requires services)
python3 brop_integration_tests.py
```

## 📋 Test Categories

### 1. Protocol Buffer Validation Tests

**File**: `brop_protobuf_tests.js`

Tests the core message structure and validation:

- ✅ **BrowserMessage serialization**: Tests message wrapper format
- ✅ **Command validation**: Validates all 10 command types
- ✅ **Response validation**: Tests response structure for all command types
- ✅ **Error handling**: Tests malformed message handling
- ✅ **Size validation**: Tests various payload sizes

**Commands Tested**:

- `get_console_logs` - Console log retrieval
- `execute_console` - JavaScript execution in console
- `get_screenshot` - Page screenshot capture
- `get_page_content` - HTML/text content extraction
- `navigate` - Page navigation
- `click` - Element clicking
- `type` - Text input
- `wait_for_element` - Element waiting
- `evaluate_js` - JavaScript evaluation
- `get_element` - Element information retrieval

### 2. Protocol Communication Tests

**File**: `comprehensive_brop_protocol_tests.js`

Tests the WebSocket communication layer:

- ✅ **Connectivity**: WebSocket connection to all ports
- ✅ **CDP Commands**: Browser version, target management, runtime evaluation
- ✅ **BROP Commands**: Native BROP command execution
- ✅ **Error Handling**: Invalid command and malformed message handling
- ✅ **Message Correlation**: Request/response ID matching
- ✅ **Performance**: Throughput and latency measurements

### 3. Integration & End-to-End Tests

**File**: `brop_integration_tests.py`

Tests complete workflows and real-world scenarios:

- ✅ **Service Discovery**: HTTP endpoint validation
- ✅ **Browser Workflows**: Complete automation sequences
- ✅ **BROP Native Interface**: Direct BROP command testing
- ✅ **Concurrent Connections**: Multiple client handling
- ✅ **Large Payloads**: High-volume data processing
- ✅ **Performance Benchmarks**: Real-world performance metrics

## 📊 Test Reports

### Report Generation

Each test suite generates detailed JSON reports:

- **Individual Reports**: `*-report-[timestamp].json`
- **Consolidated Report**: `brop_test_report_[timestamp].json`
- **Output Logs**: `*_output_[timestamp].log`

### Report Structure

```json
{
  "summary": {
    "total_tests": 15,
    "passed": 13,
    "failed": 2,
    "success_rate": 86.7,
    "total_duration": 12.5
  },
  "test_results": [
    {
      "name": "WebSocket Connection",
      "status": "PASS",
      "duration": 0.25,
      "result": { "connected": true, "port": 9222 }
    }
  ],
  "environment": {
    "node_version": "v18.17.0",
    "python_version": "Python 3.9.7",
    "os": "Darwin"
  }
}
```

## 🔧 Test Configuration

### Environment Variables

```bash
# Override default ports
export BROP_CDP_PORT=9222
export BROP_NATIVE_PORT=9223
export BROP_EXTENSION_PORT=9224
export BROP_HTTP_PORT=9225

# Test timeouts
export BROP_TEST_TIMEOUT=15000  # milliseconds
```

### Test Customization

Modify test parameters in each test file:

```javascript
// comprehensive_brop_protocol_tests.js
class BROPProtocolTestSuite {
  constructor() {
    this.testTimeout = 10000; // 10 seconds
    this.wsPort = 9222;
    this.bropPort = 9223;
  }
}
```

```python
# brop_integration_tests.py
class BROPIntegrationTestSuite:
    def __init__(self):
        self.test_timeout = 15.0  # 15 seconds
        self.cdp_port = 9222
        self.brop_port = 9223
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Connection Refused Errors

```
Error: connect ECONNREFUSED 127.0.0.1:9222
```

**Solution**: Ensure BROP bridge server is running:

```bash
cd bridge && node bridge_server.js
```

#### 2. Python Module Not Found

```
ModuleNotFoundError: No module named 'websockets'
```

**Solution**: Install Python dependencies:

```bash
pip3 install websockets aiohttp
```

#### 3. jq Command Not Found

```
./run_all_brop_tests.sh: line 45: jq: command not found
```

**Solution**: Install jq:

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

#### 4. Permission Denied on Test Runner

```
bash: ./run_all_brop_tests.sh: Permission denied
```

**Solution**: Make script executable:

```bash
chmod +x run_all_brop_tests.sh
```

### Debug Mode

Enable verbose logging for detailed debug information:

```bash
# JavaScript tests
DEBUG=* node comprehensive_brop_protocol_tests.js

# Python tests
python3 -c "import logging; logging.basicConfig(level=logging.DEBUG)" brop_integration_tests.py
```

## 📈 Performance Benchmarks

### Expected Performance

| Metric                 | Target       | Typical      |
| ---------------------- | ------------ | ------------ |
| Connection Latency     | < 100ms      | ~50ms        |
| Command Response Time  | < 500ms      | ~200ms       |
| Throughput             | > 50 msg/sec | ~100 msg/sec |
| Concurrent Connections | > 10         | ~20          |

### Performance Test Results

The performance tests measure:

- **Message Throughput**: Messages per second
- **Latency**: Round-trip time for individual commands
- **Concurrent Handling**: Multiple simultaneous connections
- **Payload Handling**: Large message processing

## 🔍 Test Coverage

### Protocol Features Tested

- ✅ **WebSocket Communication**: All protocols (CDP, BROP, Extension)
- ✅ **Message Serialization**: Protocol Buffer encoding/decoding
- ✅ **Command Execution**: All 10 BROP command types
- ✅ **Error Handling**: Invalid commands, malformed messages
- ✅ **Session Management**: Target creation, attachment, routing
- ✅ **Performance**: Throughput, latency, concurrent connections
- ✅ **Integration**: End-to-end browser automation workflows

### Browser Features Tested

- ✅ **Page Navigation**: URL loading and navigation
- ✅ **JavaScript Execution**: Code evaluation and console interaction
- ✅ **Element Interaction**: Clicking, typing, waiting
- ✅ **Content Extraction**: HTML, text, metadata retrieval
- ✅ **Screenshot Capture**: Image data generation
- ✅ **Console Monitoring**: Log capture and filtering

## 🚀 Contributing

### Adding New Tests

1. **Create test file** following naming convention: `brop_[category]_tests.[js|py]`
2. **Implement test class** with standardized methods
3. **Add to test runner** in `run_all_brop_tests.sh`
4. **Update documentation** in this README

### Test Standards

- Use descriptive test names
- Include both positive and negative test cases
- Generate JSON reports for integration
- Handle timeouts and error conditions
- Log comprehensive debug information

### Example Test Template

```javascript
class NewBROPTestSuite {
  constructor() {
    this.testResults = [];
  }

  async runTest(testName, testFn) {
    // Standard test execution with timeout and error handling
  }

  async testSpecificFeature() {
    // Implement specific test logic
    return { success: true, details: "..." };
  }

  async runAllTests() {
    // Execute all tests and generate report
  }
}
```

## 📄 License

This test suite is part of the BROP project and follows the same MIT license terms.
