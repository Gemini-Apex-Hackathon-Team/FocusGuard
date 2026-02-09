// FYX Intervention Manager
// Intelligent intervention system that combines sleepiness and distraction detection

class InterventionManager {
    constructor() {
        this.sleepinessScore = 100;
        this.distractionScore = 0;
        this.currentState = 'focused';
        this.lastInterventionTime = 0;
        this.interventionCooldown = 5 * 60 * 1000; // 5 minutes between interventions
    }

    /**
     * Detect user state based on sleepiness and distraction scores
     * @param {number} sleepiness - 0-100, lower = more sleepy
     * @param {number} distraction - 0-100, higher = more distracted
     * @returns {string} - 'focused', 'sleepy', 'distracted', or 'both'
     */
    detectUserState(sleepiness, distraction) {
        this.sleepinessScore = sleepiness;
        this.distractionScore = distraction;

        const isSleepy = sleepiness < 40;
        const isDistracted = distraction > 60;

        if (isSleepy && isDistracted) {
            this.currentState = 'both';
        } else if (isSleepy) {
            this.currentState = 'sleepy';
        } else if (isDistracted) {
            this.currentState = 'distracted';
        } else {
            this.currentState = 'focused';
        }

        return this.currentState;
    }

    /**
     * Check if intervention should be triggered
     * @returns {boolean}
     */
    shouldTriggerIntervention() {
        const now = Date.now();
        const timeSinceLastIntervention = now - this.lastInterventionTime;

        // Immediate intervention if both sleepy and distracted
        if (this.currentState === 'both') return true;

        // Check cooldown for other states
        if (timeSinceLastIntervention < this.interventionCooldown) return false;

        // Trigger if in problematic state
        return this.currentState !== 'focused';
    }

    /**
     * Get intervention type for current state
     * @returns {string}
     */
    getInterventionType() {
        switch (this.currentState) {
            case 'sleepy':
                return 'break'; // Physical activity needed
            case 'distracted':
                return 'quiz'; // Mental refocus needed
            case 'both':
                return 'urgent_break'; // Immediate action required
            default:
                return 'none';
        }
    }

    /**
     * Create intervention message for Gemini based on state
     * @param {Object} context - Page and user context
     * @returns {Object} - Intervention details
     */
    createInterventionPrompt(context) {
        const type = this.getInterventionType();

        const prompts = {
            break: this.createBreakPrompt(context),
            quiz: this.createQuizPrompt(context),
            urgent_break: this.createUrgentBreakPrompt(context)
        };

        return prompts[type] || null;
    }

    createBreakPrompt(context) {
        return {
            type: 'break',
            systemPrompt: `You are FYX, an AI focus assistant. The user is physically drowsy.`,
            userPrompt: `**Drowsiness Detected**
Sleepiness Score: ${this.sleepinessScore}/100 (LOW - user is drowsy)
Distraction Score: ${this.distractionScore}/100

**Context:**
- Time: ${new Date().toLocaleTimeString()}
- Working on: ${context.title || 'Unknown'}
- Session time: ${Math.floor(context.sessionTime / 60000)} minutes

Suggest ONE energizing activity (2-5 minutes) to combat drowsiness.

Return JSON:
{
  "activity": "Activity name (e.g., Quick Walk)",
  "duration": "X minutes",
  "emoji": "Relevant emoji",
  "why": "One sentence: why this helps",
  "steps": ["Step 1", "Step 2", "Step 3"]
}

Keep it brief, actionable, and energizing.`,
            expectedResponse: 'activity_suggestion'
        };
    }

    createQuizPrompt(context) {
        return {
            type: 'quiz',
            systemPrompt: `You are FYX, an AI focus assistant. The user is mentally distracted.`,
            userPrompt: `**Distraction Detected**
Sleepiness Score: ${this.sleepinessScore}/100
Distraction Score: ${this.distractionScore}/100 (HIGH - user is distracted)

**User Behavior:**
- ${context.tabSwitches} tab switches in last minute
- Rapid scrolling patterns detected
- Low content retention

**Current Page:**
URL: ${context.url}
Title: ${context.title}
Content Type: ${context.contentType}

**Content Excerpt:**
"${context.content.substring(0, 800)}"

Generate a comprehension quiz to check if the user absorbed the material.

**Requirements:**
- Ask about MAIN concepts (not trivial details)
- 3 answer options
- Difficulty: Medium
- Make it thought-provoking

Return JSON:
{
  "question": "Your question here",
  "options": ["Option A", "Option B", "Option C"],
  "correctIndex": 0,
  "explanation": "Why this matters (one sentence)"
}`,
            expectedResponse: 'quiz'
        };
    }

    createUrgentBreakPrompt(context) {
        return {
            type: 'urgent_break',
            systemPrompt: `You are FYX, an AI focus assistant. URGENT: User is both drowsy AND distracted.`,
            userPrompt: `**CRITICAL STATE DETECTED**
Sleepiness: ${this.sleepinessScore}/100 (VERY LOW)
Distraction: ${this.distractionScore}/100 (VERY HIGH)

User is both physically fatigued AND mentally unfocused. This is dangerous for productivity and wellbeing.

Session time: ${Math.floor(context.sessionTime / 60000)} minutes
Time: ${new Date().toLocaleTimeString()}

Provide a firm but empathetic message (2 sentences) explaining:
1. Why they MUST take a break now
2. ONE immediate action to reset

Return JSON:
{
  "message": "Your urgent message",
  "action": "Immediate action to take",
  "duration": "Recommended break length"
}

Be firm, caring, and direct.`,
            expectedResponse: 'urgent_message'
        };
    }

    /**
     * Mark intervention as triggered
     */
    markInterventionTriggered() {
        this.lastInterventionTime = Date.now();
    }

    /**
     * Get visual indicator for current state
     * @returns {Object}
     */
    getStateIndicator() {
        const indicators = {
            focused: { emoji: '🎯', color: '#10b981', text: 'Focused' },
            sleepy: { emoji: '😴', color: '#f59e0b', text: 'Drowsy' },
            distracted: { emoji: '📱', color: '#ef4444', text: 'Distracted' },
            both: { emoji: '⚠️', color: '#dc2626', text: 'Critical' }
        };

        return indicators[this.currentState];
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InterventionManager;
}
