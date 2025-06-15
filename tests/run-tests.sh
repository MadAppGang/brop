#!/bin/bash

echo "🧪 BROP CDP Relay Test Suite"
echo "============================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if multiplexed system is running
check_system() {
    echo -e "\n${BLUE}Checking system status...${NC}"
    
    # Check if bridge server is running
    if ! curl -s http://localhost:9222 > /dev/null 2>&1; then
        echo -e "${RED}❌ CDP proxy not running on port 9222${NC}"
        echo -e "${YELLOW}Start with: pnpm run multiplexed:start${NC}"
        exit 1
    fi
    
    # Check if Chrome is available
    if ! command -v google-chrome &> /dev/null && ! command -v chromium &> /dev/null; then
        echo -e "${RED}❌ Chrome/Chromium not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ System ready${NC}"
}

# Run simple test
run_simple_test() {
    echo -e "\n${BLUE}Running Simple CDP Test...${NC}"
    if cd .. && node tests/simple-cdp-test.js; then
        echo -e "${GREEN}✅ Simple test passed${NC}"
        cd tests
        return 0
    else
        echo -e "${RED}❌ Simple test failed${NC}"
        cd tests
        return 1
    fi
}

# Run comprehensive test
run_comprehensive_test() {
    echo -e "\n${BLUE}Running Comprehensive CDP Relay Test...${NC}"
    if cd .. && node tests/playwright-cdp-relay-test.js; then
        echo -e "${GREEN}✅ Comprehensive test passed${NC}"
        cd tests
        return 0
    else
        echo -e "${RED}❌ Comprehensive test failed${NC}"
        cd tests
        return 1
    fi
}

# Run Wikipedia test
run_wikipedia_test() {
    echo -e "\n${BLUE}Running Wikipedia Text Extraction Test...${NC}"
    if cd .. && node tests/playwright-wikipedia-test.js; then
        echo -e "${GREEN}✅ Wikipedia test passed${NC}"
        cd tests
        return 0
    else
        echo -e "${RED}❌ Wikipedia test failed${NC}"
        cd tests
        return 1
    fi
}

# Run interactive test scenarios
run_scenarios() {
    echo -e "\n${BLUE}Running Test Scenarios...${NC}"
    
    echo -e "\n${YELLOW}Basic Scenario:${NC}"
    if cd .. && node tests/interactive-test.js basic; then
        echo -e "${GREEN}✅ Basic scenario passed${NC}"
        cd tests
    else
        echo -e "${RED}❌ Basic scenario failed${NC}"
        cd tests
        return 1
    fi
    
    echo -e "\n${YELLOW}Advanced Scenario:${NC}"
    if cd .. && node tests/interactive-test.js advanced; then
        echo -e "${GREEN}✅ Advanced scenario passed${NC}"
        cd tests
    else
        echo -e "${RED}❌ Advanced scenario failed${NC}"
        cd tests
        return 1
    fi
    
    return 0
}

# Main execution
main() {
    cd "$(dirname "$0")"
    
    # Parse arguments
    case "$1" in
        "simple")
            check_system
            run_simple_test
            ;;
        "comprehensive")
            check_system
            run_comprehensive_test
            ;;
        "scenarios")
            check_system
            run_scenarios
            ;;
        "wikipedia")
            check_system
            run_wikipedia_test
            ;;
        "interactive")
            check_system
            echo -e "\n${BLUE}Starting Interactive CDP Tester...${NC}"
            cd .. && node tests/interactive-test.js
            cd tests
            ;;
        "all"|"")
            check_system
            
            echo -e "\n${YELLOW}Running all tests...${NC}"
            
            failed=0
            
            if ! run_simple_test; then
                failed=$((failed + 1))
            fi
            
            if ! run_comprehensive_test; then
                failed=$((failed + 1))
            fi
            
            if ! run_scenarios; then
                failed=$((failed + 1))
            fi
            
            if ! run_wikipedia_test; then
                failed=$((failed + 1))
            fi
            
            echo -e "\n${BLUE}Test Summary:${NC}"
            if [ $failed -eq 0 ]; then
                echo -e "${GREEN}🎉 All tests passed!${NC}"
                exit 0
            else
                echo -e "${RED}💥 $failed test(s) failed${NC}"
                exit 1
            fi
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [test-type]"
            echo ""
            echo "Test types:"
            echo "  simple        - Run simple CDP test"
            echo "  comprehensive - Run comprehensive CDP relay test"
            echo "  scenarios     - Run predefined test scenarios"
            echo "  wikipedia     - Run Wikipedia text extraction test"
            echo "  interactive   - Start interactive test environment"
            echo "  all           - Run all tests (default)"
            echo "  help          - Show this help"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown test type: $1${NC}"
            echo "Use '$0 help' for available options"
            exit 1
            ;;
    esac
}

main "$@"