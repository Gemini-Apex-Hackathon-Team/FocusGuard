/**
 * EXAMPLE: How to integrate Gemini Intervention System
 * 
 * This is example code showing how to add the intervention system
 * to your existing background script.
 * 
 * ============================================================================
 * IMPORTS (Add these at the top of your background script)
 * ============================================================================
 */

// Existing imports (you already have these)
// import { initMediaPipe, detectFace } from './lib/mediapipe-loader.js';
// import { setApiKey as setGeminiKey } from './lib/gemini-client.js';

// NEW IMPORTS: Add these
import GeminiInterventionEngine from './lib/gemini-intervention-engine.js';
import InterventionIntegration from './lib/intervention-integration.js';

/**
 * ============================================================================
 * INITIALIZATION (Add to your setup code)
 * ============================================================================
 */

// Your existing Gemini client (you already have this)
// const geminiClient = new GeminiClient();

// NEW: Initialize intervention system
let interventionIntegration = null;

function initializeInterventionSystem() {
    if (typeof GeminiInterventionEngine !== 'undefined') {
        interventionIntegration = new InterventionIntegration(geminiClient);
        console.log('✅ Gemini Intervention System initialized');
    } else {
        console.warn('⚠️ Intervention system not available');
    }
}

// Call this after geminiClient is ready
initializeInterventionSystem();

/**
 * ============================================================================
 * DETECTION LOOP (Update your existing detection loop)
 * ============================================================================
 */

// Your existing detection interval (modify this):
setInterval(async () => {
    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        
        // YOUR EXISTING CODE:
        // Compute attention score from MediaPipe
        const attentionScore = computeAttentionScore(); // Your function
        
        // Compute distraction score
        const distractionScore = calculateDistractionScore(); // Your function
        
        // Optional: Get sleepiness score if available
        const sleepinessScore = calculateSleepiness(); // Your function (can return null)
        
        // Track session time
        const sessionTime = Math.floor((Date.now() - sessionStartTime) / 1000);
        
        // ============================================================
        // NEW: INTERVENTION SYSTEM PROCESSING
        // ============================================================
        
        if (interventionIntegration) {
            // Step 1: Extract page content
            const contentAnalysis = await interventionIntegration.extractPageContent(tab.id);
            
            // Step 2: Process user state for intervention
            const interventionDecision = await interventionIntegration.processUserState({
                attentionScore: attentionScore,        // 0-100
                distractionScore: distractionScore,    // 0-100
                sleepinessScore: sleepinessScore,      // 0-100 or null
                sessionTimeSeconds: sessionTime,       // seconds
                currentTabId: tab.id,
                contentAnalysis: contentAnalysis       // { text, contentType, title, ... }
            });
            
            // Step 3: Log decision
            if (interventionDecision.shouldIntervene) {
                console.log('💡 Intervention triggered:', interventionDecision.action);
            }
        }
        
        // ============================================================
        // Your existing code continues...
        // Update UI, track stats, etc.
        // ============================================================
        
    } catch (error) {
        console.error('❌ Detection loop error:', error);
    }
}, 30000); // Run every 30 seconds

/**
 * ============================================================================
 * MESSAGE HANDLERS (Add to your existing message listeners)
 * ============================================================================
 */

// Add this new handler for intervention responses
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Existing handlers...
    // if (request.type === 'GET_PAGE_CONTENT') { ... }
    // etc.
    
    // NEW: Handle intervention responses from content script
    if (request.type === 'INTERVENTION_RESPONSE') {
        console.log('📤 Intervention response received:', request);
        
        if (interventionIntegration) {
            interventionIntegration.handleInterventionResponse(request);
        }
        
        sendResponse({ received: true });
    }
    
    // Keep existing handlers by NOT returning true here
    // Let them fall through to existing handlers
});

/**
 * ============================================================================
 * HELPER FUNCTIONS (Add these)
 * ============================================================================
 */

// Example: Compute attention score from MediaPipe
function computeAttentionScore() {
    // This should come from your existing MediaPipe detection
    // Return value between 0-100
    return 75; // Example
}

// Example: Calculate distraction score from metrics
function calculateDistractionScore() {
    let score = 0;
    
    // Check rapid tab switching
    const recentSwitches = 0; // Your tracking
    if (recentSwitches > 5) {
        score += Math.min(40, (recentSwitches / 15) * 40);
    }
    
    // Check excessive scrolling
    const scrollCount = 0; // Your tracking
    if (scrollCount > 50) {
        score += Math.min(30, (scrollCount / 100) * 30);
    }
    
    // Check erratic mouse movement
    const mouseDistance = 0; // Your tracking
    if (mouseDistance > 20) {
        score += Math.min(20, (mouseDistance / 50) * 20);
    }
    
    return Math.min(100, score);
}

// Example: Calculate sleepiness (optional)
function calculateSleepiness() {
    // This could come from eye closure metrics
    // Return 0-100 or null if not available
    return null;
}

/**
 * ============================================================================
 * DIAGNOSTICS (Optional - for debugging)
 * ============================================================================
 */

// Function to check intervention system status
function getInterventionDiagnostics() {
    if (!interventionIntegration) {
        return { status: 'not_initialized' };
    }
    
    return interventionIntegration.getDiagnostics();
}

// Example usage in console:
// getInterventionDiagnostics()
// Output:
// {
//   engineDiagnostics: {
//     sessionDurationSeconds: 1500,
//     interventionsInSession: 2,
//     canInterveneNow: true,
//     timeSinceLastInterventionMs: 300000,
//     nextInterventionInSeconds: 0
//   },
//   pendingInterventions: 0,
//   cachedTabs: 1
// }

/**
 * ============================================================================
 * CONTENT SCRIPT INTEGRATION
 * ============================================================================
 */

/*
 * In your content script (content.js), add this:
 * 
 * // Listen for intervention messages from background
 * chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
 *     if (request.type === 'SHOW_INTERVENTION') {
 *         const intervention = request.intervention;
 *         
 *         console.log('📥 Received intervention:', intervention.type);
 *         
 *         // Render intervention based on type
 *         if (intervention.type === 'message') {
 *             showMessageIntervention(intervention.message);
 *         } else if (intervention.type === 'quiz') {
 *             showQuizIntervention(intervention.quiz);
 *         } else if (intervention.type === 'break') {
 *             showBreakIntervention(intervention.message);
 *         }
 *         
 *         sendResponse({ received: true });
 *     }
 *     
 *     // Handle user response
 *     if (request.type === 'GET_ENHANCED_CONTENT') {
 *         const content = extractPageContent();
 *         sendResponse(content);
 *     }
 * });
 * 
 * // Example: Show message intervention
 * function showMessageIntervention(message) {
 *     const overlay = document.createElement('div');
 *     overlay.className = 'fyx-intervention-message';
 *     overlay.innerHTML = `
 *         <div class="fyx-message-box">
 *             <p>${message}</p>
 *             <button onclick="this.parentElement.parentElement.remove()">Got it</button>
 *         </div>
 *     `;
 *     document.body.appendChild(overlay);
 * }
 * 
 * // Example: Show quiz intervention
 * function showQuizIntervention(quiz) {
 *     const overlay = document.createElement('div');
 *     overlay.className = 'fyx-intervention-quiz';
 *     overlay.innerHTML = `
 *         <div class="fyx-quiz-box">
 *             <h3>${quiz.question}</h3>
 *             <div class="fyx-options">
 *                 ${quiz.options.map((opt, idx) => `
 *                     <button onclick="handleQuizAnswer(${idx}, ${quiz.correctIndex})">
 *                         ${opt}
 *                     </button>
 *                 `).join('')}
 *             </div>
 *         </div>
 *     `;
 *     document.body.appendChild(overlay);
 * }
 * 
 * // Handle user response back to background
 * function sendInterventionResponse(action) {
 *     chrome.runtime.sendMessage({
 *         type: 'INTERVENTION_RESPONSE',
 *         action: action,  // 'accepted', 'dismissed', 'quiz_correct', etc.
 *         interventionType: 'message' // or 'quiz', 'break'
 *     });
 * }
 */

/**
 * ============================================================================
 * COMPLETE EXAMPLE: Day in the life
 * ============================================================================
 * 
 * 1. User opens a tab with article (TIME: 0:00)
 *    ✓ Extension detects tab, starts monitoring
 *    ✓ Content analyzer extracts text
 *    ✓ MediaPipe starts face detection
 * 
 * 2. First detection cycle (TIME: 0:30)
 *    ✓ Attention score: 85% (focused, reading article)
 *    ✓ Distraction score: 20% (minimal tab switching)
 *    ✓ Decision: No intervention needed (user is focused)
 * 
 * 3. Second detection cycle (TIME: 1:00)
 *    ✓ Attention score: 45% (attention drifting)
 *    ✓ Distraction score: 65% (rapid tab switching detected)
 *    ✓ Session time: 60 seconds
 *    ✓ User state: DISTRACTED
 *    ✓ Decision: YES, intervene
 *    ✓ Gemini response: { type: "message", message: "Try to minimize tab switching..." }
 *    ✓ Content script receives intervention
 *    ✓ Message overlay shown to user
 * 
 * 4. User responds (TIME: 1:15)
 *    ✓ User clicks "Got it" on message
 *    ✓ Content script sends INTERVENTION_RESPONSE
 *    ✓ Background logs intervention outcome
 *    ✓ Cooldown activated (next intervention not before TIME: 3:15)
 * 
 * 5. User continues reading (TIME: 2:00)
 *    ✓ Attention score: 72% (recovering)
 *    ✓ Distraction score: 30% (reduced tab switching)
 *    ✓ Decision: No intervention (attention improving)
 * 
 * 6. Long session (TIME: 45:00)
 *    ✓ Attention score: 40% (fatigue setting in)
 *    ✓ Session time: 2700 seconds (45 minutes)
 *    ✓ User state: WANDERING (long session + declining focus)
 *    ✓ Decision: YES, intervene
 *    ✓ Gemini response: { type: "break", message: "You've been focused for a while..." }
 *    ✓ Break suggestion shown
 * 
 * ============================================================================
 */
