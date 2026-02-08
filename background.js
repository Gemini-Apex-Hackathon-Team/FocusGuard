// FocusGuard Background Service Worker
// Manages learning sessions and attention monitoring across tabs

let currentLearningSession = null;
let currentArticleContext = null;

// Initialize on install
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        chrome.storage.sync.set({
            focusguard_settings: {
                analysisInterval: 3,
                enableGemini: true,
                enableSwitchSuggestions: true,
                enableAutoDetection: true
            }
        });
        console.log('🎯 FocusGuard initialized on install');
    }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Background received message:', request.action);
    
    if (request.action === 'articleDetected') {
        handleArticleDetected(request.data, sender, sendResponse);
    } 
    else if (request.action === 'articleScrolled') {
        handleArticleScrolled(request.data, sender, sendResponse);
    }
    else if (request.action === 'getArticleContext') {
        sendResponse({ success: true, data: currentArticleContext });
    }
    else if (request.action === 'startAutoMonitoring') {
        handleStartAutoMonitoring(sender, sendResponse);
    }
    else if (request.action === 'stopAutoMonitoring') {
        handleStopAutoMonitoring(sender, sendResponse);
    }
    else if (request.action === 'getLearningSession') {
        sendResponse({ success: true, session: currentLearningSession });
    }
});

function handleArticleDetected(articleContext, sender, sendResponse) {
    console.log('📖 Article detected on tab ' + sender.tab.id + ':', articleContext.title);
    
    // Store article context
    currentArticleContext = {
        ...articleContext,
        tabId: sender.tab.id,
        detectedAt: Date.now()
    };
    
    // Create learning session
    currentLearningSession = {
        sessionId: Date.now(),
        tabId: sender.tab.id,
        title: articleContext.title,
        url: articleContext.url,
        contentType: 'article',
        startTime: Date.now(),
        articleContext: currentArticleContext,
        focusScores: [],
        attentionDrops: 0,
        scrollHistory: [
            {
                scrollPercent: articleContext.scrollPercent,
                timestamp: Date.now(),
                visibleText: articleContext.visibleText
            }
        ],
        isActive: false,
        needsMonitoring: true
    };
    
    console.log('✅ Learning session created:', {
        title: currentLearningSession.title,
        tabId: currentLearningSession.tabId
    });
    
    // Save to storage
    chrome.storage.local.set({ currentLearningSession });
    
    // Notify popup to show article detected banner
    chrome.runtime.sendMessage({
        action: 'articleDetectedInTab',
        data: {
            title: articleContext.title,
            url: articleContext.url
        }
    }).catch(() => {
        // Popup might not be open, that's ok
    });
    
    sendResponse({ success: true, message: 'Article detected and session created' });
}

function handleArticleScrolled(articleContext, sender, sendResponse) {
    // Update article context with new scroll position
    if (currentArticleContext && currentArticleContext.tabId === sender.tab.id) {
        currentArticleContext = {
            ...currentArticleContext,
            ...articleContext
        };
        
        // Update learning session scroll history
        if (currentLearningSession) {
            currentLearningSession.scrollHistory.push({
                scrollPercent: articleContext.scrollPercent,
                timestamp: Date.now(),
                visibleText: articleContext.visibleText
            });
            
            // Keep only last 20 scroll positions to save memory
            if (currentLearningSession.scrollHistory.length > 20) {
                currentLearningSession.scrollHistory.shift();
            }
            
            chrome.storage.local.set({ currentLearningSession });
        }
        
        console.log(`📍 Article scroll updated: ${articleContext.scrollPercent}%`);
    }
    
    sendResponse({ success: true });
}

function handleStartAutoMonitoring(sender, sendResponse) {
    console.log('👁️ Starting auto-monitoring for article');
    
    if (currentLearningSession) {
        currentLearningSession.isActive = true;
        currentLearningSession.monitoringStartTime = Date.now();
        
        chrome.storage.local.set({ currentLearningSession });
        
        sendResponse({ 
            success: true, 
            session: currentLearningSession,
            message: 'Auto-monitoring started'
        });
    } else {
        sendResponse({ 
            success: false, 
            message: 'No article detected yet'
        });
    }
}

function handleStopAutoMonitoring(sender, sendResponse) {
    console.log('⏹️ Stopping auto-monitoring');
    
    if (currentLearningSession) {
        currentLearningSession.isActive = false;
        currentLearningSession.monitoringEndTime = Date.now();
        
        // Archive session
        chrome.storage.local.get('sessionHistory', (result) => {
            const history = result.sessionHistory || [];
            history.push(currentLearningSession);
            
            // Keep only last 30 sessions
            if (history.length > 30) {
                history.shift();
            }
            
            chrome.storage.local.set({ sessionHistory: history });
        });
        
        currentLearningSession = null;
        currentArticleContext = null;
        
        sendResponse({ 
            success: true, 
            message: 'Auto-monitoring stopped and session archived'
        });
    } else {
        sendResponse({ 
            success: false, 
            message: 'No active session'
        });
    }
}

// Expose current context to popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCurrentContext') {
        sendResponse({
            session: currentLearningSession,
            articleContext: currentArticleContext
        });
    }
});

console.log('✅ Background service worker ready for article monitoring');
