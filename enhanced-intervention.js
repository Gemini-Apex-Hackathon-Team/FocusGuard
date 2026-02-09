// FYX Enhanced Content Extraction
// Extracts page content with better accuracy for Gemini quiz generation

async function extractEnhancedPageContent(tabId) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, {
            type: 'GET_ENHANCED_CONTENT'
        });

        if (response) {
            return response;
        }
    } catch (error) {
        console.log('Could not extract enhanced content:', error);
    }

    // Fallback to basic extraction
    return await getBasicContent(tabId);
}

async function getBasicContent(tabId) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, {
            type: 'GET_PAGE_CONTENT'
        });
        return response || { text: '', contentType: 'unknown' };
    } catch (error) {
        return { text: '', contentType: 'unknown' };
    }
}

// Calculate distraction score based on user behavior
function calculateDistractionScore() {
    let score = 0;
    const now = Date.now();

    // Rapid tab switching (40% weight)
    const recentSwitches = distractionMetrics.rapidTabSwitches.length;
    if (recentSwitches > 5) {
        score += Math.min(40, (recentSwitches / 15) * 40);
    }

    // Excessive scrolling (30% weight)
    if (distractionMetrics.excessiveScrolling > 50) {
        score += Math.min(30, (distractionMetrics.excessiveScrolling / 100) * 30);
    }

    // Erratic mouse movement (20% weight)
    if (distractionMetrics.erraticMouseMovement > 20) {
        score += Math.min(20, (distractionMetrics.erraticMouseMovement / 50) * 20);
    }

    // Update global distraction score
    distractionScore = Math.min(100, score);

    return distractionScore;
}

// Intelligent intervention system using InterventionManager
async function triggerIntelligentIntervention() {
    // Calculate distraction score
    calculateDistractionScore();

    // Detect user state
    const effectiveSleepiness = sleepinessScore !== null ? sleepinessScore : attentionScore;
    const state = interventionManager.detectUserState(effectiveSleepiness, distractionScore);

    console.log(`User state: ${state}, Sleepy: ${effectiveSleepiness}, Distracted: ${distractionScore}`);

    // Check if intervention should be triggered
    if (!interventionManager.shouldTriggerIntervention() || focusSession.isPaused) {
        return;
    }

    // Get intervention prompt
    const context = await getEnhancedContext();
    const promptData = interventionManager.createInterventionPrompt(context);

    if (!promptData) return;

    // Call Gemini API with appropriate prompt
    const aiResponse = await callGeminiAPI(promptData.userPrompt);

    // Parse and show intervention
    await showIntelligentIntervention(state, aiResponse, promptData.type);

    // Mark intervention as triggered
    interventionManager.markInterventionTriggered();
}

// Get enhanced context with page content
async function getEnhancedContext() {
    if (!currentTab) return {};

    const pageContent = await extractEnhancedPageContent(currentTab.id);

    return {
        url: currentTab.url,
        title: currentTab.title,
        content: pageContent.text || '',
        contentType: pageContent.contentType || 'webpage',
        sessionTime: Date.now() - sessionStartTime,
        tabSwitches: distractionMetrics.rapidTabSwitches.length,
        scrollEvents: distractionMetrics.excessiveScrolling
    };
}

// Show intelligent intervention based on state
async function showIntelligentIntervention(state, aiResponse, type) {
    if (!currentTab) return;

    let interventionData = {};

    try {
        // Try to parse JSON response from Gemini
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            interventionData = JSON.parse(jsonMatch[0]);
        }
    } catch (error) {
        console.error('Failed to parse Gemini response:', error);
        // Fallback to generic intervention
        interventionData = {
            message: aiResponse,
            type: state
        };
    }

    // Send to content script with state-specific data
    chrome.tabs.sendMessage(currentTab.id, {
        type: type === 'quiz' ? 'SHOW_CONTEXTUAL_QUIZ' : 'SHOW_INTELLIGENT_INTERVENTION',
        state: state,
        data: interventionData,
        sleepinessScore: sleepinessScore,
        distractionScore: distractionScore,
        attentionScore: attentionScore
    });
}

// Export for access in background.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateDistractionScore,
        triggerIntelligentIntervention,
        extractEnhancedPageContent,
        getEnhancedContext
    };
}
