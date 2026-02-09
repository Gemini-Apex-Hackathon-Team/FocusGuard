/**
 * Intervention Integration Module
 * 
 * Glue code that connects:
 * - Background script (attention + distraction tracking)
 * - Content analyzer (page context)
 * - Gemini intervention engine (AI decision making)
 * - Content script (UI rendering)
 */

class InterventionIntegration {
    constructor(geminiClient) {
        this.geminiClient = geminiClient;
        this.interventionEngine = new GeminiInterventionEngine(geminiClient);
        
        // Current tab tracking
        this.currentTabId = null;
        this.tabContentCache = new Map(); // Cache content to avoid repeated extraction
        
        // Intervention queue
        this.pendingInterventions = [];
    }
    
    /**
     * Process user state and decide on intervention
     * Called periodically from background script
     * 
     * INPUT (from background detection loop):
     * {
     *   attentionScore: 0-100,
     *   distractionScore: 0-100,
     *   sleepinessScore: 0-100 | null,
     *   sessionTimeSeconds: number,
     *   currentTabId: number,
     *   contentAnalysis: { text, contentType, title, url, ... }
     * }
     */
    async processUserState(context) {
        try {
            // Store current tab
            this.currentTabId = context.currentTabId;
            
            // Build intervention context
            const interventionContext = {
                attentionScore: context.attentionScore,
                distractionScore: context.distractionScore,
                sleepinessScore: context.sleepinessScore,
                contentAnalysis: context.contentAnalysis,
                sessionTime: context.sessionTimeSeconds
            };
            
            // Get intervention decision from engine
            const decision = await this.interventionEngine.decide(interventionContext);
            
            if (decision.shouldIntervene && decision.intervention) {
                console.log('🎯 Intervention approved, sending to content script...');
                
                // Queue intervention
                this.pendingInterventions.push(decision.intervention);
                
                // Send to content script for rendering
                await this.sendInterventionToContentScript(
                    context.currentTabId,
                    decision.intervention
                );
            }
            
            return decision;
            
        } catch (error) {
            console.error('❌ Intervention processing error:', error);
            return { shouldIntervene: false, action: 'none', error: error.message };
        }
    }
    
    /**
     * Extract content from current tab
     * Called before intervention decision
     */
    async extractPageContent(tabId) {
        try {
            // Check cache first
            if (this.tabContentCache.has(tabId)) {
                const cached = this.tabContentCache.get(tabId);
                if (Date.now() - cached.timestamp < 30000) { // Cache valid for 30 seconds
                    return cached.data;
                }
            }
            
            // Request enhanced content from content script
            const response = await chrome.tabs.sendMessage(tabId, {
                type: 'GET_ENHANCED_CONTENT'
            });
            
            if (response) {
                // Cache the result
                this.tabContentCache.set(tabId, {
                    data: response,
                    timestamp: Date.now()
                });
                return response;
            }
            
        } catch (error) {
            console.log('⚠️ Could not extract enhanced content:', error);
        }
        
        // Fallback: try basic content
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                type: 'GET_PAGE_CONTENT'
            });
            return response || { text: '', contentType: 'unknown' };
        } catch (fallbackError) {
            console.log('⚠️ Could not extract any content');
            return { text: '', contentType: 'unknown' };
        }
    }
    
    /**
     * Send intervention to content script for rendering
     */
    async sendInterventionToContentScript(tabId, intervention) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                type: 'SHOW_INTERVENTION',
                intervention: intervention
            });
            
            if (response) {
                console.log('✅ Intervention sent to content script');
                return response;
            }
        } catch (error) {
            console.warn('⚠️ Could not send intervention to tab:', error);
            // Tab may be unresponsive or content script not ready
        }
    }
    
    /**
     * Handle intervention response from content script
     * (user clicked action button)
     */
    handleInterventionResponse(response) {
        const { action, interventionType } = response;
        
        console.log(`📤 Intervention response: ${action} (type: ${interventionType})`);
        
        // Track intervention effectiveness
        this.trackInterventionOutcome(interventionType, action);
    }
    
    /**
     * Track intervention outcomes for learning
     */
    trackInterventionOutcome(interventionType, userAction) {
        const outcome = {
            type: interventionType,
            action: userAction, // 'accepted', 'dismissed', 'quiz_correct', 'quiz_incorrect'
            timestamp: Date.now()
        };
        
        // Could be sent to analytics backend
        console.log('📊 Intervention outcome:', outcome);
    }
    
    /**
     * Get intervention diagnostics
     */
    getDiagnostics() {
        return {
            engineDiagnostics: this.interventionEngine.getDiagnostics(),
            pendingInterventions: this.pendingInterventions.length,
            cachedTabs: this.tabContentCache.size
        };
    }
    
    /**
     * Clear cache for a tab
     */
    clearTabCache(tabId) {
        this.tabContentCache.delete(tabId);
    }
    
    /**
     * Reset session
     */
    resetSession() {
        this.interventionEngine.resetSession();
        this.pendingInterventions = [];
        this.tabContentCache.clear();
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InterventionIntegration;
}
