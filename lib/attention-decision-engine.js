/**
 * Attention Decision Engine
 * 
 * Combines MediaPipe attention signals with behavioral context
 * Uses Gemini for intelligent, non-intrusive intervention decisions
 * 
 * CORE PRINCIPLE:
 * MediaPipe provides objective physiological signals
 * Gemini provides reasoning about when to intervene
 * Never attempt to infer attention — only use MediaPipe's authoritative score
 */

import { generateAnalysis } from './gemini-client.js';

/**
 * Decision engine state
 */
let attentionHistory = []; // Rolling window of recent attention scores
let lastInterventionTime = 0;
let interventionCooldown = 60000; // 1 minute minimum between interventions
let sessionStartTime = null;

/**
 * Add attention score to rolling history
 * @param {number} score - MediaPipe attention score [0.0, 1.0]
 */
export function recordAttentionScore(score) {
    if (typeof score !== 'number' || score < 0 || score > 1) {
        console.warn('⚠️ Invalid attention score:', score);
        return;
    }
    
    attentionHistory.push({
        score,
        timestamp: Date.now()
    });
    
    // Keep only last 90 seconds of data (rolling window)
    const cutoffTime = Date.now() - 90000;
    attentionHistory = attentionHistory.filter(entry => entry.timestamp > cutoffTime);
}

/**
 * Calculate rolling average attention over time window
 * @param {number} windowSeconds - Time window in seconds (default 60)
 * @returns {number} Average score [0.0, 1.0]
 */
export function getRollingAverageAttention(windowSeconds = 60) {
    if (attentionHistory.length === 0) return 0.5; // Default neutral if no data
    
    const cutoffTime = Date.now() - (windowSeconds * 1000);
    const recentScores = attentionHistory
        .filter(entry => entry.timestamp > cutoffTime)
        .map(entry => entry.score);
    
    if (recentScores.length === 0) return 0.5;
    
    return recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
}

/**
 * Build context snapshot for Gemini
 * @param {Object} contextData - Behavioral and session data
 * @returns {Object} Context snapshot for Gemini
 */
export function buildContextSnapshot(contextData = {}) {
    const avgAttention = getRollingAverageAttention(60);
    
    return {
        attentionScore: Math.round(avgAttention * 100) / 100, // 2 decimal precision
        timeOnPageSeconds: contextData.timeOnPageSeconds || 0,
        scrollCount: contextData.scrollCount || 0,
        mouseMovements: contextData.mouseMovements || 0,
        idleTimeSeconds: contextData.idleTimeSeconds || 0,
        contentType: contextData.contentType || 'unknown',
        pageExcerpt: contextData.pageExcerpt || '',
        sessionDurationSeconds: sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0
    };
}

/**
 * Determine if intervention is allowed (respects cooldown)
 * @returns {boolean} True if enough time has passed since last intervention
 */
export function canIntervene() {
    return Date.now() - lastInterventionTime >= interventionCooldown;
}

/**
 * Apply score threshold heuristics
 * Determines if Gemini should be consulted
 * @param {number} attentionScore - Normalized score [0.0, 1.0]
 * @returns {Object} Heuristic decision or null if no action needed
 */
export function applyScoreHeuristics(attentionScore) {
    // High focus - likely no intervention needed
    if (attentionScore >= 0.75) {
        return { action: 'do_nothing', reason: 'score_high' };
    }
    
    // Very low focus - strongly favor break
    if (attentionScore < 0.20) {
        return { action: 'show_break', reason: 'score_critical' };
    }
    
    // Moderate-low attention - consult Gemini
    // (Gemini will decide between quiz, tip, or nothing based on context)
    return null;
}

/**
 * Main decision function - Get intervention recommendation from Gemini
 * @param {Object} contextData - Behavioral and session data
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Intervention decision
 */
export async function getInterventionDecision(contextData = {}, apiKey) {
    try {
        // Build the context snapshot
        const context = buildContextSnapshot(contextData);
        
        // Apply heuristics first
        const heuristic = applyScoreHeuristics(context.attentionScore);
        if (heuristic) {
            console.log('📊 Heuristic decision (no Gemini needed):', heuristic);
            return heuristic;
        }
        
        // Check intervention cooldown
        if (!canIntervene()) {
            console.log('⏸️ Intervention cooldown active');
            return { action: 'do_nothing', reason: 'cooldown' };
        }
        
        // Consult Gemini for intelligent reasoning
        console.log('🧠 Consulting Gemini for intervention decision...');
        console.log('   Context:', context);
        
        const prompt = buildGeminiPrompt(context);
        const response = await generateAnalysis(prompt, apiKey);
        
        // Parse and validate Gemini response
        const decision = parseGeminiResponse(response);
        
        // Record successful intervention
        if (decision.action !== 'do_nothing') {
            lastInterventionTime = Date.now();
            console.log('✅ Intervention recorded:', decision.action);
        }
        
        return decision;
        
    } catch (error) {
        console.error('❌ Error in intervention decision:', error);
        return { action: 'do_nothing', reason: 'error' };
    }
}

/**
 * Build Gemini prompt with context
 * @param {Object} context - Context snapshot
 * @returns {string} Prompt for Gemini
 */
function buildGeminiPrompt(context) {
    return `You are a supportive focus coach. Based on the user's current state, decide if a brief intervention would help.

USER STATE:
- Physical attention level: ${(context.attentionScore * 100).toFixed(0)}% (normalized from camera-free physiological signals)
- Time on page: ${context.timeOnPageSeconds} seconds
- Content type: ${context.contentType}
- Recent activity: ${context.scrollCount} scrolls, ${context.mouseMovements} mouse movements
- Idle time: ${context.idleTimeSeconds} seconds
- Session duration: ${context.sessionDurationSeconds} seconds

CONTENT EXCERPT: "${context.pageExcerpt}"

DECISION FRAMEWORK:
- attention ≥ 75%: User is focused, do nothing
- attention 55-75%: Optional focus tip if context suggests distraction
- attention 35-55%: Consider a quick quiz or gentle refocus suggestion
- attention 20-35%: Recommend a short break
- attention < 20%: Strongly recommend a break

CONSTRAINTS:
1. Choose EXACTLY ONE action
2. Never mention cameras, vision systems, or tracking
3. Be supportive and optional, never accusatory
4. Frame as a "quick check-in" or "optional reset", not surveillance
5. Only include quiz if action is "show_quiz"
6. Return ONLY valid JSON, no markdown

REQUIRED JSON OUTPUT:
{
  "action": "do_nothing|show_focus_tip|show_break|show_quiz|show_relevance_warning",
  "reason": "brief internal reasoning",
  "message": "user-facing text if action != do_nothing (supportive tone, no urgency)",
  "quiz": {
    "question": "string",
    "options": ["option1", "option2", "option3", "option4"],
    "correctIndex": 0,
    "explanation": "string"
  }
}

Respond with ONLY the JSON object.`;
}

/**
 * Parse and validate Gemini response
 * @param {string} response - Raw Gemini response
 * @returns {Object} Validated decision object
 */
function parseGeminiResponse(response) {
    try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('❌ No JSON found in Gemini response');
            return { action: 'do_nothing', reason: 'parse_error' };
        }
        
        const decision = JSON.parse(jsonMatch[0]);
        
        // Validate required fields
        const validActions = [
            'do_nothing',
            'show_focus_tip',
            'show_break',
            'show_quiz',
            'show_relevance_warning'
        ];
        
        if (!validActions.includes(decision.action)) {
            console.warn('⚠️ Invalid action from Gemini:', decision.action);
            return { action: 'do_nothing', reason: 'invalid_action' };
        }
        
        // Validate quiz structure if action is show_quiz
        if (decision.action === 'show_quiz') {
            if (!decision.quiz || !Array.isArray(decision.quiz.options) || decision.quiz.options.length !== 4) {
                console.warn('⚠️ Invalid quiz structure');
                return { action: 'do_nothing', reason: 'invalid_quiz' };
            }
        }
        
        // Remove quiz if action doesn't require it
        if (decision.action !== 'show_quiz') {
            delete decision.quiz;
        }
        
        // Remove message if do_nothing
        if (decision.action === 'do_nothing') {
            delete decision.message;
        }
        
        console.log('✅ Valid Gemini decision:', decision);
        return decision;
        
    } catch (error) {
        console.error('❌ Error parsing Gemini response:', error);
        return { action: 'do_nothing', reason: 'parse_error' };
    }
}

/**
 * Initialize session
 */
export function startSession() {
    sessionStartTime = Date.now();
    attentionHistory = [];
    lastInterventionTime = 0;
    console.log('🎯 Attention decision engine session started');
}

/**
 * Reset session
 */
export function endSession() {
    sessionStartTime = null;
    attentionHistory = [];
    lastInterventionTime = 0;
    console.log('🏁 Attention decision engine session ended');
}

/**
 * Get diagnostic info
 * @returns {Object} Current state for debugging
 */
export function getDiagnostics() {
    return {
        rollingAvgAttention: getRollingAverageAttention(60),
        historyLength: attentionHistory.length,
        canIntervene: canIntervene(),
        timeSinceLastIntervention: Date.now() - lastInterventionTime,
        sessionDuration: sessionStartTime ? Date.now() - sessionStartTime : null
    };
}
