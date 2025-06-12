#!/usr/bin/env node
/**
 * Confirm Assertion Logic
 * 
 * Let's verify exactly what the assertion assert(!object.id) means
 * and what message is causing it to fail.
 */

function testAssertionLogic() {
    console.log('🧪 Testing Assertion Logic');
    console.log('=' + '='.repeat(50));
    
    console.log('The assertion: assert(!object.id)');
    console.log('');
    
    // Test different message types
    const testMessages = [
        { name: 'Valid Event', data: { method: 'Target.targetCreated', params: {} } },
        { name: 'Valid Response', data: { id: 1, result: {} } },
        { name: 'Valid Error Response', data: { id: 2, error: { code: -32000, message: 'Error' } } },
        { name: 'PROBLEMATIC: Response with unknown ID', data: { id: 999, result: {} } },
        { name: 'PROBLEMATIC: Event with ID', data: { id: 3, method: 'Target.targetCreated', params: {} } },
        { name: 'PROBLEMATIC: Response without result/error', data: { id: 4 } }
    ];
    
    testMessages.forEach(test => {
        const hasId = test.data.id !== undefined;
        const hasMethod = test.data.method !== undefined;
        const hasResult = test.data.result !== undefined;
        const hasError = test.data.error !== undefined;
        
        console.log(`\n📋 ${test.name}:`);
        console.log(`   Data: ${JSON.stringify(test.data)}`);
        console.log(`   Has id: ${hasId}`);
        console.log(`   Has method: ${hasMethod}`);
        
        // Simulate Playwright's logic
        const wouldFailAssertion = hasId; // assert(!object.id) fails if id exists
        
        if (hasId) {
            console.log(`   🚨 Would FAIL assert(!object.id) - HAS ID`);
            console.log(`   Playwright expects this to be a response to a known command`);
        } else {
            console.log(`   ✅ Would PASS assert(!object.id) - NO ID`);
            console.log(`   Playwright treats this as an event`);
        }
    });
}

console.log('🎯 Confirm Assertion Logic Test');
console.log('=' + '='.repeat(60));
console.log('Goal: Understand exactly what causes assert(!object.id) to fail');
console.log('');

testAssertionLogic();

console.log('\n💡 Conclusion:');
console.log('The assertion assert(!object.id) fails when:');
console.log('1. Message HAS an id field');
console.log('2. But Playwright doesn\'t recognize that id (not in callbacks)');
console.log('3. So it falls back to event handling');
console.log('4. But events shouldn\'t have id fields');
console.log('');
console.log('🔍 What we need to find:');
console.log('- A response message with an id that Playwright didn\'t expect');
console.log('- OR timing issues where callback was removed before response');
console.log('- OR session routing issues where response goes to wrong session');