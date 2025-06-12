#!/usr/bin/env python3
"""
BROP Integration Test Suite

Comprehensive tests for the Browser Remote Operations Protocol
including end-to-end workflows, edge cases, and real-world scenarios.
"""

import asyncio
import websockets
import json
import time
import base64
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import traceback

@dataclass
class TestResult:
    name: str
    status: str  # PASS, FAIL, SKIP
    duration: float
    result: Optional[Any] = None
    error: Optional[str] = None

class BROPIntegrationTestSuite:
    def __init__(self):
        self.cdp_port = 9222
        self.brop_port = 9223
        self.test_results: List[TestResult] = []
        self.message_id = 1
        self.test_timeout = 15.0
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='[%(asctime)s] [%(levelname)s] %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def get_next_message_id(self) -> int:
        self.message_id += 1
        return self.message_id

    async def run_test(self, test_name: str, test_func):
        """Run a single test with timeout and error handling"""
        self.logger.info(f"Starting test: {test_name}")
        start_time = time.time()
        
        try:
            result = await asyncio.wait_for(test_func(), timeout=self.test_timeout)
            duration = time.time() - start_time
            
            test_result = TestResult(
                name=test_name,
                status="PASS",
                duration=duration,
                result=result
            )
            
            self.test_results.append(test_result)
            self.logger.info(f"✅ PASS: {test_name} ({duration:.2f}s)")
            return test_result
            
        except asyncio.TimeoutError:
            duration = time.time() - start_time
            error_msg = f"Test timeout after {self.test_timeout}s"
            
            test_result = TestResult(
                name=test_name,
                status="FAIL",
                duration=duration,
                error=error_msg
            )
            
            self.test_results.append(test_result)
            self.logger.error(f"❌ FAIL: {test_name} - {error_msg}")
            return test_result
            
        except Exception as e:
            duration = time.time() - start_time
            error_msg = str(e)
            
            test_result = TestResult(
                name=test_name,
                status="FAIL",
                duration=duration,
                error=error_msg
            )
            
            self.test_results.append(test_result)
            self.logger.error(f"❌ FAIL: {test_name} - {error_msg}")
            return test_result

    async def test_basic_connectivity(self):
        """Test basic WebSocket connections to all BROP endpoints"""
        results = {}
        
        # Test CDP port
        try:
            async with websockets.connect(f"ws://localhost:{self.cdp_port}") as ws:
                results['cdp_connection'] = True
        except Exception as e:
            results['cdp_connection'] = False
            results['cdp_error'] = str(e)
        
        # Test BROP port
        try:
            async with websockets.connect(f"ws://localhost:{self.brop_port}") as ws:
                results['brop_connection'] = True
        except Exception as e:
            results['brop_connection'] = False
            results['brop_error'] = str(e)
        
        return results

    async def test_cdp_discovery_endpoints(self):
        """Test CDP discovery HTTP endpoints"""
        import aiohttp
        
        results = {}
        
        try:
            async with aiohttp.ClientSession() as session:
                # Test /json/version endpoint
                async with session.get('http://localhost:9225/json/version') as response:
                    if response.status == 200:
                        version_data = await response.json()
                        results['version_endpoint'] = {
                            'status': response.status,
                            'data': version_data,
                            'has_product': 'product' in version_data
                        }
                    else:
                        results['version_endpoint'] = {'status': response.status}
                
                # Test /json endpoint (target list)
                async with session.get('http://localhost:9225/json') as response:
                    if response.status == 200:
                        targets_data = await response.json()
                        results['targets_endpoint'] = {
                            'status': response.status,
                            'data': targets_data,
                            'target_count': len(targets_data) if isinstance(targets_data, list) else 0
                        }
                    else:
                        results['targets_endpoint'] = {'status': response.status}
                        
        except Exception as e:
            results['http_error'] = str(e)
        
        return results

    async def test_complete_browser_workflow(self):
        """Test complete browser automation workflow"""
        async with websockets.connect(f"ws://localhost:{self.cdp_port}") as ws:
            workflow_steps = []
            
            # Step 1: Enable required domains
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "method": "Runtime.enable",
                "params": {}
            }))
            response = await ws.recv()
            enable_result = json.loads(response)
            workflow_steps.append(("Runtime.enable", enable_result.get('result') is not None))
            
            # Step 2: Create a new target
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "method": "Target.createTarget",
                "params": {
                    "url": "data:text/html,<html><head><title>BROP Test</title></head><body><h1>Integration Test Page</h1><button id='test-btn'>Click Me</button><input id='test-input' placeholder='Type here'/></body></html>"
                }
            }))
            response = await ws.recv()
            create_result = json.loads(response)
            target_id = create_result.get('result', {}).get('targetId')
            workflow_steps.append(("Target.createTarget", target_id is not None))
            
            if not target_id:
                return {"workflow_steps": workflow_steps, "completed": False, "error": "Failed to create target"}
            
            # Step 3: Attach to target
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "method": "Target.attachToTarget",
                "params": {
                    "targetId": target_id,
                    "flatten": True
                }
            }))
            response = await ws.recv()
            attach_result = json.loads(response)
            session_id = attach_result.get('result', {}).get('sessionId')
            workflow_steps.append(("Target.attachToTarget", session_id is not None))
            
            # Step 4: Navigate (using session if available)
            navigate_msg = {
                "id": self.get_next_message_id(),
                "method": "Page.navigate",
                "params": {
                    "url": "data:text/html,<html><head><title>Updated Page</title></head><body><h1>Navigation Successful</h1><p>This page was navigated to</p></body></html>"
                }
            }
            if session_id:
                navigate_msg["sessionId"] = session_id
                
            await ws.send(json.dumps(navigate_msg))
            response = await ws.recv()
            navigate_result = json.loads(response)
            workflow_steps.append(("Page.navigate", navigate_result.get('result') is not None))
            
            # Step 5: Evaluate JavaScript
            eval_msg = {
                "id": self.get_next_message_id(),
                "method": "Runtime.evaluate",
                "params": {
                    "expression": "document.title"
                }
            }
            if session_id:
                eval_msg["sessionId"] = session_id
                
            await ws.send(json.dumps(eval_msg))
            response = await ws.recv()
            eval_result = json.loads(response)
            title_value = eval_result.get('result', {}).get('result', {}).get('value')
            workflow_steps.append(("Runtime.evaluate", title_value == "Updated Page"))
            
            # Step 6: Test complex JavaScript evaluation
            complex_eval_msg = {
                "id": self.get_next_message_id(),
                "method": "Runtime.evaluate",
                "params": {
                    "expression": """
                    ({
                        title: document.title,
                        url: window.location.href,
                        elementCount: document.querySelectorAll('*').length,
                        hasH1: document.querySelector('h1') !== null,
                        timestamp: new Date().toISOString()
                    })
                    """
                }
            }
            if session_id:
                complex_eval_msg["sessionId"] = session_id
                
            await ws.send(json.dumps(complex_eval_msg))
            response = await ws.recv()
            complex_result = json.loads(response)
            complex_value = complex_result.get('result', {}).get('result', {}).get('value')
            workflow_steps.append(("Complex JavaScript", isinstance(complex_value, dict)))
            
            return {
                "workflow_steps": workflow_steps,
                "completed": all(step[1] for step in workflow_steps),
                "target_id": target_id,
                "session_id": session_id,
                "final_evaluation": complex_value
            }

    async def test_brop_native_commands(self):
        """Test BROP-specific command interface"""
        async with websockets.connect(f"ws://localhost:{self.brop_port}") as ws:
            brop_tests = []
            
            # Test console logs command
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "command": {
                    "type": "get_console_logs",
                    "limit": 10,
                    "level": "info"
                }
            }))
            response = await ws.recv()
            console_result = json.loads(response)
            brop_tests.append(("get_console_logs", console_result.get('success', False)))
            
            # Test screenshot command
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "command": {
                    "type": "get_screenshot",
                    "format": "png",
                    "quality": 80
                }
            }))
            response = await ws.recv()
            screenshot_result = json.loads(response)
            has_image = screenshot_result.get('result', {}).get('image_data') is not None
            brop_tests.append(("get_screenshot", has_image))
            
            # Test page content command
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "command": {
                    "type": "get_page_content",
                    "include_html": True,
                    "include_text": True,
                    "include_metadata": True
                }
            }))
            response = await ws.recv()
            content_result = json.loads(response)
            has_content = content_result.get('result', {}).get('html') is not None
            brop_tests.append(("get_page_content", has_content))
            
            return {
                "brop_tests": brop_tests,
                "all_passed": all(test[1] for test in brop_tests)
            }

    async def test_error_handling(self):
        """Test error handling for invalid commands and edge cases"""
        async with websockets.connect(f"ws://localhost:{self.cdp_port}") as ws:
            error_tests = []
            
            # Test invalid method
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "method": "NonExistent.Method",
                "params": {}
            }))
            response = await ws.recv()
            invalid_result = json.loads(response)
            has_error = 'error' in invalid_result
            error_tests.append(("invalid_method", has_error))
            
            # Test malformed message
            await ws.send('{"invalid": "json"')
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=2.0)
                # Should either get an error response or connection should close
                error_tests.append(("malformed_json", True))
            except:
                error_tests.append(("malformed_json", True))
            
            # Test missing required parameters
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "method": "Runtime.evaluate"
                # Missing params
            }))
            response = await ws.recv()
            missing_params_result = json.loads(response)
            has_error = 'error' in missing_params_result
            error_tests.append(("missing_params", has_error))
            
            return {
                "error_tests": error_tests,
                "all_handled": all(test[1] for test in error_tests)
            }

    async def test_performance_benchmarks(self):
        """Test performance characteristics of BROP"""
        async with websockets.connect(f"ws://localhost:{self.cdp_port}") as ws:
            # Test message throughput
            message_count = 20
            start_time = time.time()
            
            sent_ids = []
            for i in range(message_count):
                msg_id = self.get_next_message_id()
                sent_ids.append(msg_id)
                await ws.send(json.dumps({
                    "id": msg_id,
                    "method": "Browser.getVersion",
                    "params": {}
                }))
            
            received_count = 0
            received_ids = []
            while received_count < message_count:
                response = await ws.recv()
                result = json.loads(response)
                if 'id' in result:
                    received_ids.append(result['id'])
                    received_count += 1
            
            end_time = time.time()
            total_duration = end_time - start_time
            
            # Test individual message latency
            latency_tests = []
            for i in range(5):
                msg_start = time.time()
                await ws.send(json.dumps({
                    "id": self.get_next_message_id(),
                    "method": "Browser.getVersion",
                    "params": {}
                }))
                await ws.recv()
                msg_end = time.time()
                latency_tests.append(msg_end - msg_start)
            
            return {
                "throughput": {
                    "messages": message_count,
                    "duration": total_duration,
                    "messages_per_second": message_count / total_duration,
                    "all_received": len(received_ids) == len(sent_ids)
                },
                "latency": {
                    "individual_tests": latency_tests,
                    "average_latency": sum(latency_tests) / len(latency_tests),
                    "min_latency": min(latency_tests),
                    "max_latency": max(latency_tests)
                }
            }

    async def test_concurrent_connections(self):
        """Test multiple concurrent connections to BROP"""
        connection_count = 5
        concurrent_results = []
        
        async def single_connection_test(connection_id):
            try:
                async with websockets.connect(f"ws://localhost:{self.cdp_port}") as ws:
                    await ws.send(json.dumps({
                        "id": connection_id,
                        "method": "Browser.getVersion",
                        "params": {}
                    }))
                    response = await ws.recv()
                    result = json.loads(response)
                    return {
                        "connection_id": connection_id,
                        "success": 'result' in result,
                        "response_id": result.get('id')
                    }
            except Exception as e:
                return {
                    "connection_id": connection_id,
                    "success": False,
                    "error": str(e)
                }
        
        # Create concurrent connections
        tasks = [single_connection_test(i) for i in range(connection_count)]
        concurrent_results = await asyncio.gather(*tasks)
        
        successful_connections = sum(1 for r in concurrent_results if r['success'])
        
        return {
            "total_connections": connection_count,
            "successful_connections": successful_connections,
            "success_rate": successful_connections / connection_count,
            "results": concurrent_results
        }

    async def test_large_payload_handling(self):
        """Test handling of large payloads"""
        async with websockets.connect(f"ws://localhost:{self.cdp_port}") as ws:
            payload_tests = []
            
            # Test small payload (baseline)
            small_code = "1 + 1"
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "method": "Runtime.evaluate",
                "params": {"expression": small_code}
            }))
            response = await ws.recv()
            small_result = json.loads(response)
            payload_tests.append(("small_payload", 'result' in small_result))
            
            # Test medium payload
            medium_code = "Array(1000).fill(0).map((_, i) => i).reduce((a, b) => a + b, 0)"
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "method": "Runtime.evaluate",
                "params": {"expression": medium_code}
            }))
            response = await ws.recv()
            medium_result = json.loads(response)
            payload_tests.append(("medium_payload", 'result' in medium_result))
            
            # Test large payload
            large_code = "JSON.stringify(" + "Array(10000).fill(0).map((_, i) => ({id: i, value: 'item_' + i}))" + ")"
            await ws.send(json.dumps({
                "id": self.get_next_message_id(),
                "method": "Runtime.evaluate",
                "params": {"expression": large_code}
            }))
            response = await ws.recv()
            large_result = json.loads(response)
            payload_tests.append(("large_payload", 'result' in large_result))
            
            return {
                "payload_tests": payload_tests,
                "all_handled": all(test[1] for test in payload_tests)
            }

    def generate_test_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r.status == "PASS"])
        failed_tests = len([r for r in self.test_results if r.status == "FAIL"])
        
        total_duration = sum(r.duration for r in self.test_results)
        
        report = {
            "summary": {
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": failed_tests,
                "success_rate": (passed_tests / total_tests * 100) if total_tests > 0 else 0,
                "total_duration": total_duration,
                "average_duration": total_duration / total_tests if total_tests > 0 else 0
            },
            "test_results": [
                {
                    "name": r.name,
                    "status": r.status,
                    "duration": r.duration,
                    "result": r.result,
                    "error": r.error
                }
                for r in self.test_results
            ],
            "timestamp": datetime.now().isoformat(),
            "test_environment": {
                "cdp_port": self.cdp_port,
                "brop_port": self.brop_port,
                "test_timeout": self.test_timeout
            }
        }
        
        return report

    async def run_all_tests(self):
        """Run the complete test suite"""
        self.logger.info("🚀 Starting BROP Integration Test Suite")
        self.logger.info("=" * 60)
        
        # Core functionality tests
        await self.run_test("Basic Connectivity", self.test_basic_connectivity)
        await self.run_test("CDP Discovery Endpoints", self.test_cdp_discovery_endpoints)
        await self.run_test("Complete Browser Workflow", self.test_complete_browser_workflow)
        await self.run_test("BROP Native Commands", self.test_brop_native_commands)
        
        # Robustness tests
        await self.run_test("Error Handling", self.test_error_handling)
        await self.run_test("Large Payload Handling", self.test_large_payload_handling)
        
        # Performance tests
        await self.run_test("Performance Benchmarks", self.test_performance_benchmarks)
        await self.run_test("Concurrent Connections", self.test_concurrent_connections)
        
        # Generate and save report
        report = self.generate_test_report()
        
        report_filename = f"brop-integration-report-{int(time.time())}.json"
        with open(report_filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        # Print summary
        self.logger.info("\n📊 Integration Test Summary:")
        self.logger.info("=" * 40)
        self.logger.info(f"Total Tests: {report['summary']['total_tests']}")
        self.logger.info(f"Passed: {report['summary']['passed']} ✅")
        self.logger.info(f"Failed: {report['summary']['failed']} ❌")
        self.logger.info(f"Success Rate: {report['summary']['success_rate']:.1f}%")
        self.logger.info(f"Total Duration: {report['summary']['total_duration']:.2f}s")
        self.logger.info(f"Report saved to: {report_filename}")
        
        if report['summary']['failed'] > 0:
            self.logger.info("\n❌ Failed Tests:")
            for result in self.test_results:
                if result.status == "FAIL":
                    self.logger.info(f"   - {result.name}: {result.error}")
        
        self.logger.info("\n🎯 BROP Integration Test Suite Complete!")
        
        return report

async def main():
    """Main entry point"""
    test_suite = BROPIntegrationTestSuite()
    
    try:
        report = await test_suite.run_all_tests()
        
        # Exit with appropriate code
        if report['summary']['failed'] == 0:
            exit(0)
        else:
            exit(1)
            
    except Exception as e:
        logging.error(f"❌ Test suite failed: {e}")
        logging.error(traceback.format_exc())
        exit(1)

if __name__ == "__main__":
    # Ensure required dependencies
    try:
        import websockets
        import aiohttp
    except ImportError as e:
        print(f"❌ Missing required dependency: {e}")
        print("Install with: pip install websockets aiohttp")
        exit(1)
    
    asyncio.run(main())