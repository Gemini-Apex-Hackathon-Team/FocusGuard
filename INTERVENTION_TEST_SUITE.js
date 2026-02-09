/**
 * INTERVENTION SYSTEM - TEST GUIDE
 * 
 * This guide shows you how to test the Gemini intervention system
 * in your browser console and verify everything works.
 */

// ============================================================================
// TEST 1: Check if Intervention System Initialized
// ============================================================================

/**
 * Run this in browser console (F12) to check if system is ready
 */
function testInitialization() {
    console.log('🧪 TEST 1: Checking Intervention System Initialization...\n');
    
    // Check if classes exist
    if (typeof GeminiInterventionEngine !== 'undefined') {
        console.log('✅ GeminiInterventionEngine loaded');
    } else {
        console.log('❌ GeminiInterventionEngine NOT found');
    }
    
    if (typeof InterventionIntegration !== 'undefined') {
        console.log('✅ InterventionIntegration loaded');
    } else {
        console.log('❌ InterventionIntegration NOT found');
    }
    
    // Check if instance exists
    if (typeof interventionIntegration !== 'undefined' && interventionIntegration !== null) {
        console.log('✅ interventionIntegration instance created');
        console.log('   Diagnostics:', interventionIntegration.getDiagnostics());
    } else {
        console.log('❌ interventionIntegration instance NOT found');
        console.log('   Make sure you initialized it in background script:');
        console.log('   interventionIntegration = new InterventionIntegration(geminiClient);');
    }
}

// Run this test:
// testInitialization()

// ============================================================================
// TEST 2: Test User State Detection
// ============================================================================

/**
 * Test the state detection logic with different score combinations
 */
function testStateDetection() {
    console.log('\n🧪 TEST 2: Testing User State Detection...\n');
    
    if (typeof interventionIntegration === 'undefined') {
        console.log('❌ interventionIntegration not available');
        return;
    }
    
    const engine = interventionIntegration.interventionEngine;
    
    // Test cases
    const testCases = [
        {
            name: 'User is FOCUSED',
            attention: 85,
            distraction: 20,
            sleepiness: null
        },
        {
            name: 'User is DISTRACTED',
            attention: 45,
            distraction: 70,
            sleepiness: null
        },
        {
            name: 'User is FATIGUED',
            attention: 40,
            distraction: 30,
            sleepiness: 75
        },
        {
            name: 'User is WANDERING (long session)',
            attention: 35,
            distraction: 40,
            sleepiness: null,
            sessionTime: 2700 // 45 minutes
        },
        {
            name: 'Critical state (very low attention)',
            attention: 15,
            distraction: 60,
            sleepiness: 85
        }
    ];
    
    testCases.forEach(testCase => {
        const context = {
            attentionScore: testCase.attention,
            distractionScore: testCase.distraction,
            sleepinessScore: testCase.sleepiness,
            sessionTime: testCase.sessionTime || 600
        };
        
        const state = engine.detectUserState(context);
        console.log(`\n${testCase.name}:`);
        console.log(`  Scores: Attention=${testCase.attention}% | Distraction=${testCase.distraction}%${testCase.sleepiness ? ` | Sleepiness=${testCase.sleepiness}%` : ''}`);
        console.log(`  → State: ${state.state.toUpperCase()}`);
        console.log(`  → Intensity: ${state.intensity}`);
        console.log(`  → Should Intervene: ${engine.shouldInterveneBased(state, context) ? '✅ YES' : '❌ NO'}`);
    });
}

// Run this test:
// testStateDetection()

// ============================================================================
// TEST 3: Test Content Extraction
// ============================================================================

/**
 * Test page content extraction
 */
async function testContentExtraction() {
    console.log('\n🧪 TEST 3: Testing Content Extraction...\n');
    
    if (typeof interventionIntegration === 'undefined') {
        console.log('❌ interventionIntegration not available');
        return;
    }
    
    try {
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            console.log('❌ No active tab found');
            return;
        }
        
        console.log(`📄 Current Tab: ${tab.title}`);
        console.log(`🔗 URL: ${tab.url}`);
        
        // Extract content
        console.log('\n📥 Extracting page content...');
        const content = await interventionIntegration.extractPageContent(tab.id);
        
        if (content) {
            console.log('✅ Content extraction successful!');
            console.log(`  Content Type: ${content.contentType || 'unknown'}`);
            console.log(`  Text Length: ${content.text ? content.text.length : 0} characters`);
            console.log(`  Title: ${content.title || 'unknown'}`);
            console.log(`  Time on Page: ${content.timeOnPageSeconds || 0} seconds`);
            console.log(`  Scroll Position: ${content.scrollPosition || 0}%`);
            console.log(`  Sample Text: "${content.text ? content.text.substring(0, 100) + '...' : 'N/A'}"`);
        } else {
            console.log('❌ Content extraction returned null');
        }
    } catch (error) {
        console.log('❌ Error during content extraction:', error);
    }
}

// Run this test:
// testContentExtraction()

// ============================================================================
// TEST 4: Test Intervention Decision (WITHOUT Gemini call)
// ============================================================================

/**
 * Test the decision logic without actually calling Gemini
 * (saves API quota during testing)
 */
function testInterventionDecision() {
    console.log('\n🧪 TEST 4: Testing Intervention Decision Logic...\n');
    
    if (typeof interventionIntegration === 'undefined') {
        console.log('❌ interventionIntegration not available');
        return;
    }
    
    const engine = interventionIntegration.interventionEngine;
    
    // Test case: Distracted user
    const context = {
        attentionScore: 45,
        distractionScore: 70,
        sleepinessScore: null,
        contentAnalysis: {
            text: 'This is a sample article about machine learning and artificial intelligence.',
            contentType: 'article',
            title: 'Learning ML',
            url: 'https://example.com/ml'
        },
        sessionTime: 600
    };
    
    console.log('📊 Test Context:');
    console.log(`  Attention: ${context.attentionScore}%`);
    console.log(`  Distraction: ${context.distractionScore}%`);
    console.log(`  Content Type: ${context.contentAnalysis.contentType}`);
    
    const userState = engine.detectUserState(context);
    console.log(`\n🧠 Detected State: ${userState.state.toUpperCase()} (${userState.intensity})`);
    
    const shouldIntervene = engine.shouldInterveneBased(userState, context);
    console.log(`\n⚠️ Should Intervene: ${shouldIntervene ? '✅ YES' : '❌ NO'}`);
    
    const canIntervene = engine.canIntervene();
    console.log(`✅ Can Intervene Now: ${canIntervene ? 'YES (no cooldown)' : 'NO (in cooldown)'}`);
    
    if (shouldIntervene && canIntervene) {
        const prompt = engine.buildInterventionPrompt(context, userState);
        console.log(`\n📝 Gemini Prompt would be:\n`);
        console.log(prompt.substring(0, 500) + '...');
    }
}

// Run this test:
// testInterventionDecision()

// ============================================================================
// TEST 5: Test Full Intervention Flow (WITH Gemini - uses API quota!)
// ============================================================================

/**
 * IMPORTANT: This test actually calls Gemini API!
 * Only run if you have API quota available.
 * Will consume API tokens.
 */
async function testFullInterventionFlow() {
    console.log('\n🧪 TEST 5: Testing FULL Intervention Flow (Calls Gemini API)...\n');
    console.log('⚠️  WARNING: This test will use API quota!\n');
    
    if (typeof interventionIntegration === 'undefined') {
        console.log('❌ interventionIntegration not available');
        return;
    }
    
    try {
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            console.log('❌ No active tab found');
            return;
        }
        
        // Create test context with distracted user
        const testContext = {
            attentionScore: 40,      // Low attention
            distractionScore: 65,    // Distracted
            sleepinessScore: null,
            sessionTimeSeconds: 900,  // 15 minutes
            currentTabId: tab.id,
            contentAnalysis: {
                text: 'Machine learning is a subset of artificial intelligence...',
                contentType: 'article',
                title: tab.title,
                url: tab.url,
                scrollPosition: 45,
                timeOnPageSeconds: 300
            }
        };
        
        console.log('📊 Test Context:');
        console.log(`  Attention: ${testContext.attentionScore}%`);
        console.log(`  Distraction: ${testContext.distractionScore}%`);
        console.log(`  Content: ${testContext.contentAnalysis.title}`);
        console.log('');
        
        console.log('🔄 Processing user state for intervention...');
        const decision = await interventionIntegration.processUserState(testContext);
        
        console.log('\n📋 Decision Result:');
        console.log(`  Should Intervene: ${decision.shouldIntervene ? '✅ YES' : '❌ NO'}`);
        console.log(`  Action: ${decision.action}`);
        
        if (decision.shouldIntervene && decision.intervention) {
            console.log('\n💡 Intervention Generated:');
            console.log(`  Type: ${decision.intervention.type}`);
            
            if (decision.intervention.type === 'message') {
                console.log(`  Message: "${decision.intervention.message}"`);
            } else if (decision.intervention.type === 'quiz') {
                console.log(`  Question: "${decision.intervention.quiz.question}"`);
                console.log(`  Options: ${decision.intervention.quiz.options.join(', ')}`);
                console.log(`  Correct Answer: ${decision.intervention.quiz.options[decision.intervention.quiz.correctIndex]}`);
            } else if (decision.intervention.type === 'break') {
                console.log(`  Break Message: "${decision.intervention.message}"`);
            }
            
            console.log(`\n  Reasoning: ${decision.intervention.reasoning}`);
        } else if (decision.reason) {
            console.log(`  Reason: ${decision.reason}`);
        }
        
    } catch (error) {
        console.log('❌ Error during full flow test:', error);
        if (error.isQuotaError) {
            console.log('\n⚠️  API Quota Exceeded!');
            console.log('   Cooling down for 60 seconds...');
        }
    }
}

// Run this test (be careful - uses API quota!):
// testFullInterventionFlow()

// ============================================================================
// TEST 6: Test Intervention Cooldown
// ============================================================================

/**
 * Test that interventions are throttled after each one
 */
function testCooldown() {
    console.log('\n🧪 TEST 6: Testing Intervention Cooldown...\n');
    
    if (typeof interventionIntegration === 'undefined') {
        console.log('❌ interventionIntegration not available');
        return;
    }
    
    const engine = interventionIntegration.interventionEngine;
    const diagnostics = engine.getDiagnostics();
    
    console.log('📊 Cooldown Status:');
    console.log(`  Can Intervene Now: ${engine.canIntervene() ? '✅ YES' : '❌ NO'}`);
    console.log(`  Time Since Last Intervention: ${diagnostics.timeSinceLastInterventionMs}ms`);
    console.log(`  Cooldown Duration: ${diagnostics.nextInterventionInSeconds}s`);
    
    if (!engine.canIntervene()) {
        console.log(`\n⏳ Next intervention available in: ${diagnostics.nextInterventionInSeconds} seconds`);
        console.log('   (This prevents intervention fatigue)');
    } else {
        console.log('\n✅ Ready for next intervention');
    }
}

// Run this test:
// testCooldown()

// ============================================================================
// TEST 7: Simulate Real User Behavior
// ============================================================================

/**
 * Run multiple tests over time to simulate real user session
 */
async function testRealSessionSimulation() {
    console.log('\n🧪 TEST 7: Simulating Real User Session...\n');
    
    if (typeof interventionIntegration === 'undefined') {
        console.log('❌ interventionIntegration not available');
        return;
    }
    
    const scenarios = [
        {
            time: 0,
            name: 'User starts - focused on reading',
            attention: 85,
            distraction: 15,
            sessionTime: 0
        },
        {
            time: 10,
            name: 'Still focused',
            attention: 80,
            distraction: 20,
            sessionTime: 600
        },
        {
            time: 20,
            name: 'Starting to get distracted',
            attention: 60,
            distraction: 50,
            sessionTime: 1200
        },
        {
            time: 30,
            name: 'Very distracted - rapid tab switching',
            attention: 35,
            distraction: 75,
            sessionTime: 1800
        },
        {
            time: 60,
            name: '30 minutes in - getting tired',
            attention: 45,
            distraction: 40,
            sessionTime: 1800,
            sleepiness: 60
        },
        {
            time: 90,
            name: '45 minutes - fatigue high',
            attention: 30,
            distraction: 50,
            sessionTime: 2700,
            sleepiness: 75
        }
    ];
    
    for (const scenario of scenarios) {
        console.log(`\n⏱️  Time: ${scenario.time}s - ${scenario.name}`);
        console.log(`   Attention: ${scenario.attention}% | Distraction: ${scenario.distraction}%${scenario.sleepiness ? ` | Sleepiness: ${scenario.sleepiness}%` : ''}`);
        
        const context = {
            attentionScore: scenario.attention,
            distractionScore: scenario.distraction,
            sleepinessScore: scenario.sleepiness || null,
            sessionTime: scenario.sessionTime
        };
        
        const state = interventionIntegration.interventionEngine.detectUserState(context);
        const shouldIntervene = interventionIntegration.interventionEngine.shouldInterveneBased(state, context);
        const canIntervene = interventionIntegration.interventionEngine.canIntervene();
        
        console.log(`   → State: ${state.state.toUpperCase()} | Can Intervene: ${canIntervene ? '✅' : '⏳'} | Should: ${shouldIntervene ? '✅' : '❌'}`);
        
        if (shouldIntervene && canIntervene) {
            console.log(`   💡 Would trigger intervention!`);
        }
    }
}

// Run this test:
// testRealSessionSimulation()

// ============================================================================
// QUICK TEST COMMAND
// ============================================================================

/**
 * Run all tests (except ones that use API quota)
 */
function runAllTests() {
    console.clear();
    console.log('🧪 RUNNING ALL INTERVENTION SYSTEM TESTS...\n');
    
    testInitialization();
    testStateDetection();
    testInterventionDecision();
    testCooldown();
    testRealSessionSimulation();
    
    console.log('\n\n✅ All non-API tests completed!');
    console.log('\nWhen ready to test with Gemini API (uses quota), run:');
    console.log('  testContentExtraction()');
    console.log('  testFullInterventionFlow()');
}

// ============================================================================
// HOW TO USE THIS TEST FILE
// ============================================================================

/**
 * 1. Open browser DevTools (F12)
 * 2. Go to "Console" tab
 * 3. Copy-paste this entire file and run it
 *    (Or just keep it open as reference)
 * 4. Run individual tests:
 * 
 *    testInitialization()           ← Check if system loaded
 *    testStateDetection()            ← Test state detection logic
 *    testInterventionDecision()      ← Test decision logic
 *    testCooldown()                  ← Check cooldown status
 *    testContentExtraction()         ← Test page content extraction (API quota!)
 *    testFullInterventionFlow()      ← Full test with Gemini (API quota!)
 *    testRealSessionSimulation()     ← Simulate user behavior
 * 
 *    runAllTests()                   ← Run all tests at once (no API calls)
 * 
 * 5. Look for ✅ (pass) and ❌ (fail) indicators
 * 6. Check browser console for any error messages
 * 7. Monitor the "Next intervention in X seconds" to verify cooldown
 */

// ============================================================================
// EXPECTED OUTPUT FOR HEALTHY SYSTEM
// ============================================================================

/**
 * ✅ GeminiInterventionEngine loaded
 * ✅ InterventionIntegration loaded
 * ✅ interventionIntegration instance created
 *    Diagnostics: {
 *      sessionDurationSeconds: 123,
 *      interventionsInSession: 2,
 *      canInterveneNow: false,
 *      timeSinceLastInterventionMs: 45000,
 *      nextInterventionInSeconds: 75
 *    }
 * 
 * User is FOCUSED:
 *   Scores: Attention=85% | Distraction=20%
 *   → State: FOCUSED
 *   → Intensity: low
 *   → Should Intervene: ❌ NO
 * 
 * User is DISTRACTED:
 *   Scores: Attention=45% | Distraction=70%
 *   → State: DISTRACTED
 *   → Intensity: high
 *   → Should Intervene: ✅ YES
 */

console.log('✅ Intervention Test Suite Loaded!');
console.log('Run: runAllTests() to start testing');
