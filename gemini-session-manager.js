// FYX Gemini Session Manager
// Continuously uses Gemini AI to read tabs and provide intelligent suggestions

class GeminiSessionManager {
    constructor(geminiAPIKey, geminiAPIURL) {
        this.apiKey = geminiAPIKey;
        this.apiUrl = geminiAPIURL;
        this.sessionActive = false;
        this.sessionStartTime = null;
        this.sessionGoal = '';
        this.currentTab = null;
        this.tabHistory = [];
        this.contentAnalysis = [];
        this.lastAnalysisTime = 0;
        this.analysisInterval = 2 * 60 * 1000; // Analyze every 2 minutes
        this.suggestionTimer = null;
    }

    /**
     * Start a focus session with Gemini analyzing activity
     */
    async startSession(goal = '') {
        this.sessionActive = true;
        this.sessionStartTime = Date.now();
        this.sessionGoal = goal;
        this.tabHistory = [];
        this.contentAnalysis = [];

        console.log('[Gemini Session] Started with goal:', goal);

        // Get initial analysis from Gemini
        await this.analyzeSessionStart();

        // Set up periodic content analysis
        this.suggestionTimer = setInterval(async () => {
            if (this.sessionActive) {
                await this.analyzeCurrentActivity();
            }
        }, this.analysisInterval);

        return {
            message: 'Session started! Gemini is now monitoring your activity.',
            suggestions: await this.getInitialSuggestions()
        };
    }

    /**
     * Stop the session
     */
    async stopSession() {
        if (!this.sessionActive) return;

        this.sessionActive = false;
        const duration = Date.now() - this.sessionStartTime;

        if (this.suggestionTimer) {
            clearInterval(this.suggestionTimer);
        }

        // Get final summary from Gemini
        const summary = await this.getSessionSummary(duration);

        console.log('[Gemini Session] Stopped. Duration:', duration / 60000, 'min');

        return summary;
    }

    /**
     * Track tab change during session
     */
    async trackTabChange(tab, content) {
        if (!this.sessionActive) return;

        this.currentTab = tab;
        this.tabHistory.push({
            url: tab.url,
            title: tab.title,
            timestamp: Date.now(),
            duration: null // Will be calculated on next tab change
        });

        // Update previous tab duration
        if (this.tabHistory.length > 1) {
            const prevTab = this.tabHistory[this.tabHistory.length - 2];
            prevTab.duration = Date.now() - prevTab.timestamp;
        }

        // Ask Gemini if this tab is relevant to session goal
        if (this.sessionGoal) {
            await this.checkTabRelevance(tab, content);
        }
    }

    /**
     * Analyze session start with Gemini
     */
    async analyzeSessionStart() {
        const prompt = `You are FYX, an AI focus assistant. A user just started a focus session.

**Session Goal:** ${this.sessionGoal || 'Not specified'}
**Time:** ${new Date().toLocaleTimeString()}

Provide 3 brief tips (one sentence each) to help them stay focused during this session.

Return JSON:
{
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}`;

        try {
            const response = await this.callGemini(prompt);
            const data = this.parseJSON(response);
            return data.tips || [];
        } catch (error) {
            console.error('[Gemini Session] Error analyzing session start:', error);
            return ['Stay focused on one task at a time'];
        }
    }

    /**
     * Analyze current activity and provide suggestions
     */
    async analyzeCurrentActivity() {
        if (!this.currentTab || this.tabHistory.length === 0) return;

        const now = Date.now();
        if (now - this.lastAnalysisTime < this.analysisInterval) return;

        this.lastAnalysisTime = now;

        // Get current tab content
        const content = await this.getTabContent(this.currentTab.id);

        // Analyze with Gemini
        const recentTabs = this.tabHistory.slice(-5); // Last 5 tabs
        const sessionDuration = Math.floor((now - this.sessionStartTime) / 60000);

        const prompt = `You are FYX, analyzing a user's focus session.

**Session Goal:** ${this.sessionGoal || 'General focus'}
**Duration:** ${sessionDuration} minutes
**Current Page:** ${this.currentTab.title}
**URL:** ${this.currentTab.url}

**Recent Activity (last 5 tabs):**
${recentTabs.map((tab, i) => `${i + 1}. ${tab.title} (${Math.floor((tab.duration || 0) / 1000)}s)`).join('\n')}

**Current Page Content (excerpt):**
"${(content.text || '').substring(0, 800)}"

**Analysis Request:**
1. Is the user staying on track with their goal?
2. Are they showing signs of distraction (rapid tab switching)?
3. Should you intervene with a suggestion?

Return JSON:
{
  "onTrack": true/false,
  "analysis": "Brief analysis (2 sentences)",
  "shouldIntervene": true/false,
  "suggestion": "Suggestion if intervention needed (or null)"
}`;

        try {
            const response = await this.callGemini(prompt);
            const analysis = this.parseJSON(response);

            this.contentAnalysis.push({
                timestamp: now,
                ...analysis
            });

            // Trigger intervention if Gemini suggests it
            if (analysis.shouldIntervene && analysis.suggestion) {
                await this.showGeminiSuggestion(analysis);
            }

            return analysis;
        } catch (error) {
            console.error('[Gemini Session] Error analyzing activity:', error);
            return null;
        }
    }

    /**
     * Check if tab is relevant to session goal
     */
    async checkTabRelevance(tab, content) {
        const prompt = `You are FYX, helping a user stay on track.

**Session Goal:** ${this.sessionGoal}
**Current Tab:** ${tab.title}
**URL:** ${tab.url}
**Content:** "${(content.text || '').substring(0, 500)}"

Is this tab relevant to their goal?

Return JSON:
{
  "relevant": true/false,
  "reason": "One sentence why",
  "shouldWarn": true/false
}`;

        try {
            const response = await this.callGemini(prompt);
            const result = this.parseJSON(response);

            if (!result.relevant && result.shouldWarn) {
                await this.showRelevanceWarning(result.reason);
            }

            return result;
        } catch (error) {
            console.error('[Gemini Session] Error checking relevance:', error);
            return null;
        }
    }

    /**
     * Get session summary from Gemini
     */
    async getSessionSummary(duration) {
        const durationMin = Math.floor(duration / 60000);
        const uniqueTabs = [...new Set(this.tabHistory.map(t => t.title))];

        const prompt = `You are FYX, summarizing a focus session.

**Session Goal:** ${this.sessionGoal || 'General focus'}
**Duration:** ${durationMin} minutes
**Tabs Visited:** ${this.tabHistory.length}
**Unique Pages:** ${uniqueTabs.length}

**Tab History:**
${this.tabHistory.slice(0, 10).map((tab, i) =>
            `${i + 1}. ${tab.title} (${Math.floor((tab.duration || 0) / 1000)}s)`
        ).join('\n')}

Provide a brief session summary:
1. How focused were they?
2. Did they achieve their goal?
3. What went well?
4. What to improve next time?

Return JSON:
{
  "focusRating": 1-10,
  "goalAchieved": true/false,
  "summary": "2-3 sentence summary",
  "strengths": "What went well",
  "improvements": "What to improve"
}`;

        try {
            const response = await this.callGemini(prompt);
            return this.parseJSON(response);
        } catch (error) {
            console.error('[Gemini Session] Error getting summary:', error);
            return {
                focusRating: 5,
                summary: `You worked for ${durationMin} minutes across ${uniqueTabs.length} pages.`,
                strengths: 'You started a focus session!',
                improvements: 'Try setting a specific goal next time.'
            };
        }
    }

    /**
     * Get initial suggestions when starting session
     */
    async getInitialSuggestions() {
        const prompt = `You are FYX. A user started a focus session${this.sessionGoal ? ` with goal: "${this.sessionGoal}"` : ''}.

Provide 3 actionable suggestions to start strong:

Return JSON:
{
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}`;

        try {
            const response = await this.callGemini(prompt);
            const data = this.parseJSON(response);
            return data.suggestions || [];
        } catch (error) {
            return ['Close unnecessary tabs', 'Set a timer', 'Minimize distractions'];
        }
    }

    /**
     * Show Gemini-generated suggestion
     */
    async showGeminiSuggestion(analysis) {
        // Send to content script
        if (this.currentTab) {
            chrome.tabs.sendMessage(this.currentTab.id, {
                type: 'SHOW_GEMINI_SUGGESTION',
                analysis: analysis.analysis,
                suggestion: analysis.suggestion,
                onTrack: analysis.onTrack
            });
        }
    }

    /**
     * Show relevance warning
     */
    async showRelevanceWarning(reason) {
        if (this.currentTab) {
            chrome.tabs.sendMessage(this.currentTab.id, {
                type: 'SHOW_RELEVANCE_WARNING',
                reason: reason,
                goal: this.sessionGoal
            });
        }
    }

    /**
     * Get tab content helper
     */
    async getTabContent(tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                type: 'GET_ENHANCED_CONTENT'
            });
            return response || { text: '', contentType: 'unknown' };
        } catch (error) {
            return { text: '', contentType: 'unknown' };
        }
    }

    /**
     * Call Gemini API
     */
    async callGemini(prompt) {
        try {
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
                console.error('[Gemini API] HTTP Error:', response.status, errorText);
                throw new Error(`Gemini API HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('[Gemini API] Response:', data);

            if (data.candidates && data.candidates[0]) {
                return data.candidates[0].content.parts[0].text;
            }

            if (data.error) {
                console.error('[Gemini API] API Error:', data.error);
                throw new Error(`Gemini API Error: ${data.error.message || JSON.stringify(data.error)}`);
            }

            throw new Error('No response from Gemini');
        } catch (error) {
            console.error('[Gemini API] Call failed:', error);
            throw error;
        }
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
            console.error('[Gemini Session] JSON parse error:', error);
        }
        return {};
    }

    /**
     * Get session state
     */
    getState() {
        return {
            active: this.sessionActive,
            goal: this.sessionGoal,
            startTime: this.sessionStartTime,
            duration: this.sessionActive ? Date.now() - this.sessionStartTime : 0,
            tabsVisited: this.tabHistory.length,
            currentTab: this.currentTab ? this.currentTab.title : null
        };
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeminiSessionManager;
}
