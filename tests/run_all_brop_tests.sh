#!/bin/bash
# Comprehensive BROP Protocol Test Runner
# Runs all BROP test suites and generates a consolidated report

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_DIR="$TEST_DIR/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONSOLIDATED_REPORT="$REPORT_DIR/brop_test_report_$TIMESTAMP.json"

echo -e "${BLUE}🧪 BROP Protocol Comprehensive Test Suite${NC}"
echo "========================================================"
echo "Test Directory: $TEST_DIR"
echo "Report Directory: $REPORT_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Create reports directory
mkdir -p "$REPORT_DIR"

# Initialize consolidated report
echo '{
  "test_suite": "BROP Protocol Comprehensive Tests",
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "test_results": {},
  "summary": {
    "total_suites": 0,
    "passed_suites": 0,
    "failed_suites": 0,
    "total_tests": 0,
    "total_passed": 0,
    "total_failed": 0,
    "overall_success_rate": 0
  },
  "environment": {
    "node_version": "'$(node --version 2>/dev/null || echo "not available")'",
    "python_version": "'$(python3 --version 2>/dev/null || echo "not available")'",
    "os": "'$(uname -s)'",
    "platform": "'$(uname -m)'"
  }
}' > "$CONSOLIDATED_REPORT"

# Function to check if a service is running
check_service() {
    local port=$1
    local service_name=$2
    
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}✅ $service_name (port $port) is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name (port $port) is not running${NC}"
        return 1
    fi
}

# Function to run a test suite
run_test_suite() {
    local test_file=$1
    local test_name=$2
    local test_type=$3
    
    echo -e "\n${YELLOW}🔧 Running $test_name...${NC}"
    echo "----------------------------------------"
    
    local start_time=$(date +%s)
    local test_output_file="$REPORT_DIR/${test_name// /_}_output_$TIMESTAMP.log"
    local test_report_pattern="$TEST_DIR/*${test_name// /_}*report*.json"
    
    if [ "$test_type" = "javascript" ]; then
        if node "$test_file" > "$test_output_file" 2>&1; then
            echo -e "${GREEN}✅ $test_name completed successfully${NC}"
            local status="PASS"
        else
            echo -e "${RED}❌ $test_name failed${NC}"
            local status="FAIL"
            echo "Error output saved to: $test_output_file"
        fi
    elif [ "$test_type" = "python" ]; then
        if python3 "$test_file" > "$test_output_file" 2>&1; then
            echo -e "${GREEN}✅ $test_name completed successfully${NC}"
            local status="PASS"
        else
            echo -e "${RED}❌ $test_name failed${NC}"
            local status="FAIL"
            echo "Error output saved to: $test_output_file"
        fi
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Look for generated report files
    local report_file=""
    for report in $test_report_pattern; do
        if [ -f "$report" ]; then
            report_file="$report"
            break
        fi
    done
    
    # Update consolidated report
    local temp_report=$(mktemp)
    if [ -n "$report_file" ] && [ -f "$report_file" ]; then
        # Extract test data from individual report
        local test_data=$(cat "$report_file")
        jq --arg name "$test_name" \
           --arg status "$status" \
           --arg duration "$duration" \
           --arg output_file "$test_output_file" \
           --arg report_file "$report_file" \
           --argjson test_data "$test_data" \
           '.test_results[$name] = {
               "status": $status,
               "duration": ($duration | tonumber),
               "output_file": $output_file,
               "report_file": $report_file,
               "test_data": $test_data
           }' "$CONSOLIDATED_REPORT" > "$temp_report"
        mv "$temp_report" "$CONSOLIDATED_REPORT"
    else
        # Add basic test info without detailed data
        jq --arg name "$test_name" \
           --arg status "$status" \
           --arg duration "$duration" \
           --arg output_file "$test_output_file" \
           '.test_results[$name] = {
               "status": $status,
               "duration": ($duration | tonumber),
               "output_file": $output_file,
               "report_file": null,
               "test_data": null
           }' "$CONSOLIDATED_REPORT" > "$temp_report"
        mv "$temp_report" "$CONSOLIDATED_REPORT"
    fi
    
    echo "Duration: ${duration}s"
    echo "Output saved to: $test_output_file"
    if [ -n "$report_file" ]; then
        echo "Report available at: $report_file"
    fi
}

# Function to update summary statistics
update_summary() {
    local temp_report=$(mktemp)
    
    jq '
    .summary.total_suites = (.test_results | length) |
    .summary.passed_suites = [.test_results[] | select(.status == "PASS")] | length |
    .summary.failed_suites = [.test_results[] | select(.status == "FAIL")] | length |
    .summary.total_tests = [.test_results[] | select(.test_data != null) | .test_data.summary.total] | add // 0 |
    .summary.total_passed = [.test_results[] | select(.test_data != null) | .test_data.summary.passed] | add // 0 |
    .summary.total_failed = [.test_results[] | select(.test_data != null) | .test_data.summary.failed] | add // 0 |
    .summary.overall_success_rate = (
        if .summary.total_tests > 0 then
            (.summary.total_passed / .summary.total_tests * 100)
        else 0 end
    )
    ' "$CONSOLIDATED_REPORT" > "$temp_report"
    
    mv "$temp_report" "$CONSOLIDATED_REPORT"
}

# Main test execution
echo -e "${BLUE}📋 Pre-flight Checks${NC}"
echo "----------------------------------------"

# Check prerequisites
echo "Checking Node.js availability..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

echo "Checking Python availability..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

echo "Checking jq availability..."
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is not installed (required for report generation)${NC}"
    echo "Install with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
    exit 1
fi

# Check if BROP services are running
echo -e "\n${BLUE}🔍 Service Connectivity Checks${NC}"
echo "----------------------------------------"

services_running=true

if ! check_service 9222 "CDP Server"; then
    services_running=false
fi

if ! check_service 9223 "BROP Server"; then
    services_running=false
fi

if ! check_service 9224 "Extension Server"; then
    services_running=false
fi

if ! check_service 9225 "HTTP Discovery Server"; then
    services_running=false
fi

if [ "$services_running" = false ]; then
    echo -e "\n${YELLOW}⚠️  Some BROP services are not running.${NC}"
    echo "Please start the BROP bridge server before running tests:"
    echo "  cd bridge-server && node bridge_server.js"
    echo ""
    echo "Or run tests that don't require live services with: $0 --offline"
    if [ "$1" != "--offline" ]; then
        exit 1
    fi
fi

echo -e "\n${BLUE}🚀 Running Test Suites${NC}"
echo "========================================================"

# Run Protocol Buffer tests (can run offline)
if [ -f "$TEST_DIR/brop_protobuf_tests.js" ]; then
    run_test_suite "$TEST_DIR/brop_protobuf_tests.js" "Protocol Buffer Tests" "javascript"
else
    echo -e "${YELLOW}⚠️  Protocol Buffer test file not found${NC}"
fi

# Run comprehensive protocol tests (requires services)
if [ "$1" != "--offline" ] && [ -f "$TEST_DIR/comprehensive_brop_protocol_tests.js" ]; then
    run_test_suite "$TEST_DIR/comprehensive_brop_protocol_tests.js" "Comprehensive Protocol Tests" "javascript"
else
    echo -e "${YELLOW}⚠️  Skipping comprehensive protocol tests (offline mode or file not found)${NC}"
fi

# Check for Python dependencies before running integration tests
if [ "$1" != "--offline" ]; then
    echo -e "\n${BLUE}🐍 Checking Python Dependencies${NC}"
    echo "----------------------------------------"
    
    python_deps_ok=true
    
    if ! python3 -c "import websockets" 2>/dev/null; then
        echo -e "${RED}❌ websockets module not available${NC}"
        python_deps_ok=false
    fi
    
    if ! python3 -c "import aiohttp" 2>/dev/null; then
        echo -e "${RED}❌ aiohttp module not available${NC}"
        python_deps_ok=false
    fi
    
    if [ "$python_deps_ok" = false ]; then
        echo -e "${YELLOW}Installing Python dependencies...${NC}"
        if pip3 install websockets aiohttp; then
            echo -e "${GREEN}✅ Python dependencies installed${NC}"
        else
            echo -e "${RED}❌ Failed to install Python dependencies${NC}"
            echo "Please install manually: pip3 install websockets aiohttp"
        fi
    else
        echo -e "${GREEN}✅ All Python dependencies available${NC}"
    fi
    
    # Run integration tests (requires services and Python deps)
    if [ -f "$TEST_DIR/brop_integration_tests.py" ]; then
        run_test_suite "$TEST_DIR/brop_integration_tests.py" "Integration Tests" "python"
    else
        echo -e "${YELLOW}⚠️  Integration test file not found${NC}"
    fi
fi

# Update summary statistics
update_summary

# Generate final report
echo -e "\n${BLUE}📊 Test Results Summary${NC}"
echo "========================================================"

# Extract and display summary
summary=$(jq -r '
"Total Test Suites: " + (.summary.total_suites | tostring) + "\n" +
"Passed Suites: " + (.summary.passed_suites | tostring) + " ✅\n" +
"Failed Suites: " + (.summary.failed_suites | tostring) + " ❌\n" +
"Total Individual Tests: " + (.summary.total_tests | tostring) + "\n" +
"Total Passed Tests: " + (.summary.total_passed | tostring) + "\n" +
"Total Failed Tests: " + (.summary.total_failed | tostring) + "\n" +
"Overall Success Rate: " + (.summary.overall_success_rate | tostring | .[0:5]) + "%"
' "$CONSOLIDATED_REPORT")

echo "$summary"

echo ""
echo "Detailed reports available in: $REPORT_DIR"
echo "Consolidated report: $CONSOLIDATED_REPORT"

# Display failed tests if any
failed_suites=$(jq -r '.test_results | to_entries[] | select(.value.status == "FAIL") | .key' "$CONSOLIDATED_REPORT")

if [ -n "$failed_suites" ]; then
    echo -e "\n${RED}❌ Failed Test Suites:${NC}"
    echo "$failed_suites" | while read -r suite; do
        echo "   - $suite"
    done
fi

echo -e "\n${BLUE}🎯 BROP Protocol Test Suite Complete!${NC}"

# Exit with appropriate code
total_failed=$(jq -r '.summary.failed_suites' "$CONSOLIDATED_REPORT")
if [ "$total_failed" -eq 0 ]; then
    echo -e "${GREEN}🎉 All test suites passed!${NC}"
    exit 0
else
    echo -e "${RED}💥 Some test suites failed.${NC}"
    exit 1
fi