#!/usr/bin/env node
/**
 * Form Interaction Example using Native BROP Stagehand
 * 
 * This demonstrates typical Stagehand form filling and interaction patterns
 * using our native BROP implementation.
 */

require('dotenv').config({ path: '../../.env' });
const { BROPStagehand } = require('../brop-stagehand-native');

async function formInteractionExample() {
    console.log('📝 Form Interaction Example - Native BROP Stagehand');
    console.log('=' + '='.repeat(50));
    
    let stagehand = null;
    
    try {
        // Initialize Stagehand
        console.log('📋 Step 1: Initializing Stagehand...');
        stagehand = new BROPStagehand({
            verbose: true,
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        await stagehand.init();
        console.log('✅ Native BROP Stagehand initialized');
        
        // Navigate to a form demo page
        console.log('\n📋 Step 2: Navigating to form demo page...');
        await stagehand.navigate('https://httpbin.org/forms/post');
        
        const currentPage = stagehand.getCurrentPage();
        console.log(`✅ Navigation completed: ${currentPage.title}`);
        
        // Observe the form structure
        console.log('\n📋 Step 3: Analyzing form structure...');
        const formElements = await stagehand.observe('Find all form fields, inputs, and buttons on this page');
        
        console.log(`🔍 Form analysis: ${formElements.length} interactive elements found`);
        if (formElements.length > 0) {
            console.log('   📋 Form elements detected:');
            formElements.slice(0, 5).forEach((element, i) => {
                console.log(`      ${i + 1}. ${element.description} (${element.action_type})`);
            });
        }
        
        // Extract form field information
        console.log('\n📋 Step 4: Extracting form field details...');
        const formSchema = await stagehand.extract(
            'Extract information about all form fields including labels and types',
            {
                type: "object",
                properties: {
                    form_title: { type: "string" },
                    fields: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                label: { type: "string" },
                                type: { type: "string" },
                                required: { type: "boolean" },
                                placeholder: { type: "string" }
                            }
                        }
                    },
                    submit_button: { type: "string" }
                }
            }
        );
        
        console.log('📊 Form Structure Analysis:');
        console.log(`   📝 Form Title: ${formSchema.data.form_title || 'N/A'}`);
        console.log(`   🔘 Submit Button: ${formSchema.data.submit_button || 'N/A'}`);
        
        if (formSchema.data.fields && formSchema.data.fields.length > 0) {
            console.log('   📋 Form Fields:');
            formSchema.data.fields.forEach((field, i) => {
                console.log(`      ${i + 1}. ${field.label} (${field.type})`);
            });
        }
        
        // Simulate filling out the form
        console.log('\n📋 Step 5: Simulating form interactions...');
        
        // Fill email field
        console.log('   ✍️  Filling email field...');
        const emailAction = await stagehand.act('Fill in the email field with "test@example.com"', {
            email: 'test@example.com'
        });
        
        if (emailAction.success) {
            console.log('   ✅ Email field filled successfully');
        }
        
        // Fill password field
        console.log('   🔒 Filling password field...');
        const passwordAction = await stagehand.act('Fill in the password field with a secure password', {
            password: 'SecurePassword123!'
        });
        
        if (passwordAction.success) {
            console.log('   ✅ Password field filled successfully');
        }
        
        // Fill other fields if they exist
        console.log('   📝 Filling additional fields...');
        const nameAction = await stagehand.act('If there is a name field, fill it with "Test User"', {
            name: 'Test User'
        });
        
        if (nameAction.success) {
            console.log('   ✅ Additional fields handled');
        }
        
        // Take a screenshot before submission
        console.log('\n📋 Step 6: Capturing form state...');
        const preSubmitScreenshot = await stagehand.screenshot('form_filled');
        console.log(`📸 Pre-submit screenshot: ${preSubmitScreenshot.name}`);
        
        // Simulate form submission (not actually submitting)
        console.log('\n📋 Step 7: Preparing form submission...');
        const submitAction = await stagehand.act('Click the submit button to submit the form');
        
        console.log('🎯 Form submission prepared:');
        console.log(`   📝 Action: ${submitAction.action}`);
        console.log(`   ✅ Ready to submit: ${submitAction.success}`);
        
        // Extract final form state
        console.log('\n📋 Step 8: Extracting final form state...');
        const finalFormState = await stagehand.extract(
            'Extract the current values and state of all form fields',
            {
                type: "object",
                properties: {
                    filled_fields: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                field_name: { type: "string" },
                                current_value: { type: "string" },
                                is_valid: { type: "boolean" }
                            }
                        }
                    },
                    form_ready_to_submit: { type: "boolean" },
                    validation_errors: {
                        type: "array",
                        items: { type: "string" }
                    }
                }
            }
        );
        
        console.log('📊 Final Form State:');
        console.log(`   ✅ Ready to submit: ${finalFormState.data.form_ready_to_submit || false}`);
        
        if (finalFormState.data.filled_fields) {
            console.log('   📝 Filled fields:');
            finalFormState.data.filled_fields.forEach((field, i) => {
                console.log(`      ${i + 1}. ${field.field_name}: ${field.current_value ? '✅ Filled' : '❌ Empty'}`);
            });
        }
        
        if (finalFormState.data.validation_errors && finalFormState.data.validation_errors.length > 0) {
            console.log('   ⚠️ Validation errors:');
            finalFormState.data.validation_errors.forEach((error, i) => {
                console.log(`      ${i + 1}. ${error}`);
            });
        }
        
        // Test navigation back and form persistence
        console.log('\n📋 Step 9: Testing form persistence...');
        
        // Navigate to another page
        await stagehand.navigate('https://httpbin.org/');
        console.log('   🌐 Navigated away from form');
        
        // Navigate back
        await stagehand.navigate('https://httpbin.org/forms/post');
        console.log('   🔙 Navigated back to form');
        
        // Check if form data persisted
        const persistenceCheck = await stagehand.extract(
            'Check if any form fields still contain the previously entered data',
            {
                type: "object",
                properties: {
                    data_persisted: { type: "boolean" },
                    remaining_values: {
                        type: "array",
                        items: { type: "string" }
                    }
                }
            }
        );
        
        console.log('🔄 Form Persistence Test:');
        console.log(`   💾 Data persisted: ${persistenceCheck.data.data_persisted || false}`);
        
        console.log('\n🎉 Form Interaction Example Completed!');
        console.log('\n📈 Capabilities Demonstrated:');
        console.log('   ✅ Form structure analysis');
        console.log('   ✅ Field identification and typing');
        console.log('   ✅ Intelligent form filling');
        console.log('   ✅ Validation state checking');
        console.log('   ✅ Submission preparation');
        console.log('   ✅ Form state persistence testing');
        console.log('   ✅ Multi-step form workflows');
        
        console.log('\n💡 This demonstrates our native BROP Stagehand can handle:');
        console.log('   📝 Complex form interactions');
        console.log('   🧠 Intelligent field recognition');
        console.log('   ⚡ Real-time form validation');
        console.log('   🔄 Multi-page form workflows');
        console.log('   📸 Visual documentation of form states');
        
    } catch (error) {
        console.error('❌ Example failed:', error.message);
        
        if (error.message.includes('Not connected')) {
            console.log('\n🔧 Connection issue:');
            console.log('   1. Start BROP bridge: cd ../bridge-server && node bridge_server.js');
            console.log('   2. Ensure BROP extension is active in Chrome');
        } else if (error.message.includes('API key')) {
            console.log('\n🔧 AI configuration issue:');
            console.log('   1. Check ANTHROPIC_API_KEY in .env file');
        }
    } finally {
        if (stagehand) {
            await stagehand.close();
            console.log('\n🔚 Example cleanup completed');
        }
    }
}

formInteractionExample();