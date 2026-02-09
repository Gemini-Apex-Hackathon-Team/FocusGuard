// FYX Intervention Decision System
// Uses Gemini to decide when and how to intervene

class InterventionDecision {
    constructor(geminiAPIKey, geminiAPIURL) {
        this.apiKey = geminiAPIKey;
        this.apiUrl = geminiAPIURL;
        this.userProfile = { attentionLevel: 5 };
    }

    /**
     * Main decision method - asks Gemini if we should intervene
     */
    async shouldIntervene(attentionScore, contentContext, signals) {
        const prompt = `You are FYX's decision engine. Analyze if intervention is needed.

**Attention Score:** ${attentionScore}/100 (camera-based + browser signals)

**Current Learning:**
- Type: ${contentContext?.type || 'unknown'}
- Title: ${contentContext?.title || 'N/A'}
- Progress: ${contentContext?.position?.progress || 0}%
- Text excerpt: "${(contentContext?.text || '').substring(0, 300)}"

**Recent Signals:**
- Sleepiness (camera): ${signals?.sleepinessScore}/100
- Tab switches (last min): ${signals?.tabSwitches || 0}
- Scroll activity: ${signals?.scrollCount || 0}
- Time on page: ${Math.round((signals?.timeOnPage || 0) / 1000)} seconds

**User Profile:**
- Self-reported attention span: ${this.userProfile.attentionLevel}/10

RULES:
- Only intervene if attention score < 40 OR signals show clear disengagement
- Match intervention type to the cause:
  * quiz: if they're reading but not retaining (low engagement with content)
  * reflection: if context-switching frequently
  * pause: if camera shows fatigue/sleepiness
  * recap: if they've been on same page long without progress

DECIDE:
1. Should I intervene NOW? (yes/no)
2. Why? (brief explanation)
3. Root cause? (fatigue/disengagement/overload/context-switching)
4. What intervention type? (quiz/reflection/pause/recap)

Return ONLY JSON:
{
  "intervene": true,
  "reason": "Your attention has dropped and you're scrolling rapidly without engaging with the content.",
  "cause": "disengagement",
  "type": "quiz"
}`;

        try {
            const response = await this.callGemini(prompt);
            const decision = this.parseJSON(response);

            console.log('[FYX Decision]', decision);

            return decision;
        } catch (error) {
            console.error('[FYX] Error making intervention decision:', error);
            // Conservative fallback - don't intervene on error
            return { intervene: false };
        }
    }

    /**
     * Generate break content based on intervention type
     */
    async generateBreakContent(type, contentContext, reason) {
        let prompt = '';

        switch (type) {
            case 'quiz':
                prompt = `Generate a micro-quiz about this content:

**Title:** ${contentContext.title}
**Content excerpt:** "${(contentContext.text || '').substring(0, 800)}"

Create ONE simple comprehension question with 3 options.

Return JSON:
{
  "question": "What is the main concept being explained?",
  "options": ["Option A", "Option B", "Option C"],
  "correctIndex": 0,
  "explanation": "Brief why this matters"
}`;
                break;

            case 'reflection':
                prompt = `Generate a reflection prompt for someone learning about:

**Topic:** ${contentContext.title}
**Progress:** ${contentContext.position?.progress}%

Create a thoughtful prompt that helps them consolidate learning.

Return JSON:
{
  "prompt": "Take a moment to write: What's the key idea you've learned so far?"
}`;
                break;

            case 'recap':
                prompt = `Create a brief recap of what the user has been learning:

**Title:** ${contentContext.title}
**Content:** "${(contentContext.text || '').substring(0, 800)}"

Summarize key points to refresh their memory.

Return JSON:
{
  "summary": "You've been learning about...",
  "keyPoints": ["Point 1", "Point 2", "Point 3"]
}`;
                break;

            case 'pause':
            default:
                // Pause doesn't need generated content
                return {
                    duration: 60,
                    message: "Take a moment to rest your eyes and breathe."
                };
        }

        try {
            const response = await this.callGemini(prompt);
            return this.parseJSON(response);
        } catch (error) {
            console.error('[FYX] Error generating break content:', error);
            return null;
        }
    }

    /**
     * Set user profile
     */
    setUserProfile(profile) {
        this.userProfile = { ...this.userProfile, ...profile };
    }

    /**
     * Call Gemini API
     */
    async callGemini(prompt) {
        const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[FYX] Gemini API HTTP Error:', response.status, errorText);
            throw new Error(`Gemini API HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.candidates && data.candidates[0]) {
            return data.candidates[0].content.parts[0].text;
        }

        if (data.error) {
            console.error('[FYX] Gemini API Error:', data.error);
            throw new Error(`Gemini API Error: ${data.error.message}`);
        }

        throw new Error('No response from Gemini');
    }

    /**
     * Parse JSON from Gemini response
     */
    parseJSON(text) {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('[FYX] JSON parse error:', error);
        }
        return {};
    }
}

// Make available in background context
if (typeof window === 'undefined') {
    // Service worker context
    self.InterventionDecision = InterventionDecision;
}
