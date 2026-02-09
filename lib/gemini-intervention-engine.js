/**
 * Gemini Intervention Engine
 * 
 * Integrates Gemini-powered intelligent interventions with:
 * - MediaPipe attention scoring (physiological signals)
 * - Content analysis (page context)
 * - Distraction metrics (behavioral signals)
 * - User state detection (focused, distracted, fatigued)
 * 
 * CORE PRINCIPLE:
 * MediaPipe + Content = Context
 * Gemini decides WHAT to say/ask (not WHEN to intervene)
 */

class GeminiInterventionEngine {
    constructor(geminiClient) {
        this.geminiClient = geminiClient;
        
        // Intervention cooldown
        this.lastInterventionTime = 0;
        this.interventionCooldown = 120000; // 2 minutes between interventions
        
        // Session tracking
        this.sessionStartTime = Date.now();
        this.interventionCount = 0;
        this.maxInterventionsPerSession = 10;
    }
    
    /**
     * Main intervention decision function
     * 
     * INPUT (from background script):
     * {
     *   attentionScore: 0-100,           // MediaPipe signal
     *   distractionScore: 0-100,         // Behavioral signal
     *   sleepinessScore: 0-100 | null,   // Optional eye closure metric
     *   contentAnalysis: {
     *     text: string,                  // Page content (limited)
     *     contentType: 'article'|'video'|'code'|etc,
     *     title: string,
     *     url: string,
     *     scrollPosition: number,
     *     timeOnPage: number (seconds)
     *   },
     *   sessionTime: number (seconds)
     * }
     * 
     * OUTPUT:
     * {
     *   shouldIntervene: boolean,
     *   action: 'none'|'message'|'quiz'|'break',
     *   intervention: { type, message?, quiz?, reasoning }
     * }
     */
    async decide(context) {
        try {
            // Validate input
            if (!context || typeof context.attentionScore !== 'number') {
                return { shouldIntervene: false, action: 'none' };
            }
            
            // Check intervention cooldown
            if (!this.canIntervene()) {
                return { 
                    shouldIntervene: false, 
                    action: 'none',
                    reason: 'Cooldown active'
                };
            }
            
            // Detect user state
            const userState = this.detectUserState(context);
            
            // Decide if intervention is appropriate
            if (!this.shouldInterveneBased(userState, context)) {
                return { 
                    shouldIntervene: false, 
                    action: 'none',
                    reason: 'Focus level good'
                };
            }
            
            // Build Gemini prompt
            const prompt = this.buildInterventionPrompt(context, userState);
            
            // Get Gemini response
            const response = await this.geminiClient.generateIntervention(prompt);
            
            // Parse and validate response
            const intervention = this.parseGeminiResponse(response);
            
            if (intervention) {
                this.lastInterventionTime = Date.now();
                this.interventionCount++;
                console.log(`💡 Intervention triggered (${this.interventionCount}): ${intervention.type}`);
                return {
                    shouldIntervene: true,
                    action: intervention.type,
                    intervention: intervention
                };
            }
            
            return { shouldIntervene: false, action: 'none' };
            
        } catch (error) {
            console.error('❌ Intervention decision error:', error);
            return { shouldIntervene: false, action: 'none', error: error.message };
        }
    }
    
    /**
     * Detect user state from attention and distraction signals
     */
    detectUserState(context) {
        const { attentionScore, distractionScore, sleepinessScore, sessionTime } = context;
        
        // Normalize scores (0-100)
        const attention = Math.max(0, Math.min(100, attentionScore || 0));
        const distraction = Math.max(0, Math.min(100, distractionScore || 0));
        const sleepiness = sleepinessScore ? Math.max(0, Math.min(100, sleepinessScore)) : null;
        
        // State logic
        let state = 'focused';
        let intensity = 'low';
        
        if (sleepiness && sleepiness > 60) {
            state = 'fatigued';
            intensity = sleepiness > 80 ? 'critical' : 'high';
        } else if (distraction > 60) {
            state = 'distracted';
            intensity = distraction > 80 ? 'critical' : 'high';
        } else if (attention < 40) {
            state = 'wandering';
            intensity = attention < 20 ? 'critical' : 'medium';
        }
        
        // Session duration consideration
        const sessionMinutes = Math.floor((sessionTime || 0) / 60);
        if (sessionMinutes > 45 && attention < 60) {
            intensity = 'high'; // Suggest break after long session
        }
        
        return {
            state,
            intensity,
            attention,
            distraction,
            sleepiness,
            sessionMinutes
        };
    }
    
    /**
     * Decide if intervention is appropriate based on user state
     */
    shouldInterveneBased(userState, context) {
        const { state, intensity, attention, distraction, sessionMinutes } = userState;
        
        // Don't intervene if user is highly focused
        if (state === 'focused' && intensity === 'low' && attention > 75) {
            return false;
        }
        
        // Intervene for:
        // 1. Fatigued users (regardless of attention)
        if (state === 'fatigued' && intensity !== 'low') {
            return true;
        }
        
        // 2. Distracted users (moderate or high distraction)
        if (state === 'distracted' && distraction > 50) {
            return true;
        }
        
        // 3. Wandering attention + long session
        if (state === 'wandering' && sessionMinutes > 30) {
            return true;
        }
        
        // 4. Critical states always intervene
        if (intensity === 'critical') {
            return true;
        }
        
        return false;
    }
    
    /**
     * Build Gemini prompt for intervention generation
     */
    buildInterventionPrompt(context, userState) {
        const { 
            contentAnalysis, 
            sessionTime 
        } = context;
        
        const {
            state,
            intensity,
            attention,
            distraction,
            sleepiness,
            sessionMinutes
        } = userState;
        
        // Build content context (limit to avoid token bloat)
        const contentSnippet = contentAnalysis?.text 
            ? contentAnalysis.text.substring(0, 500)
            : 'Unable to extract content';
        
        const systemPrompt = `You are an intelligent focus coach in a learning extension. Your role is to gently help users maintain focus through supportive, non-intrusive interventions.

USER CONTEXT:
- Content type: ${contentAnalysis?.contentType || 'unknown'}
- Page title: ${contentAnalysis?.title || 'Untitled'}
- Session duration: ${sessionMinutes} minutes
- Time on current page: ${contentAnalysis?.timeOnPageSeconds || 0} seconds

PHYSICAL SIGNALS (Probabilistic, not absolute):
- Attention level: ${attention}% (head pose, eye openness, gaze direction)
- Distraction indicators: ${distraction}% (tab switching, scrolling patterns, mouse movement)
${sleepiness ? `- Sleepiness signal: ${sleepiness}% (eye closure, blink rate)` : ''}

USER STATE DETECTED: ${state.toUpperCase()} (${intensity})

CONTENT SAMPLE:
"${contentSnippet}"

GUIDELINES:
1. Match tone to user state:
   - Focused → encourage continuation
   - Distracted → gentle redirection to content
   - Fatigued → restorative break suggestion
   - Wandering → reflective question to re-engage

2. Choose appropriate action:
   - message: Supportive nudge (for mild focus dips)
   - quiz: Quick comprehension check (for moderate distraction)
   - break: Rest suggestion (for fatigue or long sessions)

3. Never:
   - Mention MediaPipe, cameras, or tracking
   - Claim certainty about mental state
   - Use accusatory or shaming language
   - Suggest user isn't intelligent or capable

4. Always:
   - Be supportive and optional
   - Reference the actual content when possible
   - Keep interventions brief (1-2 sentences for message)
   - Frame as helpful, not judgmental

RESPOND WITH ONLY VALID JSON (no markdown):
{
  "type": "message|quiz|break",
  "message": "supportive text (only if type=message)",
  "quiz": {
    "question": "content-relevant question",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "explanation": "why this matters"
  },
  "reasoning": "brief internal justification for this intervention"
}`;

        return systemPrompt;
    }
    
    /**
     * Parse and validate Gemini response
     */
    parseGeminiResponse(response) {
        try {
            if (!response) {
                console.warn('⚠️ Empty Gemini response');
                return null;
            }
            
            // Extract JSON from response (handle markdown code blocks)
            let jsonText = response;
            if (response.includes('```')) {
                const match = response.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
                if (match) jsonText = match[1];
            }
            
            const intervention = JSON.parse(jsonText);
            
            // Validate required fields
            if (!intervention.type || !['message', 'quiz', 'break'].includes(intervention.type)) {
                console.warn('⚠️ Invalid intervention type:', intervention.type);
                return null;
            }
            
            // Validate based on type
            if (intervention.type === 'message') {
                if (!intervention.message || typeof intervention.message !== 'string') {
                    console.warn('⚠️ Invalid message intervention');
                    return null;
                }
                // Keep only message and type
                return {
                    type: 'message',
                    message: intervention.message.substring(0, 200),
                    reasoning: intervention.reasoning || ''
                };
            }
            
            if (intervention.type === 'quiz') {
                if (!intervention.quiz || !Array.isArray(intervention.quiz.options) || 
                    intervention.quiz.options.length !== 4 ||
                    typeof intervention.quiz.correctIndex !== 'number') {
                    console.warn('⚠️ Invalid quiz structure');
                    return null;
                }
                return {
                    type: 'quiz',
                    quiz: {
                        question: intervention.quiz.question.substring(0, 300),
                        options: intervention.quiz.options.map(o => o.substring(0, 100)),
                        correctIndex: intervention.quiz.correctIndex,
                        explanation: intervention.quiz.explanation?.substring(0, 200) || ''
                    },
                    reasoning: intervention.reasoning || ''
                };
            }
            
            if (intervention.type === 'break') {
                return {
                    type: 'break',
                    message: intervention.message?.substring(0, 200) || 'Time for a quick break!',
                    reasoning: intervention.reasoning || ''
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Error parsing Gemini response:', error);
            return null;
        }
    }
    
    /**
     * Check if intervention cooldown has passed
     */
    canIntervene() {
        const timeSinceLastIntervention = Date.now() - this.lastInterventionTime;
        return timeSinceLastIntervention >= this.interventionCooldown;
    }
    
    /**
     * Reset session state
     */
    resetSession() {
        this.sessionStartTime = Date.now();
        this.interventionCount = 0;
        this.lastInterventionTime = 0;
    }
    
    /**
     * Get diagnostic info
     */
    getDiagnostics() {
        const sessionDuration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
        const timeSinceLastIntervention = Date.now() - this.lastInterventionTime;
        
        return {
            sessionDurationSeconds: sessionDuration,
            interventionsInSession: this.interventionCount,
            canInterveneNow: this.canIntervene(),
            timeSinceLastInterventionMs: timeSinceLastIntervention,
            nextInterventionInSeconds: Math.ceil((this.interventionCooldown - timeSinceLastIntervention) / 1000)
        };
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeminiInterventionEngine;
}
