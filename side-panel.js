/**
 * FYX Side Panel Navigation & Management
 * Handles view switching, focus mode, timer, and settings management
 */

import { initializeLandmarkers, switchToVideoMode } from './lib/mediapipe-loader.js';
import { analyzeFaceAttention, analyzeAttention } from './lib/attention-analyzer.js';
import { setApiKey as setGeminiApiKey, getApiKey as getGeminiApiKey, isApiKeySet, analyzeLandmarks, isQuotaExceeded, getRemainingCooldown, extractAttentionConfidence } from './lib/gemini-client.js';
import { getApiKey, getSettings } from './lib/storage-manager.js';
import { generateQuizFromContent, validateQuizAnswer } from './lib/quiz-generator.js';
import { getRecommendations } from './lib/recommendations.js';
import { fetchUrlContent, isLearningContent } from './lib/learning-session.js';
import { hasCompletedOnboarding, showOnboardingModal, getUserAttentionProfile, getAttentionThresholds } from './lib/onboarding.js';


// Navigation DOM Elements
const nav = {
    backBtn: null,
    settingsBtn: null,
    mainPageView: null,
    settingsPageView: null
};

// Main Page Elements
const main = {
    statusIndicator: null,
    statusDot: null,
    statusText: null,
    currentSession: null,
    sessionTitle: null,
    sessionInfo: null,
    cameraFeed: null,
    cameraCanvas: null,
    cameraOverlay: null,
    toggleCameraBtn: null,
    cameraStatusText: null,
    cameraStatus: null,
    faceDetectionBox: null,
    attentionValue: null,
    attentionProgress: null,
    attentionMessage: null,
    
    // Focus Mode
    enableFocusBtn: null,
    disableFocusBtn: null,
    pomodoroSection: null,
    
    // Timer
    timerDisplay: null,
    startTimerBtn: null,
    pauseTimerBtn: null,
    resetTimerBtn: null,
    timerDuration: null,
    
    // Focus Mode Timer
    timerDisplayFocusMode: null,
    startTimerBtnFocusMode: null,
    pauseTimerBtnFocusMode: null,
    resetTimerBtnFocusMode: null,
    timerDurationFocusMode: null,
    
    // Stats
    durationStat: null,
    focusStat: null,
    avgScoreStat: null,
    peakFocusStat: null,
    lowFocusStat: null,
    quizStat: null,
    statsSection: null,
    controlsSection: null,
    pauseBtn: null,
    endSessionBtn: null,
    notificationsContainer: null
};

// Settings Page Elements
const settings = {
    // API Settings
    geminiApiKey: null,
    toggleApiKey: null,
    saveApiKey: null,
    testApiKey: null,
    apiKeyStatus: null,
    
    // Feature Toggles
    autoDetection: null,
    enableGemini: null,
    enableSwitchSuggestions: null,
    enableBlocking: null,
    
    // Analysis Settings
    analysisInterval: null,
    attentionThreshold: null,
    
    // Quiz Settings
    quizDifficulty: null,
    questionsPerQuiz: null,
    
    // Notification Settings
    enableNotifications: null,
    breakInterval: null,
    
    // Data Settings
    enableHistory: null,
    clearDataBtn: null,
    
    // Suggestions
    suggestionList: null,
    newSuggestionTitle: null,
    newSuggestionUrl: null,
    newSuggestionDesc: null,
    addSuggestion: null,
    
    // Buttons
    saveBtn: null,
    resetBtn: null
};

// State for suggestions
let currentSuggestions = [];

// Camera and detection state
let cameraStream = null;
let isCameraEnabled = false;
let faceLandmarker = null;
let poseLandmarker = null;
let detectionRunning = false;
let attentionScores = [];
let currentAttentionScore = 0;
let lastDetectionTime = 0;
let detectionInterval = 3000; // Default: analyze every 3 seconds

// Gemini analysis state
let lastGeminiAnalysisTime = 0;
let geminiAnalysisInterval = 30000; // Default: send to Gemini every 30 seconds
let lastGeminiConfidence = 0.5; // Track Gemini's confidence for hybrid scoring
let geminiAnalysisHistory = []; // Track recent Gemini scores

// Learning session state
let currentLearningSession = null;
let currentQuiz = null;
let currentQuizIndex = 0;
let learningContent = null;
let readingDistractionLevel = 'High'; // Track distraction during reading

// Focus mode state
let focusModeEnabled = false;
let focusSessionStartTime = null;
let focusSessionStats = {
    duration: 0,
    averageScore: 0,
    peakScore: 0,
    lowFocusCount: 0,
    quizzesCompleted: 0,
    totalAttentionScores: [],
    distractionResponses: [],
    focusContent: null
};

// Timer state
let timerRunning = false;
let timerInterval = null;
let timerTimeLeft = 25 * 60; // 25 minutes in seconds
let timerDurationMinutes = 25;
let focusSessionInterval = null;

// Break timer state
let breakTimerActive = false;
let breakTimeLeft = 300; // 5 minutes default
let breakDurationSeconds = 300;
let breakTimerInterval = null;
let breakAction = null;

// Focus mode Gemini update state
let lastFocusGeminiUpdate = 0;
let focusGeminiUpdateInterval = 5 * 60 * 1000; // Default: 5 minutes in milliseconds

// Distraction popup throttling
let lastDistractionPopupTime = 0;

// Onboarding and user profile state
let userProfile = null;
let onboardingCompleted = false;

// State
let currentSession = null;
let isMonitoring = false;
let sessionStartTime = null;

/**
 * Initialize the side panel after DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎯 FYX Side Panel - DOMContentLoaded');
    
    // Check if onboarding is completed
    const completed = await hasCompletedOnboarding();
    onboardingCompleted = completed;
    
    if (!onboardingCompleted) {
        console.log('📋 Onboarding not completed - showing in-panel onboarding');
        // Initialize in-panel onboarding
        initializeOnboarding();
    } else {
        console.log('✅ Onboarding already completed - loading user profile');
        // Hide onboarding view and show main view
        hideOnboardingView();
        // Load existing user profile
        userProfile = await getUserAttentionProfile();
        continueInitialization();
    }
});

/**
 * Initialize in-panel onboarding flow
 */
function initializeOnboarding() {
    const onboardingView = document.getElementById('onboardingView');
    const mainPageView = document.getElementById('mainPageView');
    const settingsPageView = document.getElementById('settingsPageView');
    
    // Show onboarding, hide others
    if (onboardingView) onboardingView.classList.add('active');
    if (mainPageView) mainPageView.classList.remove('active');
    if (settingsPageView) settingsPageView.classList.remove('active');
    
    // Setup onboarding event listeners
    setupOnboardingListeners();
    console.log('✅ In-panel onboarding initialized');
}

/**
 * Hide onboarding view and show main view
 */
function hideOnboardingView() {
    const onboardingView = document.getElementById('onboardingView');
    const mainPageView = document.getElementById('mainPageView');
    
    if (onboardingView) onboardingView.classList.remove('active');
    if (mainPageView) mainPageView.classList.add('active');
}

/**
 * Setup onboarding event listeners
 */
function setupOnboardingListeners() {
    let currentStep = 1;
    const totalSteps = 3;
    let selectedAttentionLevel = 5;
    let apiKey = '';
    
    // Setup attention scale
    const scaleOptions = document.querySelectorAll('.scale-option');
    scaleOptions.forEach(option => {
        option.addEventListener('click', () => {
            scaleOptions.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedAttentionLevel = parseInt(option.dataset.value);
            const selectedValueEl = document.getElementById('selected-value');
            if (selectedValueEl) selectedValueEl.textContent = selectedAttentionLevel;
            console.log('📊 Attention level selected:', selectedAttentionLevel);
        });
    });
    
    // Setup navigation buttons
    const nextBtn = document.getElementById('onboarding-btn-next');
    const backBtn = document.getElementById('onboarding-btn-back');
    
    if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
            console.log(`🔵 Next button clicked - Current step: ${currentStep}, Total steps: ${totalSteps}`);
            
            // Move to next step
            console.log(`📍 Current: ${currentStep}, Total: ${totalSteps}, Check: ${currentStep < totalSteps}`);
            if (currentStep < totalSteps) {
                currentStep++;
                console.log(`➡️ Advancing to step ${currentStep}`);
                updateOnboardingUI(currentStep, totalSteps, nextBtn, backBtn);
            } else {
                // Complete onboarding
                console.log(`🏁 On final step - calling completeOnboardingInPanel`);
                await completeOnboardingInPanel(selectedAttentionLevel, apiKey);
            }
        });
    }
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateOnboardingUI(currentStep, totalSteps, nextBtn, backBtn);
            }
        });
    }
    
    // Initialize UI to show step 1
    updateOnboardingUI(currentStep, totalSteps, nextBtn, backBtn);
}

/**
 * Show API status message during onboarding
 */

/**
 * Update onboarding UI based on current step
 */
function updateOnboardingUI(currentStep, totalSteps, nextBtn, backBtn) {
    // Hide all steps
    document.querySelectorAll('.onboarding-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show current step
    const stepEl = document.getElementById(`onboarding-step-${currentStep}`);
    if (stepEl) stepEl.classList.add('active');
    
    // Update back button visibility
    if (backBtn) backBtn.style.display = currentStep > 1 ? 'block' : 'none';
    
    // Update next button text
    if (nextBtn) {
        if (currentStep === 1) {
            nextBtn.textContent = 'Get Started';
            nextBtn.disabled = false;
        } else if (currentStep === totalSteps) {
            nextBtn.textContent = 'Start Using FYX';
            nextBtn.disabled = false;
        } else if (currentStep === 3) {
            nextBtn.textContent = 'Next';
            const apiInput = document.getElementById('onboarding-api-key-input');
            nextBtn.disabled = !apiInput || !apiInput.value.trim();
        } else {
            nextBtn.textContent = 'Next';
            nextBtn.disabled = false;
        }
    }
    
    // Update progress dots
    document.querySelectorAll('.progress-dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === currentStep - 1);
    });
    
    console.log('📄 Onboarding step updated to:', currentStep);
}

/**
 * Complete onboarding in side panel
 */
async function completeOnboardingInPanel(attentionLevel, apiKey) {
    console.log('🎉 Completing onboarding in side panel...');
    console.log('   - Attention Level:', attentionLevel);
    console.log('   - API Key length:', apiKey ? apiKey.length : 0);
    
    const quizFrequency = attentionLevel <= 3 ? 10 : attentionLevel <= 6 ? 15 : 20;
    
    const config = {
        attentionLevel: attentionLevel,
        blockedSites: [],
        allowedSites: [],
        quizFrequency: quizFrequency,
        enableFaceTracking: true,
        enableContentQuiz: true,
        enableInterventions: true,
        enableBreaks: true
    };
    
    // Save configuration
    await chrome.storage.local.set({
        userConfig: config,
        gemini_api_key: apiKey,
        onboarded: true,
        onboardingDate: new Date().toISOString()
    });
    
    console.log('💾 Saved to chrome.storage.local');
    
    await chrome.storage.sync.set({
        focusguard_settings: {
            geminiApiKey: apiKey
        }
    });
    
    console.log('💾 Saved to chrome.storage.sync');
    console.log('✅ Onboarding configuration saved');
    
    // Hide onboarding and show main interface
    console.log('🔄 Hiding onboarding view...');
    hideOnboardingView();
    console.log('👤 Loading user profile...');
    userProfile = await getUserAttentionProfile();
    console.log('🚀 Continuing initialization...');
    continueInitialization();
    
    console.log('🎊 Showing welcome notification...');
    showNotification('Welcome to FYX!', 'Your focus journey starts now', 'success');
}

/**
 * Continue initialization after onboarding
 */
async function continueInitialization() {
    console.log('⏳ Starting continueInitialization...');
    // Initialize navigation elements
    console.log('📍 Initializing navigation...');
    initializeNavigation();
    
    // Initialize main page elements
    console.log('📍 Initializing main page...');
    initializeMainPage();
    
    // Initialize settings
    console.log('📍 Initializing settings...');
    initializeSettings();
    
    // Setup event listeners
    console.log('📍 Setting up event listeners...');
    setupEventListeners();
    
    // Load initial state
    console.log('📍 Loading initial state...');
    loadInitialState();
    
    console.log('✅ FYX Side Panel initialization complete');
}

/**
 * Initialize navigation elements and verify they exist
 */
function initializeNavigation() {
    console.log('🔍 Initializing navigation elements');
    
    nav.backBtn = document.getElementById('navBackBtn');
    nav.settingsBtn = document.getElementById('navSettingsBtn');
    nav.mainPageView = document.getElementById('mainPageView');
    nav.settingsPageView = document.getElementById('settingsPageView');
    
    // Verify all navigation elements exist
    const navElements = Object.entries(nav);
    for (const [key, element] of navElements) {
        if (!element) {
            console.error(`❌ Navigation element not found: ${key}`);
        } else {
            console.log(`✅ Navigation element found: ${key}`);
        }
    }
    
    // Ensure main page is active on load
    if (nav.mainPageView) {
        nav.mainPageView.classList.add('active');
    }
    if (nav.settingsPageView) {
        nav.settingsPageView.classList.remove('active');
    }
}

/**
 * Initialize main page elements
 */
function initializeMainPage() {
    console.log('🔍 Initializing main page elements');
    
    main.statusIndicator = document.getElementById('statusIndicator');
    main.statusDot = document.querySelector('.status-dot');
    main.statusText = document.querySelector('.status-text');
    main.currentSession = document.getElementById('currentSession');
    main.sessionTitle = document.getElementById('sessionTitle');
    main.sessionInfo = document.getElementById('sessionInfo');
    
    // Focus mode elements
    main.enableFocusBtn = document.getElementById('enableFocusBtn');
    main.disableFocusBtn = document.getElementById('disableFocusBtn');
    main.pomodoroSection = document.getElementById('pomodoroSection');
    
    // Timer elements
    main.timerDisplay = document.getElementById('timerDisplay');
    main.startTimerBtn = document.getElementById('startTimerBtn');
    main.pauseTimerBtn = document.getElementById('pauseTimerBtn');
    main.resetTimerBtn = document.getElementById('resetTimerBtn');
    main.timerDuration = document.getElementById('timerDuration');
    
    // Focus Mode Timer elements
    main.timerDisplayFocusMode = document.getElementById('timerDisplayFocusMode');
    main.startTimerBtnFocusMode = document.getElementById('startTimerBtnFocusMode');
    main.pauseTimerBtnFocusMode = document.getElementById('pauseTimerBtnFocusMode');
    main.resetTimerBtnFocusMode = document.getElementById('resetTimerBtnFocusMode');
    main.timerDurationFocusMode = document.getElementById('timerDurationFocusMode');
    
    // Camera elements
    main.cameraFeed = document.getElementById('cameraFeed');
    main.cameraCanvas = document.getElementById('cameraCanvas');
    main.cameraOverlay = document.getElementById('cameraOverlay');
    main.toggleCameraBtn = document.getElementById('toggleCameraBtn');
    main.cameraStatusText = document.getElementById('cameraStatusText');
    main.cameraStatus = document.getElementById('cameraStatus');
    
    // Focus mode camera elements
    main.cameraFeedFocusMode = document.getElementById('cameraFeedFocusMode');
    main.cameraCanvasFocusMode = document.getElementById('cameraCanvasFocusMode');
    main.cameraOverlayFocusMode = document.getElementById('cameraOverlayFocusMode');
    main.toggleCameraBtnFocusMode = document.getElementById('toggleCameraBtnFocusMode');
    main.cameraStatusFocusMode = document.getElementById('cameraStatusFocusMode');
    main.cameraStatusTextFocusMode = document.getElementById('cameraStatusText');
    main.faceDetectionBox = document.querySelector('.face-detection-box');
    
    main.attentionValue = document.getElementById('attentionValue');
    main.attentionProgress = document.getElementById('attentionProgress');
    main.attentionMessage = document.getElementById('attentionMessage');
    
    // Stats elements
    main.durationStat = document.getElementById('durationStat');
    main.focusStat = document.getElementById('focusStat');
    main.avgScoreStat = document.getElementById('avgScoreStat');
    main.peakFocusStat = document.getElementById('peakFocusStat');
    main.lowFocusStat = document.getElementById('lowFocusStat');
    main.quizStat = document.getElementById('quizStat');
    main.statsSection = document.getElementById('statsSection');
    main.controlsSection = document.getElementById('controlsSection');
    main.pauseBtn = document.getElementById('pauseBtn');
    main.endSessionBtn = document.getElementById('endSessionBtn');
    main.notificationsContainer = document.getElementById('notificationsContainer');
    
    // Log element initialization
    const mainElements = Object.entries(main);
    let foundCount = 0;
    for (const [key, element] of mainElements) {
        if (element) {
            foundCount++;
        } else {
            console.warn(`⚠️ Main page element not found: ${key}`);
        }
    }
    console.log(`✅ Main page: ${foundCount}/${mainElements.length} elements found`);
}

/**
 * Initialize settings elements
 */
function initializeSettings() {
    console.log('🔍 Initializing settings elements');
    
    // API Settings
    settings.geminiApiKey = document.getElementById('settingGeminiApiKey');
    settings.toggleApiKey = document.getElementById('settingToggleApiKey');
    settings.saveApiKey = document.getElementById('settingSaveApiKey');
    settings.testApiKey = document.getElementById('settingTestApiKey');
    settings.apiKeyStatus = document.getElementById('settingApiKeyStatus');
    
    // Feature Toggles
    settings.autoDetection = document.getElementById('settingAutoDetection');
    settings.enableGemini = document.getElementById('settingEnableGemini');
    settings.enableSwitchSuggestions = document.getElementById('settingEnableSwitchSuggestions');
    settings.enableBlocking = document.getElementById('settingEnableBlocking');
    
    // Analysis Settings
    settings.analysisInterval = document.getElementById('settingAnalysisInterval');
    settings.attentionThreshold = document.getElementById('settingAttentionThreshold');
    settings.geminiInterval = document.getElementById('settingGeminiInterval');
    
    // Quiz Settings
    settings.quizDifficulty = document.getElementById('settingQuizDifficulty');
    settings.questionsPerQuiz = document.getElementById('settingQuestionsPerQuiz');
    
    // Notification Settings
    settings.enableNotifications = document.getElementById('settingEnableNotifications');
    settings.breakInterval = document.getElementById('settingBreakInterval');
    
    // Data Settings
    settings.enableHistory = document.getElementById('settingEnableHistory');
    settings.clearDataBtn = document.getElementById('settingClearDataBtn');
    
    // Onboarding and Profile
    settings.restartOnboardingBtn = document.getElementById('settingRestartOnboardingBtn');
    
    // Suggestions
    settings.suggestionList = document.getElementById('settingSuggestionList');
    settings.newSuggestionTitle = document.getElementById('settingNewSuggestionTitle');
    settings.newSuggestionUrl = document.getElementById('settingNewSuggestionUrl');
    settings.newSuggestionDesc = document.getElementById('settingNewSuggestionDesc');
    settings.addSuggestion = document.getElementById('settingAddSuggestion');
    
    // Buttons
    settings.saveBtn = document.getElementById('settingSaveBtn');
    settings.resetBtn = document.getElementById('settingResetBtn');
    
    // Log element initialization
    const settingElements = Object.entries(settings);
    let foundCount = 0;
    for (const [key, element] of settingElements) {
        if (element) {
            foundCount++;
        } else {
            console.warn(`⚠️ Settings element not found: ${key}`);
        }
    }
    console.log(`✅ Settings: ${foundCount}/${settingElements.length} elements found`);
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    console.log('� Setting up event listeners');
    
    // Navigation
    if (nav.settingsBtn) {
        nav.settingsBtn.addEventListener('click', openSettingsPage);
        console.log('✅ Settings button listener attached');
    }
    
    if (nav.backBtn) {
        nav.backBtn.addEventListener('click', goToMainPage);
        console.log('✅ Back button listener attached');
    }
    
    // Focus mode buttons
    if (main.enableFocusBtn) {
        main.enableFocusBtn.addEventListener('click', enableFocusMode);
        console.log('✅ Enable focus button listener attached');
    }
    if (main.disableFocusBtn) {
        main.disableFocusBtn.addEventListener('click', disableFocusMode);
        console.log('✅ Disable focus button listener attached');
    }
    
    // Timer buttons
    if (main.startTimerBtn) {
        main.startTimerBtn.addEventListener('click', startTimer);
    }
    if (main.pauseTimerBtn) {
        main.pauseTimerBtn.addEventListener('click', pauseTimer);
    }
    if (main.resetTimerBtn) {
        main.resetTimerBtn.addEventListener('click', resetTimer);
    }
    if (main.timerDuration) {
        main.timerDuration.addEventListener('change', updateTimerDuration);
    }
    
    // Focus Mode Timer buttons
    if (main.startTimerBtnFocusMode) {
        main.startTimerBtnFocusMode.addEventListener('click', startTimer);
    }
    if (main.pauseTimerBtnFocusMode) {
        main.pauseTimerBtnFocusMode.addEventListener('click', pauseTimer);
    }
    if (main.resetTimerBtnFocusMode) {
        main.resetTimerBtnFocusMode.addEventListener('click', resetTimer);
    }
    if (main.timerDurationFocusMode) {
        main.timerDurationFocusMode.addEventListener('change', updateTimerDuration);
    }
    
    // Camera toggle
    if (main.toggleCameraBtn) {
        main.toggleCameraBtn.addEventListener('click', toggleCamera);
        console.log('✅ Camera toggle button listener attached');
    }
    
    // Stats toggle button
    const statsToggleBtn = document.getElementById('statsToggleBtn');
    if (statsToggleBtn) {
        statsToggleBtn.addEventListener('click', toggleStatsSection);
        console.log('✅ Stats toggle button listener attached');
    }
    
    // Main page controls
    if (main.pauseBtn) {
        main.pauseBtn.addEventListener('click', pauseSession);
    }
    if (main.endSessionBtn) {
        main.endSessionBtn.addEventListener('click', endSession);
    }
    
    // Settings inputs - auto-save on change
    if (settings.geminiApiKey) {
        settings.geminiApiKey.addEventListener('change', saveSettings);
    }
    if (settings.autoDetection) {
        settings.autoDetection.addEventListener('change', saveSettings);
    }
    if (settings.enableGemini) {
        settings.enableGemini.addEventListener('change', saveSettings);
    }
    if (settings.enableSwitchSuggestions) {
        settings.enableSwitchSuggestions.addEventListener('change', saveSettings);
    }
    if (settings.enableBlocking) {
        settings.enableBlocking.addEventListener('change', saveSettings);
    }
    if (settings.analysisInterval) {
        settings.analysisInterval.addEventListener('change', saveSettings);
    }
    if (settings.attentionThreshold) {
        settings.attentionThreshold.addEventListener('change', saveSettings);
    }
    if (settings.geminiInterval) {
        settings.geminiInterval.addEventListener('change', saveSettings);
    }
    if (settings.quizDifficulty) {
        settings.quizDifficulty.addEventListener('change', saveSettings);
    }
    if (settings.questionsPerQuiz) {
        settings.questionsPerQuiz.addEventListener('change', saveSettings);
    }
    if (settings.enableNotifications) {
        settings.enableNotifications.addEventListener('change', saveSettings);
    }
    if (settings.breakInterval) {
        settings.breakInterval.addEventListener('change', saveSettings);
    }
    if (settings.enableHistory) {
        settings.enableHistory.addEventListener('change', saveSettings);
    }
    
    // API Key handlers
    if (settings.toggleApiKey) {
        settings.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
    }
    if (settings.saveApiKey) {
        settings.saveApiKey.addEventListener('click', saveApiKeyHandler);
    }
    if (settings.testApiKey) {
        settings.testApiKey.addEventListener('click', testApiKeyHandler);
    }
    
    // Suggestions handlers
    if (settings.addSuggestion) {
        settings.addSuggestion.addEventListener('click', addSuggestionHandler);
    }
    
    // Settings buttons
    if (settings.saveBtn) {
        settings.saveBtn.addEventListener('click', saveSettings);
    }
    if (settings.clearDataBtn) {
        settings.clearDataBtn.addEventListener('click', clearAllData);
    }
    if (settings.resetBtn) {
        settings.resetBtn.addEventListener('click', resetSettingsHandler);
    }
    if (settings.restartOnboardingBtn) {
        settings.restartOnboardingBtn.addEventListener('click', restartOnboarding);
    }
    
    console.log('✅ Event listeners setup complete');
}

/**
 * Navigate to settings page
 */
function openSettingsPage() {
    console.log('⚙️ Opening settings page');
    
    if (nav.mainPageView) {
        nav.mainPageView.classList.remove('active');
    }
    if (nav.settingsPageView) {
        nav.settingsPageView.classList.add('active');
    }
    if (nav.settingsBtn) {
        nav.settingsBtn.classList.add('hidden');
    }
    if (nav.backBtn) {
        nav.backBtn.classList.remove('hidden');
    }
    
    // Load settings into form
    loadSettingsIntoForm();
}

/**
 * Navigate back to main page
 */
function goToMainPage() {
    console.log('⬅️ Going back to main page');
    
    if (nav.settingsPageView) {
        nav.settingsPageView.classList.remove('active');
    }
    if (nav.mainPageView) {
        nav.mainPageView.classList.add('active');
    }
    if (nav.backBtn) {
        nav.backBtn.classList.add('hidden');
    }
    if (nav.settingsBtn) {
        nav.settingsBtn.classList.remove('hidden');
    }
    
    // Load suggestions and settings when opening
    loadSuggestions();
}

/**
 * Toggle API Key visibility
 */
function toggleApiKeyVisibility() {
    if (settings.geminiApiKey.type === 'password') {
        settings.geminiApiKey.type = 'text';
        settings.toggleApiKey.textContent = '🙈';
    } else {
        settings.geminiApiKey.type = 'password';
        settings.toggleApiKey.textContent = '👁️';
    }
}

/**
 * Save API Key handler
 */
function saveApiKeyHandler() {
    const key = settings.geminiApiKey?.value?.trim();
    
    if (!key) {
        showApiKeyStatus('Please enter an API key', 'error');
        return;
    }
    
    const settingsData = getDefaultSettings();
    settingsData.geminiApiKey = key;
    
    chrome.storage.sync.set({ focusguard_settings: settingsData }, () => {
        console.log('✅ API key saved');
        showApiKeyStatus('API key saved successfully', 'success');
    });
}

/**
 * Test API Key handler
 */
async function testApiKeyHandler() {
    const key = settings.geminiApiKey?.value?.trim();
    
    if (!key) {
        showApiKeyStatus('Please enter an API key first', 'error');
        return;
    }
    
    showApiKeyStatus('Testing connection...', 'info');
    
    // Send message to background to test API key
    chrome.runtime.sendMessage(
        { action: 'testGeminiKey', apiKey: key },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error('Message error:', chrome.runtime.lastError);
                showApiKeyStatus('❌ Error: ' + chrome.runtime.lastError.message, 'error');
                return;
            }

            if (response && response.success) {
                console.log('✅ API key test passed');
                showApiKeyStatus('✅ Connection successful', 'success');
            } else {
                const errorMsg = response?.error || 'Unknown error';
                console.error('❌ API key test failed:', errorMsg);
                showApiKeyStatus('❌ Connection failed: ' + errorMsg, 'error');
            }
        }
    );
}

/**
 * Show API Key status message
 */
function showApiKeyStatus(message, type) {
    if (!settings.apiKeyStatus) return;
    
    settings.apiKeyStatus.textContent = message;
    settings.apiKeyStatus.className = 'status-message ' + type;
    
    if (type !== 'info') {
        setTimeout(() => {
            settings.apiKeyStatus.textContent = '';
            settings.apiKeyStatus.className = 'status-message';
        }, 5000);
    }
}

/**
 * Load suggestions from storage
 */
function loadSuggestions() {
    chrome.storage.sync.get('focusguard_suggestions', (data) => {
        currentSuggestions = data.focusguard_suggestions || [];
        renderSuggestionList();
    });
}

/**
 * Render suggestion list
 */
function renderSuggestionList() {
    if (!settings.suggestionList) return;
    
    settings.suggestionList.innerHTML = '';
    
    currentSuggestions.forEach((suggestion, index) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `
            <div class="suggestion-item-content">
                <span class="suggestion-item-title">${suggestion.title}</span>
                ${suggestion.description ? `<span class="suggestion-item-desc">${suggestion.description}</span>` : ''}
            </div>
            <button class="suggestion-item-remove" data-index="${index}">✕</button>
        `;
        settings.suggestionList.appendChild(div);
    });
    
    document.querySelectorAll('.suggestion-item-remove').forEach((btn) => {
        btn.addEventListener('click', removeSuggestionHandler);
    });
}

/**
 * Add suggestion handler
 */
function addSuggestionHandler() {
    const title = settings.newSuggestionTitle?.value?.trim();
    const url = settings.newSuggestionUrl?.value?.trim();
    const description = settings.newSuggestionDesc?.value?.trim();
    
    if (!title) {
        showNotification('Error', 'Please enter a title for the suggestion', 'error');
        return;
    }
    
    const newSuggestion = {
        id: 'custom_' + Date.now(),
        title: title,
        url: url || '',
        description: description || ''
    };
    
    currentSuggestions.push(newSuggestion);
    
    chrome.storage.sync.set({ focusguard_suggestions: currentSuggestions }, () => {
        console.log('✅ Suggestion added');
        showNotification('Success', 'Suggestion added', 'success');
        
        // Clear inputs
        if (settings.newSuggestionTitle) settings.newSuggestionTitle.value = '';
        if (settings.newSuggestionUrl) settings.newSuggestionUrl.value = '';
        if (settings.newSuggestionDesc) settings.newSuggestionDesc.value = '';
        
        renderSuggestionList();
    });
}

/**
 * Remove suggestion handler
 */
function removeSuggestionHandler(event) {
    const index = parseInt(event.target.dataset.index);
    currentSuggestions.splice(index, 1);
    
    chrome.storage.sync.set({ focusguard_suggestions: currentSuggestions }, () => {
        console.log('✅ Suggestion removed');
        renderSuggestionList();
    });
}

/**
 * Reset all settings handler
 */
function resetSettingsHandler() {
    if (confirm('Are you sure you want to reset all settings and remove your API key? This cannot be undone.')) {
        chrome.storage.sync.clear(() => {
            chrome.storage.local.clear(() => {
                console.log('✅ All settings reset');
                showNotification('Settings Reset', 'All data has been cleared', 'success');
                location.reload();
            });
        });
    }
}

/**
 * Load settings from Chrome storage into form
 */
function loadSettingsIntoForm() {
    console.log('📖 Loading settings into form');
    
    chrome.storage.sync.get('focusguard_settings', (data) => {
        const storedSettings = data.focusguard_settings || getDefaultSettings();
        console.log('📋 Loaded settings:', storedSettings);
        
        // API Settings
        if (settings.geminiApiKey) {
            settings.geminiApiKey.value = storedSettings.geminiApiKey || '';
        }
        
        // Feature Toggles
        if (settings.autoDetection) {
            settings.autoDetection.checked = storedSettings.enableAutoDetection ?? true;
        }
        if (settings.enableGemini) {
            settings.enableGemini.checked = storedSettings.enableGemini ?? true;
        }
        if (settings.enableSwitchSuggestions) {
            settings.enableSwitchSuggestions.checked = storedSettings.enableSwitchSuggestions ?? true;
        }
        if (settings.enableBlocking) {
            settings.enableBlocking.checked = storedSettings.enableBlocking ?? false;
        }
        
        // Analysis Settings
        if (settings.analysisInterval) {
            settings.analysisInterval.value = storedSettings.analysisInterval ?? 3;
        }
        if (settings.attentionThreshold) {
            settings.attentionThreshold.value = storedSettings.attentionThreshold ?? 50;
        }
        if (settings.geminiInterval) {
            settings.geminiInterval.value = storedSettings.geminiInterval ?? 5;
            // Update both global interval variables
            focusGeminiUpdateInterval = (storedSettings.geminiInterval ?? 5) * 60 * 1000;
            geminiAnalysisInterval = (storedSettings.geminiInterval ?? 5) * 60 * 1000;
            console.log('⏱️ Gemini update interval set to:', storedSettings.geminiInterval, 'minutes (', geminiAnalysisInterval, 'ms)');
        }
        
        // Quiz Settings
        if (settings.quizDifficulty) {
            settings.quizDifficulty.value = storedSettings.quizDifficulty ?? 'medium';
        }
        if (settings.questionsPerQuiz) {
            settings.questionsPerQuiz.value = storedSettings.questionsPerQuiz ?? 5;
        }
        
        // Notification Settings
        if (settings.enableNotifications) {
            settings.enableNotifications.checked = storedSettings.enableNotifications ?? true;
        }
        if (settings.breakInterval) {
            settings.breakInterval.value = storedSettings.breakInterval ?? 25;
        }
        
        // Data Settings
        if (settings.enableHistory) {
            settings.enableHistory.checked = storedSettings.enableHistory ?? true;
        }
    });
}

/**
 * Save settings to Chrome storage
 */
function saveSettings() {
    console.log('💾 Saving settings');
    
    const newSettings = {
        geminiApiKey: settings.geminiApiKey?.value || '',
        enableAutoDetection: settings.autoDetection?.checked ?? true,
        enableGemini: settings.enableGemini?.checked ?? true,
        enableSwitchSuggestions: settings.enableSwitchSuggestions?.checked ?? true,
        enableBlocking: settings.enableBlocking?.checked ?? false,
        analysisInterval: parseInt(settings.analysisInterval?.value) || 3,
        attentionThreshold: parseInt(settings.attentionThreshold?.value) || 50,
        geminiInterval: parseInt(settings.geminiInterval?.value) || 5,
        quizDifficulty: settings.quizDifficulty?.value || 'medium',
        questionsPerQuiz: parseInt(settings.questionsPerQuiz?.value) || 5,
        enableNotifications: settings.enableNotifications?.checked ?? true,
        breakInterval: parseInt(settings.breakInterval?.value) || 25,
        enableHistory: settings.enableHistory?.checked ?? true
    };
    
    // Update detection interval if camera is active
    detectionInterval = newSettings.analysisInterval * 1000;
    console.log('⏱️ Updated detection interval to:', detectionInterval, 'ms');
    
    // Update Gemini analysis intervals (both focus mode and regular detection)
    focusGeminiUpdateInterval = newSettings.geminiInterval * 60 * 1000;
    geminiAnalysisInterval = newSettings.geminiInterval * 60 * 1000;
    console.log('🧠 Updated Gemini interval to:', newSettings.geminiInterval, 'minutes (', geminiAnalysisInterval, 'ms)');
    
    // Also save blocker settings (for website-blocker.js compatibility)
    const blockerSettings = {
        blocker_enabled: newSettings.enableBlocking,
        blocker_blacklist: [
            'twitter.com', 'www.twitter.com',
            'reddit.com', 'www.reddit.com',
            'facebook.com', 'www.facebook.com',
            'instagram.com', 'www.instagram.com',
            'tiktok.com', 'www.tiktok.com',
            'pinterest.com', 'www.pinterest.com',
            'twitch.tv', 'www.twitch.tv',
            'discord.com', 'www.discord.com'
        ],
        blocker_whitelist: [
            'youtube.com', 'www.youtube.com',
            'coursera.org', 'www.coursera.org',
            'udemy.com', 'www.udemy.com',
            'medium.com', 'www.medium.com',
            'dev.to', 'github.com', 'www.github.com',
            'wikipedia.org', 'en.wikipedia.org',
            'stackoverflow.com', 'www.stackoverflow.com',
            'docs.google.com', 'google.com'
        ]
    };
    
    // Save both settings at once
    const storageData = {
        focusguard_settings: newSettings,
        ...blockerSettings
    };
    
    chrome.storage.sync.set(storageData, () => {
        console.log('✅ Settings saved (including blocker config):', newSettings);
        showNotification('Settings Saved', 'Your preferences have been updated', 'success');
    });
}

/**
 * Clear all data
 */
function clearAllData() {
    console.log('🗑️ Clearing all data');
    if (confirm('Are you sure you want to clear all stored data? This cannot be undone.')) {
        chrome.storage.local.clear(() => {
            chrome.storage.sync.clear(() => {
                console.log('✅ All data cleared');
                showNotification('Data Cleared', 'All stored data has been removed', 'success');
            });
        });
    }
}

/**
 * Restart onboarding to recalibrate user profile
 */
async function restartOnboarding() {
    console.log('🔄 Restarting onboarding process');
    
    // Mark onboarding as not completed
    await chrome.storage.local.set({ 'onboarding_completed': false });
    
    showNotification('Onboarding Started', 'Recalibrating your attention profile...', 'info');
    
    // Show onboarding modal
    showOnboardingModal(async () => {
        // After onboarding completes, reload user profile
        userProfile = await getUserAttentionProfile();
        console.log('✅ User profile updated:', userProfile);
        showNotification('Profile Updated', 'Your attention profile has been recalibrated', 'success');
    });
}

/**
 * Get default settings
 */
function getDefaultSettings() {
    return {
        geminiApiKey: '',
        analysisInterval: 3,
        geminiInterval: 5,
        enableGemini: true,
        enableSwitchSuggestions: true,
        enableAutoDetection: true,
        enableBlocking: false,
        attentionThreshold: 50,
        quizDifficulty: 'medium',
        questionsPerQuiz: 5,
        enableNotifications: true,
        breakInterval: 25,
        enableHistory: true
    };
}

/**
 * Load initial state
 */
function loadInitialState() {
    console.log('🔄 Loading initial state');
    
    // Load Gemini API key from settings (optional for camera)
    chrome.storage.sync.get('focusguard_settings', (result) => {
        const settings = result.focusguard_settings || {};
        const apiKey = settings.geminiApiKey?.trim();
        
        if (apiKey) {
            setGeminiApiKey(apiKey);
            console.log('✅ Gemini API key loaded from settings');
        } else {
            console.warn('⚠️ No Gemini API key configured - some AI features will be limited');
            showNotification('API Key Not Configured', 
                'Add your Gemini API key in Settings to enable AI features like smart quizzes and personalized recommendations', 
                'info');
        }
        
        // Initialize camera regardless of API key
        initializeCamera();
    });
    
    // Request active session from background
    chrome.runtime.sendMessage({ action: 'getActiveSession' }, (response) => {
        console.log('📊 Active session response:', response);
        if (response?.session) {
            currentSession = response.session;
            sessionStartTime = response.session.startTime || Date.now();
            updateSessionDisplay();
        }
    });
    
    // Listen for messages from background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('📨 Message received:', request.action);
        
        if (request.action === 'sessionUpdate') {
            updateSessionDisplay(request.data);
        } else if (request.action === 'attentionUpdate') {
            updateAttentionDisplay(request.data);
        }
    });
}

/**
 * Update session display
 */
function updateSessionDisplay(data = null) {
    if (data) {
        currentSession = data;
    }
    
    if (!currentSession || !main.currentSession) return;
    
    console.log('📊 Updating session display');
    
    main.currentSession.classList.remove('hidden');
    if (main.sessionTitle) {
        main.sessionTitle.textContent = currentSession.title || 'Active Session';
    }
    if (main.sessionInfo) {
        main.sessionInfo.textContent = currentSession.description || 'Focus session in progress';
    }
    
    // Update stats if available
    if (currentSession.duration && main.durationStat) {
        main.durationStat.textContent = formatTime(currentSession.duration);
    }
    if (currentSession.focusPercentage && main.focusStat) {
        main.focusStat.textContent = Math.round(currentSession.focusPercentage) + '%';
    }
}

/**
 * Update attention display
 */
function updateAttentionDisplay(data) {
    if (!data || !main.attentionValue) return;
    
    console.log('👁️ Updating attention display:', data.score);
    
    if (main.attentionValue) {
        main.attentionValue.textContent = Math.round(data.score) + '%';
    }
    if (main.attentionProgress) {
        main.attentionProgress.style.width = data.score + '%';
    }
    
    // Update status indicator
    updateStatusIndicator(data);
}

/**
 * Update status indicator based on attention score
 */
function updateStatusIndicator(data) {
    if (!main.statusDot || !main.statusText) return;
    
    main.statusDot.classList.remove('idle', 'active', 'distracted');
    
    if (data.score >= 70) {
        main.statusDot.classList.add('active');
        main.statusText.textContent = 'Focused';
    } else if (data.score >= 40) {
        main.statusDot.classList.add('idle');
        main.statusText.textContent = 'Attentive';
    } else {
        main.statusDot.classList.add('distracted');
        main.statusText.textContent = 'Distracted';
    }
}

/**
 * Pause session
 */
function pauseSession() {
    console.log('⏸️ Pausing session');
    chrome.runtime.sendMessage({ action: 'pauseSession' });
    showNotification('Session Paused', 'Monitoring has been paused', 'info');
}

/**
 * End session
 */
function endSession() {
    console.log('⏹️ Ending session');
    chrome.runtime.sendMessage({ action: 'endSession' });
    showNotification('Session Ended', 'Learning session has ended', 'success');
    currentSession = null;
    if (main.currentSession) {
        main.currentSession.classList.add('hidden');
    }
}

/**
 * Show notification
 */
function showNotification(title, message, type = 'info') {
    if (!main.notificationsContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `<strong>${title}:</strong> ${message}`;
    
    main.notificationsContainer.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

/**
 * Format time in seconds to MM:SS
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Initialize camera feed and detection
 */
async function initializeCamera() {
    console.log('📷 Initializing camera...');
    
    // Determine which camera element to use based on focus mode
    let cameraElement = focusModeEnabled ? main.cameraFeedFocusMode : main.cameraFeed;
    
    if (!cameraElement) {
        console.error('❌ Camera feed element not found for', focusModeEnabled ? 'focus mode' : 'regular mode');
        console.error('📷 focusModeEnabled:', focusModeEnabled);
        console.error('📷 main.cameraFeedFocusMode:', main.cameraFeedFocusMode);
        console.error('📷 main.cameraFeed:', main.cameraFeed);
        return;
    }
    
    console.log('✅ Camera element found:', cameraElement.id);
    
    try {
        // Check if Gemini API key is configured (optional for camera, required for AI features)
        let apiKey = getGeminiApiKey();
        
        if (!apiKey) {
            // If not in memory, try to load from settings in storage.sync
            apiKey = await new Promise((resolve) => {
                chrome.storage.sync.get('focusguard_settings', (result) => {
                    const settings = result.focusguard_settings || {};
                    resolve(settings.geminiApiKey?.trim() || null);
                });
            });
            
            if (apiKey) {
                setGeminiApiKey(apiKey);
                console.log('✅ API key loaded from settings and set in memory');
            } else {
                console.log('ℹ️ No API key configured - camera and attention tracking will work, but AI features will be limited');
            }
        }
        
        // Load detection interval from settings
        await new Promise((resolve) => {
            chrome.storage.sync.get('focusguard_settings', (result) => {
                if (result.focusguard_settings && result.focusguard_settings.analysisInterval) {
                    detectionInterval = result.focusguard_settings.analysisInterval * 1000;
                    console.log('⏱️ Detection interval set to:', detectionInterval, 'ms');
                }
                resolve();
            });
        });
        
        // Request camera access
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 320 },
                height: { ideal: 320 },
                facingMode: 'user'
            },
            audio: false
        });
        
        console.log('✅ Camera stream obtained:', cameraStream);
        console.log('📹 Camera element:', cameraElement);
        console.log('📹 Camera element ID:', cameraElement?.id);
        console.log('📹 Camera element className:', cameraElement?.className);
        
        // Set the stream to the video element (use the appropriate one)
        cameraElement.srcObject = cameraStream;
        console.log('✅ Stream assigned to video element');
        
        // Wait for video to load metadata before playing
        return new Promise((resolve, reject) => {
            cameraElement.onloadedmetadata = () => {
                console.log('✅ Camera feed metadata loaded');
                console.log('📹 Video width:', cameraElement.videoWidth, 'height:', cameraElement.videoHeight);
                
                // Now play the video
                cameraElement.play()
                    .then(() => {
                        console.log('✅ Video is playing');
                        updateCameraStatus('Camera ready', 'ready');
                    })
                    .catch(err => {
                        console.error('❌ Error playing video:', err);
                        updateCameraStatus('Camera error', 'error');
                    });
            };
            
            cameraElement.onerror = (err) => {
                console.error('❌ Video element error:', err);
                reject(err);
            };
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (cameraElement.videoWidth === 0) {
                    console.warn('⚠️ Video metadata not loaded after 5 seconds');
                } else {
                    resolve();
                }
            }, 5000);
            
            // Also try to play immediately in case metadata is already loaded
            cameraElement.play().catch(err => {
                console.warn('⚠️ Initial play failed (expected):', err.message);
            });
        }).then(() => {
            // Initialize MediaPipe models
            return initializeMediaPipeModels();
        }).then(() => {
            // Start detection loop after models are initialized
            startFaceDetection();
            isCameraEnabled = true;
            updateCameraStatus('Detecting face...', 'detecting');
        }).catch(err => {
            console.error('❌ Error in post-camera setup:', err);
        });
        
    } catch (error) {
        console.error('❌ Camera initialization error:', error);
        updateCameraStatus('Camera unavailable', 'error');
        cameraElement.style.backgroundColor = '#1f2937';
    }
}

/**
 * Initialize MediaPipe models
 */
async function initializeMediaPipeModels() {
    try {
        console.log('🔄 Initializing MediaPipe models...');
        
        // Initialize using imported module
        const models = await initializeLandmarkers();
        faceLandmarker = models.faceLandmarker;
        poseLandmarker = models.poseLandmarker;
        
        // Switch to video mode for continuous detection
        await switchToVideoMode();
        console.log('✓ Models switched to VIDEO mode');
        
        console.log('✅ MediaPipe models initialized');
        return true;
        
    } catch (error) {
        console.error('❌ Failed to initialize MediaPipe:', error);
        updateCameraStatus('Model loading failed', 'error');
        return false;
    }
}

/**
 * Start face detection loop
 */
function startFaceDetection() {
    // Use the appropriate camera element based on mode
    let cameraElement = focusModeEnabled ? main.cameraFeedFocusMode : main.cameraFeed;
    let canvasElement = focusModeEnabled ? main.cameraCanvasFocusMode : main.cameraCanvas;
    
    if (!faceLandmarker || !cameraElement) {
        console.warn('⚠️ Cannot start detection: models or camera not ready');
        return;
    }
    
    detectionRunning = true;
    lastDetectionTime = performance.now();
    console.log('🎯 Starting face detection... (interval: ' + detectionInterval + 'ms)', focusModeEnabled ? '[FOCUS MODE]' : '[REGULAR MODE]');
    
    function detectFrame() {
        // Check if detection should continue
        if (!detectionRunning || !cameraElement || !faceLandmarker) {
            console.log('🛑 Detection loop stopped');
            return;
        }
        
        try {
            // Verify video is actually playing and has valid dimensions
            if (cameraElement.videoWidth === 0 || cameraElement.videoHeight === 0) {
                // Video not ready yet, try again next frame
                requestAnimationFrame(detectFrame);
                return;
            }
            
            // Check if enough time has passed since last detection
            const currentTime = performance.now();
            const timeSinceLastDetection = currentTime - lastDetectionTime;
            
            // Only run full detection analysis at the configured interval
            if (timeSinceLastDetection >= detectionInterval) {
                lastDetectionTime = currentTime;
                
                // Create image from video frame
                const canvas = canvasElement || document.createElement('canvas');
                canvas.width = cameraElement.videoWidth;
                canvas.height = cameraElement.videoHeight;
                
                // Validate canvas dimensions
                if (canvas.width <= 0 || canvas.height <= 0) {
                    console.warn('⚠️ Invalid canvas dimensions:', canvas.width, 'x', canvas.height);
                    requestAnimationFrame(detectFrame);
                    return;
                }
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(cameraElement, 0, 0);
                
                // Run face detection
                const result = faceLandmarker.detectForVideo(canvas, performance.now());
                
                // Process results
                if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
                    updateFaceDetectionBox(result.faceLandmarks[0], canvas.width, canvas.height);
                    
                    // Log landmark features
                    logFaceLandmarkFeatures(result);
                    
                    // Analyze attention using the imported analyzer
                    try {
                        const attentionResult = analyzeFaceAttention(result);
                        updateAttentionScore(attentionResult.score);
                        
                        // Log attention details
                        console.log('🎯 Attention Analysis:', {
                            score: attentionResult.score.toFixed(2),
                            headForward: attentionResult.details.headForward,
                            headLevel: attentionResult.details.headLevel,
                            eyesOpen: attentionResult.details.eyesOpen,
                            eyesCentered: attentionResult.details.eyesCentered
                        });
                        
                        // Send to Gemini for detailed analysis (throttled)
                        sendLandmarksToGemini(result, attentionResult.score, attentionResult.details);
                        
                    } catch (error) {
                        console.error('Error analyzing attention:', error);
                    }
                    
                    updateCameraStatus('Face detected ✓', 'success');
                } else {
                    // No face detected
                    clearFaceDetectionBox();
                    displayFaceNotDetected();
                    updateCameraStatus('⚠️ Unable to detect face - camera may be obstructed', 'warning');
                }
            } else {
                // Just keep the video playing, don't analyze yet
                // Don't update status on every loop - it causes visual pulsing
            }
        } catch (error) {
            // Only log if detection is still supposed to be running
            if (detectionRunning) {
                console.error('❌ Detection error:', error);
                updateCameraStatus('Detection error', 'error');
            }
        }
        
        // Continue loop only if detection is enabled
        if (detectionRunning) {
            requestAnimationFrame(detectFrame);
        }
    }
    
    detectFrame();
}

/**
 * Update face detection box visualization
 */
function updateFaceDetectionBox(landmarks, canvasWidth, canvasHeight) {
    if (!main.faceDetectionBox || !main.cameraOverlay) return;
    
    // Calculate bounding box from landmarks
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    
    landmarks.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    });
    
    const padding = 0.1;
    const x = Math.max(0, minX - padding) * 100;
    const y = Math.max(0, minY - padding) * 100;
    const width = Math.min(100 - x, (maxX - minX + padding * 2) * 100);
    const height = Math.min(100 - y, (maxY - minY + padding * 2) * 100);
    
    main.faceDetectionBox.style.left = x + '%';
    main.faceDetectionBox.style.top = y + '%';
    main.faceDetectionBox.style.width = width + '%';
    main.faceDetectionBox.style.height = height + '%';
    main.faceDetectionBox.classList.add('detected');
}

/**
 * Clear face detection box
 */
function clearFaceDetectionBox() {
    if (main.faceDetectionBox) {
        main.faceDetectionBox.classList.remove('detected');
    }
}

/**
 * Update attention score
 */
/**
 * Log extracted face landmark features
 */
function logFaceLandmarkFeatures(faceResult) {
    if (!faceResult || !faceResult.faceLandmarks || faceResult.faceLandmarks.length === 0) {
        return;
    }
    
    const landmarks = faceResult.faceLandmarks[0];
    
    // Key facial landmarks for attention analysis
    const importantLandmarks = {
        'Nose (tip)': landmarks[1],
        'Left Eye (inner)': landmarks[33],
        'Right Eye (inner)': landmarks[263],
        'Left Eye (outer)': landmarks[133],
        'Right Eye (outer)': landmarks[362],
        'Mouth (left)': landmarks[61],
        'Mouth (right)': landmarks[291],
        'Face Center': landmarks[10]
    };
    
    let landmarkInfo = '📍 Key Landmarks: ';
    Object.entries(importantLandmarks).forEach(([name, point]) => {
        if (point) {
            landmarkInfo += `${name}(${point.x.toFixed(2)},${point.y.toFixed(2)}) `;
        }
    });
    
    console.log(landmarkInfo);
    
    // Log blendshapes (facial expressions)
    if (faceResult.faceBlendshapes && faceResult.faceBlendshapes.length > 0) {
        const blendshapes = faceResult.faceBlendshapes[0].categories;
        
        // Important blendshapes for attention
        const importantExpressions = [
            'eyeBlinkLeft', 'eyeBlinkRight',
            'eyeLookUpLeft', 'eyeLookDownLeft',
            'eyeLookUpRight', 'eyeLookDownRight',
            'mouthOpen'
        ];
        
        let expressionInfo = '😊 Expressions: ';
        importantExpressions.forEach(expName => {
            const exp = blendshapes.find(b => b.categoryName === expName);
            if (exp) {
                expressionInfo += `${expName}(${exp.score.toFixed(2)}) `;
            }
        });
        
        console.log(expressionInfo);
    }
}

/**
 * Update attention score display
 */
function updateAttentionScore(score) {
    currentAttentionScore = score;
    attentionScores.push(score);
    
    // Keep only last 30 scores
    if (attentionScores.length > 30) {
        attentionScores.shift();
    }
    
    // Clear any warning message when face is detected
    if (main.attentionMessage) {
        main.attentionMessage.textContent = '';
        main.attentionMessage.classList.remove('warning');
    }
    
    // Update display
    if (main.attentionValue) {
        const percentage = Math.round(score * 100);
        main.attentionValue.textContent = percentage + '%';
        
        // Update progress bar color based on score
        if (main.attentionProgress) {
            main.attentionProgress.style.width = percentage + '%';
            
            if (score > 0.7) {
                main.attentionProgress.style.backgroundColor = '#10b981'; // Green
            } else if (score > 0.4) {
                main.attentionProgress.style.backgroundColor = '#f59e0b'; // Orange
            } else {
                main.attentionProgress.style.backgroundColor = '#ef4444'; // Red
            }
        }
    }
    
    // Check if user is distracted and send notification
    checkUserDistraction(score);
}

/**
 * Check if user is distracted and trigger notification
 */
function checkUserDistraction(attentionScore) {
    try {
        // Convert attention score (0-1) to percentage (0-100)
        const attentionPercent = attentionScore * 100;
        const distractionPercent = 100 - attentionPercent;
        
        // Show distraction popup if user is significantly distracted
        if (focusModeEnabled && distractionPercent > 40) {
            showDistractionPopup();
        }
        
        // Send to background for intervention decision
        chrome.runtime.sendMessage(
            {
                action: 'checkUserFocus',
                data: {
                    attentionScore: attentionPercent,
                    distractionScore: distractionPercent,
                    sleepinessScore: Math.random() * 30 // Placeholder - would integrate with actual sleepiness detection
                }
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('⚠️ Could not send focus check:', chrome.runtime.lastError.message);
                    return;
                }
                
                if (response?.intervened) {
                    console.log('🔔 Intervention triggered:', response.type, '-', response.message);
                }
            }
        );
    } catch (error) {
        console.error('❌ Error checking user distraction:', error);
    }
}

/**
 * Display "Unable to detect face" message
 */
function displayFaceNotDetected() {
    currentAttentionScore = null;
    
    // Clear attention display
    if (main.attentionValue) {
        main.attentionValue.textContent = '—';
    }
    
    // Reset progress bar
    if (main.attentionProgress) {
        main.attentionProgress.style.width = '0%';
        main.attentionProgress.style.backgroundColor = '#6b7280'; // Gray
    }
    
    // Show warning message to user
    if (main.attentionMessage) {
        main.attentionMessage.textContent = '⚠️ Unable to detect face - camera may be obstructed or face not visible';
        main.attentionMessage.classList.add('warning');
    }
    
    // Log to console
    console.log('⚠️ Unable to detect face - camera may be obstructed or face not visible');
}

/**
 * Send face landmarks to Gemini for analysis
 */
async function sendLandmarksToGemini(faceResult, attentionScore, attentionDetails) {
    try {
        // Check if enough time has passed since last Gemini analysis
        const currentTime = Date.now();
        const timeSinceLastAnalysis = currentTime - lastGeminiAnalysisTime;
        
        if (timeSinceLastAnalysis < geminiAnalysisInterval) {
            const secondsUntilNext = Math.ceil((geminiAnalysisInterval - timeSinceLastAnalysis) / 1000);
            console.log('⏳ Gemini analysis throttled. Next call in ' + secondsUntilNext + ' seconds...');
            return;
        }
        
        lastGeminiAnalysisTime = currentTime;
        
        // Check if API key is set (first check in-memory, then storage)
        let apiKey = getGeminiApiKey();
        if (!apiKey) {
            // Try to load from settings
            apiKey = await new Promise((resolve) => {
                chrome.storage.sync.get('focusguard_settings', (result) => {
                    const settings = result.focusguard_settings || {};
                    resolve(settings.geminiApiKey?.trim() || null);
                });
            });
            if (apiKey) {
                setGeminiApiKey(apiKey);
            }
        }
        
        if (!apiKey) {
            console.warn('⚠️ No Gemini API key configured for landmark analysis');
            return;
        }
        
        // Prepare landmark data for Gemini (including pose landmarks)
        const landmarkData = {
            face: {
                detected: faceResult && faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0,
                landmarks: faceResult?.faceLandmarks?.[0] || null,
                blendshapes: faceResult?.faceBlendshapes?.[0]?.categories || null,
                details: attentionDetails
            },
            pose: {
                detected: faceResult && faceResult.poseLandmarks && faceResult.poseLandmarks.length > 0,
                landmarks: faceResult?.poseLandmarks?.[0] || null,
                segmentationMask: faceResult?.segmentationMasks?.[0] || null
            }
        };
        
        console.log('📤 Sending face & pose landmarks to Gemini...');
        
        // Determine initial attention level (used as context, not final score)
        let attentionLevel = 'low';
        if (attentionScore > 0.7) {
            attentionLevel = 'high';
        } else if (attentionScore > 0.4) {
            attentionLevel = 'medium';
        }
        
        // Send to Gemini
        const geminiResponse = await analyzeLandmarks(landmarkData, attentionScore, attentionLevel);
        
        console.log('✅ Gemini Analysis:\n' + geminiResponse);
        
        // Extract Gemini's confidence/attention score (this is NOW the primary score)
        const geminiAttentionScore = extractAttentionConfidence(geminiResponse);
        lastGeminiConfidence = geminiAttentionScore;
        geminiAnalysisHistory.push(geminiAttentionScore);
        
        // Keep only last 5 Gemini analyses
        if (geminiAnalysisHistory.length > 5) {
            geminiAnalysisHistory.shift();
        }
        
        // Use GEMINI SCORE as the final attention score (100% weight)
        // MediaPipe is only used for initial context, not for final scoring
        const finalAttentionScore = geminiAttentionScore;
        
        console.log('🎯 GEMINI ATTENTION SCORE:', {
            mediaAnalysis: attentionScore.toFixed(2),
            geminiScore: geminiAttentionScore.toFixed(2),
            finalScore: finalAttentionScore.toFixed(2),
            note: 'Gemini determines 100% of final attention score'
        });
        
        // Update the display with Gemini's attention score as final score
        updateGeminiAttentionDisplay(finalAttentionScore);
        
        // Check if attention is low and trigger learning assessment
        if (finalAttentionScore < 0.4 && !currentQuiz) {
            console.log('⚠️ Low attention detected - triggering reading content assessment');
            assessReadingContent();
        }
        
        // Display Gemini analysis in a notification or dedicated area
        showGeminiInsight(geminiResponse);
        
    } catch (error) {
        if (error.isQuotaError) {
            console.warn('⚠️ Gemini quota exceeded. Pausing analysis for ' + error.retryAfter + ' seconds.');
        } else {
            console.error('❌ Error sending landmarks to Gemini:', error);
        }
    }
}

/**
 * Update display with hybrid attention score (MediaPipe + Gemini)
 */
/**
 * Update attention display with Gemini's score as primary
 */
function updateGeminiAttentionDisplay(geminiScore) {
    if (!main.attentionValue) return;
    
    const geminiPercentage = Math.round(geminiScore * 100);
    main.attentionValue.textContent = geminiPercentage + '%';
    
    // Update progress bar with Gemini score
    if (main.attentionProgress) {
        main.attentionProgress.style.width = geminiPercentage + '%';
        
        // Color coding based on Gemini's attention score
        if (geminiScore > 0.7) {
            main.attentionProgress.style.backgroundColor = '#10b981'; // Green - Focused
        } else if (geminiScore > 0.4) {
            main.attentionProgress.style.backgroundColor = '#f59e0b'; // Orange - Moderate
        } else {
            main.attentionProgress.style.backgroundColor = '#ef4444'; // Red - Distracted
        }
    }
    
    console.log('📊 Gemini Attention Score Updated: ' + geminiPercentage + '%');
}

/**
 * Display Gemini insight
 */
function showGeminiInsight(insight) {
    // Could display in a notification, log, or UI element
    // For now, just log it prominently
    console.log('💡 GEMINI INSIGHT:\n' + insight);
}

/**
 * Extract and assess reading content for distractedness
 */
async function assessReadingContent() {
    try {
        console.log('📖 Starting reading content assessment...');
        
        // Get the current active tab
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (!tab || !tab.url) {
            console.warn('⚠️ Could not access current tab');
            return;
        }
        
        console.log('📑 Active tab URL:', tab.url);
        
        // Check if it's learning content
        if (!isLearningContent(tab.url)) {
            console.log('ℹ️ URL is not recognized learning content, will attempt to extract anyway');
        }
        
        // Fetch and extract content
        const contentData = await fetchUrlContent(tab.url);
        learningContent = contentData;
        
        console.log('✅ Content extracted:', contentData.title);
        console.log('📊 Content length:', contentData.content.length, 'characters');
        
        // Get API key
        let apiKey = getGeminiApiKey();
        if (!apiKey) {
            apiKey = await new Promise((resolve) => {
                chrome.storage.sync.get('focusguard_settings', (result) => {
                    const settings = result.focusguard_settings || {};
                    resolve(settings.geminiApiKey?.trim() || null);
                });
            });
            if (apiKey) {
                setGeminiApiKey(apiKey);
            }
        }
        
        if (!apiKey) {
            console.warn('⚠️ API key not configured - cannot generate quiz');
            showNotification('API Key Required', 'Configure Gemini API key to enable learning features', 'error');
            return;
        }
        
        // Generate quiz from content
        console.log('🧠 Generating quiz from content...');
        currentQuiz = await generateQuizFromContent(contentData.content, contentData.title, apiKey);
        currentQuizIndex = 0;
        
        console.log('✅ Quiz generated with', currentQuiz.questions.length, 'questions');
        
        // Show first question
        displayQuizQuestion();
        
        // Log distraction assessment
        assessReadingDistraction();
        
    } catch (error) {
        console.error('❌ Error assessing reading content:', error);
        showNotification('Content Assessment Error', error.message, 'error');
    }
}

/**
 * Assess user's distractedness while reading
 */
function assessReadingDistraction() {
    if (!currentAttentionScore || attentionScores.length === 0) {
        readingDistractionLevel = 'Unknown';
        return;
    }
    
    // Calculate average attention score during reading
    const recentScores = attentionScores.slice(-10); // Last 10 scores
    const avgScore = recentScores.reduce((a, b) => a + b) / recentScores.length;
    
    // Determine distraction level
    if (avgScore > 0.7) {
        readingDistractionLevel = 'High';
        console.log('✅ High focus level detected during reading (avg:', avgScore.toFixed(2) + ')');
    } else if (avgScore > 0.4) {
        readingDistractionLevel = 'Medium';
        console.log('⚠️ Medium focus level during reading (avg:', avgScore.toFixed(2) + ')');
    } else {
        readingDistractionLevel = 'Low';
        console.log('❌ Low focus level detected during reading (avg:', avgScore.toFixed(2) + ')');
    }
    
    // Get recommendations based on distraction level
    const recommendations = getRecommendations(readingDistractionLevel);
    console.log('📚 Learning recommendations for', readingDistractionLevel, 'focus:', recommendations);
    
    // Show recommendations if distracted
    if (readingDistractionLevel !== 'High') {
        showLearningRecommendations(recommendations);
    }
}

/**
 * Display current quiz question
 */
function displayQuizQuestion() {
    if (!currentQuiz || currentQuizIndex >= currentQuiz.questions.length) {
        console.log('✅ Quiz completed!');
        showNotification('Quiz Completed', 'You have answered all questions', 'success');
        return;
    }
    
    const question = currentQuiz.questions[currentQuizIndex];
    console.log('❓ Question ' + (currentQuizIndex + 1) + '/' + currentQuiz.questions.length + ':', question.question);
    console.log('📋 Options:', question.options);
}

/**
 * Submit quiz answer and get feedback
 */
async function submitQuizAnswer(selectedOptionIndex) {
    if (!currentQuiz || currentQuizIndex >= currentQuiz.questions.length) {
        console.warn('⚠️ Invalid quiz state');
        return;
    }
    
    try {
        const question = currentQuiz.questions[currentQuizIndex];
        let apiKey = getGeminiApiKey();
        
        if (!apiKey) {
            console.warn('⚠️ API key required for answer validation');
            return;
        }
        
        // Validate answer with Gemini
        const feedback = await validateQuizAnswer(question, selectedOptionIndex, apiKey);
        
        console.log('📊 Answer feedback:', feedback);
        
        // Display feedback
        const feedbackText = feedback.correct ? '✅ Correct!' : '❌ Incorrect.';
        showNotification(feedbackText, feedback.feedback, feedback.correct ? 'success' : 'warning');
        
        // Move to next question
        currentQuizIndex++;
        displayQuizQuestion();
        
    } catch (error) {
        console.error('❌ Error submitting answer:', error);
        showNotification('Answer Validation Error', error.message, 'error');
    }
}

/**
 * Display learning recommendations based on reading performance
 */
function showLearningRecommendations(recommendations) {
    const message = '📚 Recommended learning materials:\n' +
        recommendations.map((rec, i) => ((i + 1) + '. ' + rec)).join('\n');
    
    console.log('💡 LEARNING RECOMMENDATIONS:\n' + message);
    showNotification('Learning Recommendations', 
        'Based on your focus level, try:\n' + recommendations.slice(0, 2).join('\n'), 
        'info');
}

/**
 * Update camera status display
 */
function updateCameraStatus(text, status) {
    if (main.cameraStatusText) {
        main.cameraStatusText.textContent = text;
    }
    
    if (main.cameraStatus) {
        // Remove all status classes
        main.cameraStatus.className = 'camera-status';
        
        // Add appropriate class based on status
        if (status === 'detecting') {
            main.cameraStatus.classList.add('loading');
        } else if (status === 'warning') {
            main.cameraStatus.classList.add('warning');
        } else if (status === 'error') {
            main.cameraStatus.classList.add('error');
        } else if (status === 'success') {
            main.cameraStatus.classList.add('success');
        }
    }
}

/**
 * Toggle camera on/off
 */
async function toggleCamera() {
    // Prevent multiple rapid clicks
    if (main.toggleCameraBtn) {
        main.toggleCameraBtn.disabled = true;
    }
    
    try {
        if (isCameraEnabled) {
            stopFaceDetection();
        } else {
            await initializeCamera();
        }
    } catch (error) {
        console.error('❌ Error toggling camera:', error);
        updateCameraStatus('Camera error', 'error');
    } finally {
        // Re-enable the button
        if (main.toggleCameraBtn) {
            main.toggleCameraBtn.disabled = false;
        }
    }
}

/**
 * Toggle stats section visibility
 */
function toggleStatsSection() {
    console.log('📊 Toggle stats section clicked');
    const statsToggleBtn = document.getElementById('statsToggleBtn');
    const statsContent = document.getElementById('statsContent');
    
    if (statsToggleBtn && statsContent) {
        statsToggleBtn.classList.toggle('collapsed');
        statsContent.classList.toggle('hidden');
        console.log('Stats section collapsed:', statsToggleBtn.classList.contains('collapsed'));
    }
}

/**
 * Stop face detection
 */
function stopFaceDetection() {
    console.log('⏹️ Stopping face detection');
    
    // Set flag to stop the detection loop
    detectionRunning = false;
    isCameraEnabled = false;
    
    // Clear UI elements
    clearFaceDetectionBox();
    updateCameraStatus('Camera disabled', 'off');
    
    // Stop all camera tracks
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
            console.log('🛑 Stopping track:', track.kind);
            track.stop();
        });
        cameraStream = null;
    }
    
    // Clear the video element
    if (main.cameraFeed) {
        main.cameraFeed.srcObject = null;
    }
    
    console.log('✅ Camera stopped and cleaned up');
}

/**
 * Enable focus mode - start a tracking session
 */
async function enableFocusMode() {
    console.log('🎯 Enabling focus mode...');
    
    try {
        // Mark focus mode as active
        focusModeEnabled = true;
        focusSessionStartTime = Date.now();
        
        // Reset session stats
        focusSessionStats = {
            duration: 0,
            averageScore: 0,
            peakScore: 0,
            lowFocusCount: 0,
            quizzesCompleted: 0,
            totalAttentionScores: [],
            distractionResponses: [],
            focusContent: null
        };
        
        // Update button visibility
        if (main.enableFocusBtn) main.enableFocusBtn.classList.add('hidden');
        if (main.disableFocusBtn) main.disableFocusBtn.classList.remove('hidden');
        
        // Show focus mode layout (sidebar with camera and timer)
        const focusModeLayout = document.getElementById('focusModeLayout');
        if (focusModeLayout) {
            focusModeLayout.classList.remove('hidden');
        }
        
        // Hide regular pomodoro and camera sections
        if (main.pomodoroSection) {
            main.pomodoroSection.classList.add('hidden');
        }
        const cameraSection = document.getElementById('cameraSection');
        if (cameraSection) {
            cameraSection.classList.add('hidden');
        }
        
        // Update timer duration from input
        if (main.timerDuration) {
            timerDurationMinutes = parseInt(main.timerDuration.value) || 25;
        }
        timerTimeLeft = timerDurationMinutes * 60;
        updateTimerDisplay();
        
        // Start the camera if not already running
        if (!isCameraEnabled) {
            await initializeCamera();
        }
        
        // Send blocker check to content script
        // This will block distracting websites during focus mode
        try {
            const activeTab = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab && activeTab[0]) {
                chrome.tabs.sendMessage(activeTab[0].id, {
                    action: 'checkBlockedSite'
                }).catch(err => {
                    console.log('⚠️ Content script not ready on this tab');
                });
            }
        } catch (error) {
            console.warn('⚠️ Could not send blocker check:', error);
        }
        
        // Start auto-updating stats every second
        if (focusSessionInterval) clearInterval(focusSessionInterval);
        focusSessionInterval = setInterval(updateFocusSessionStats, 1000);
        
        console.log('✅ Focus mode enabled. Duration:', timerDurationMinutes, 'minutes');
        showNotification('Focus Mode Started', `Timer set for ${timerDurationMinutes} minutes`, 'success');
        
    } catch (error) {
        console.error('❌ Error enabling focus mode:', error);
        focusModeEnabled = false;
        if (main.enableFocusBtn) main.enableFocusBtn.classList.remove('hidden');
        if (main.disableFocusBtn) main.disableFocusBtn.classList.add('hidden');
        showNotification('Error', 'Failed to enable focus mode', 'error');
    }
}

/**
 * Disable focus mode - end tracking session
 */
function disableFocusMode() {
    console.log('⏹️ Disabling focus mode...');
    
    // Mark focus mode as inactive
    focusModeEnabled = false;
    
    // Stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerRunning = false;
    }
    
    // Stop break timer if active
    if (breakTimerInterval) {
        clearInterval(breakTimerInterval);
        breakTimerInterval = null;
        breakTimerActive = false;
    }
    
    // Stop session stats updates
    if (focusSessionInterval) {
        clearInterval(focusSessionInterval);
        focusSessionInterval = null;
    }
    
    // Calculate final stats
    if (focusSessionStartTime) {
        focusSessionStats.duration = Math.floor((Date.now() - focusSessionStartTime) / 1000);
        if (focusSessionStats.totalAttentionScores.length > 0) {
            focusSessionStats.averageScore = 
                focusSessionStats.totalAttentionScores.reduce((a, b) => a + b, 0) / 
                focusSessionStats.totalAttentionScores.length;
            focusSessionStats.peakScore = Math.max(...focusSessionStats.totalAttentionScores);
        }
    }
    
    // Update button visibility
    if (main.enableFocusBtn) main.enableFocusBtn.classList.remove('hidden');
    if (main.disableFocusBtn) main.disableFocusBtn.classList.add('hidden');
    
    // Hide focus mode layout
    const focusModeLayout = document.getElementById('focusModeLayout');
    if (focusModeLayout) {
        focusModeLayout.classList.add('hidden');
    }
    
    // Show regular pomodoro and camera sections
    if (main.pomodoroSection) {
        main.pomodoroSection.classList.remove('hidden');
    }
    const cameraSection = document.getElementById('cameraSection');
    if (cameraSection) {
        cameraSection.classList.remove('hidden');
    }
    
    // Display final stats
    updateFocusSessionStats();
    
    console.log('✅ Focus mode disabled. Session stats:', focusSessionStats);
    showNotification('Focus Session Ended', `Duration: ${Math.floor(focusSessionStats.duration / 60)}m${focusSessionStats.duration % 60}s`, 'info');
}

/**
 * Start the Pomodoro timer countdown
 */
function startTimer() {
    if (timerRunning) return;
    
    timerRunning = true;
    console.log('⏱️ Timer started. Time left:', timerTimeLeft, 'seconds');
    
    // Hide start button, show pause button (regular mode)
    if (main.startTimerBtn) main.startTimerBtn.classList.add('hidden');
    if (main.pauseTimerBtn) main.pauseTimerBtn.classList.remove('hidden');
    
    // Hide start button, show pause button (focus mode)
    if (main.startTimerBtnFocusMode) main.startTimerBtnFocusMode.classList.add('hidden');
    if (main.pauseTimerBtnFocusMode) main.pauseTimerBtnFocusMode.classList.remove('hidden');
    
    timerInterval = setInterval(() => {
        if (timerTimeLeft > 0) {
            timerTimeLeft--;
            updateTimerDisplay();
            
            // Notify at certain milestones
            if (timerTimeLeft === 300) { // 5 minutes left
                showNotification('⏰ 5 Minutes Left', 'Wrap up your focus session', 'info');
            } else if (timerTimeLeft === 60) { // 1 minute left
                showNotification('⏰ 1 Minute Left', 'Get ready to take a break', 'warning');
            }
        } else {
            // Timer finished
            clearInterval(timerInterval);
            timerRunning = false;
            timerInterval = null;
            
            // Show start button, hide pause button (regular mode)
            if (main.startTimerBtn) main.startTimerBtn.classList.remove('hidden');
            if (main.pauseTimerBtn) main.pauseTimerBtn.classList.add('hidden');
            
            // Show start button, hide pause button (focus mode)
            if (main.startTimerBtnFocusMode) main.startTimerBtnFocusMode.classList.remove('hidden');
            if (main.pauseTimerBtnFocusMode) main.pauseTimerBtnFocusMode.classList.add('hidden');
            
            console.log('✅ Timer finished!');
            showNotification('⏰ Time\'s Up!', 'Great work! Take a break.', 'success');
            
            // Auto-disable focus mode when timer finishes
            disableFocusMode();
        }
    }, 1000);
}

/**
 * Pause the Pomodoro timer
 */
function pauseTimer() {
    if (!timerRunning) return;
    
    timerRunning = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    console.log('⏸️ Timer paused. Time left:', timerTimeLeft, 'seconds');
    
    // Show start button, hide pause button (regular mode)
    if (main.startTimerBtn) main.startTimerBtn.classList.remove('hidden');
    if (main.pauseTimerBtn) main.pauseTimerBtn.classList.add('hidden');
    
    // Show start button, hide pause button (focus mode)
    if (main.startTimerBtnFocusMode) main.startTimerBtnFocusMode.classList.remove('hidden');
    if (main.pauseTimerBtnFocusMode) main.pauseTimerBtnFocusMode.classList.add('hidden');
}

/**
 * Reset the Pomodoro timer to configured duration
 */
function resetTimer() {
    // Stop if running
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    timerRunning = false;
    
    // Reset to configured duration from either input
    let inputElement = main.timerDuration || main.timerDurationFocusMode;
    if (inputElement) {
        timerDurationMinutes = parseInt(inputElement.value) || 25;
    }
    timerTimeLeft = timerDurationMinutes * 60;
    
    // Update display
    updateTimerDisplay();
    
    // Update button visibility (regular mode)
    if (main.startTimerBtn) main.startTimerBtn.classList.remove('hidden');
    if (main.pauseTimerBtn) main.pauseTimerBtn.classList.add('hidden');
    
    // Update button visibility (focus mode)
    if (main.startTimerBtnFocusMode) main.startTimerBtnFocusMode.classList.remove('hidden');
    if (main.pauseTimerBtnFocusMode) main.pauseTimerBtnFocusMode.classList.add('hidden');
    
    console.log('🔄 Timer reset to', timerDurationMinutes, 'minutes');
}


/**
 * Start the break timer countdown
 */
function startBreakTimer() {
    breakTimerActive = true;
    breakTimeLeft = breakDurationSeconds;
    
    // Pause focus timer during break
    if (timerRunning) {
        pauseTimer();
    }
    
    if (breakTimerInterval) clearInterval(breakTimerInterval);
    
    breakTimerInterval = setInterval(() => {
        breakTimeLeft--;
        updateBreakTimerDisplay();
        
        if (breakTimeLeft <= 0) {
            completeBreakTimer();
        }
    }, 1000);
    
    updateBreakTimerDisplay();
    console.log('☕ Break timer started:', breakDurationSeconds, 'seconds');
}

/**
 * Update break timer display
 */
function updateBreakTimerDisplay() {
    const breakTimeDisplay = document.getElementById('breakTimeRemaining');
    if (breakTimeDisplay) {
        const mins = Math.floor(breakTimeLeft / 60);
        const secs = breakTimeLeft % 60;
        breakTimeDisplay.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
}

/**
 * Complete break timer - resume focus
 */
function completeBreakTimer() {
    if (breakTimerInterval) clearInterval(breakTimerInterval);
    breakTimerActive = false;
    
    console.log('✅ Break complete');
    showNotification('Break Complete', 'Ready to continue focusing?', 'success');
    
    // Reset break UI
    const breakOptions = document.getElementById('breakOptions');
    const breakCountdown = document.getElementById('breakTimerCountdown');
    
    if (breakOptions) breakOptions.classList.remove('hidden');
    if (breakCountdown) breakCountdown.classList.add('hidden');
    
    // Auto-resume timer if in focus mode
    if (focusModeEnabled && !timerRunning) {
        startTimer();
    }
}

/**
 * Get Gemini recommendations for break activity
 */
async function getBreakRecommendations(action) {
    try {
        // Get current API key
        let apiKey = getGeminiApiKey();
        if (!apiKey) {
            apiKey = await new Promise((resolve) => {
                chrome.storage.sync.get('focusguard_settings', (result) => {
                    const settings = result.focusguard_settings || {};
                    resolve(settings.geminiApiKey?.trim() || null);
                });
            });
        }
        
        if (!apiKey) {
            console.warn('⚠️ No API key for break recommendations');
            return;
        }
        
        // Prepare break prompt based on stats
        const breakActivityName = {
            'take-break': 'Full 5-minute break',
            'short-break': '2-minute quick break',
            'stretch': 'Stretch and breathing session',
            'continue-work': 'Continue working'
        }[action] || 'break';
        
        const prompt = `The user is taking a ${breakActivityName} from their focus session. 
        
Current focus session stats:
- Duration so far: ${Math.floor(focusSessionStats.duration / 60)} minutes
- Average attention score: ${focusSessionStats.totalAttentionScores.length > 0 ? 
    (focusSessionStats.totalAttentionScores.reduce((a,b) => a+b) / focusSessionStats.totalAttentionScores.length * 100).toFixed(0) : '—'}%
- Low focus incidents: ${focusSessionStats.lowFocusCount}
- Focus timer remaining: ${Math.floor(timerTimeLeft / 60)} minutes

Please suggest a specific, actionable activity they should do during this ${breakDurationSeconds / 60}-minute break to:
1. Reduce mental fatigue
2. Improve focus when they return
3. Maintain good posture/health habits

Keep the suggestion brief (1-2 sentences) and specific.`;
        
        console.log('🤖 Requesting break recommendations...');
        
        // Note: This would call analyzeLandmarks or similar Gemini function
        // For now, we'll just log what we would send
        console.log('📊 Break stats to send:', {
            duration: focusSessionStats.duration,
            avgAttention: focusSessionStats.totalAttentionScores.length > 0 ? 
                (focusSessionStats.totalAttentionScores.reduce((a,b) => a+b) / focusSessionStats.totalAttentionScores.length).toFixed(2) : 0,
            lowFocusCount: focusSessionStats.lowFocusCount,
            timerRemaining: timerTimeLeft
        });
        
    } catch (error) {
        console.error('❌ Error getting break recommendations:', error);
    }
}

/**
 * Send focus session stats to Gemini for personalized recommendations
 */
async function sendSessionStatsToGemini() {
    try {
        // Get current API key
        let apiKey = getGeminiApiKey();
        if (!apiKey) {
            apiKey = await new Promise((resolve) => {
                chrome.storage.sync.get('focusguard_settings', (result) => {
                    const settings = result.focusguard_settings || {};
                    resolve(settings.geminiApiKey?.trim() || null);
                });
            });
        }
        
        if (!apiKey) {
            console.warn('⚠️ No API key for session stats');
            return;
        }
        
        // Calculate stats percentages
        const avgAttentionPercent = focusSessionStats.totalAttentionScores.length > 0 ?
            (focusSessionStats.totalAttentionScores.reduce((a,b) => a+b) / focusSessionStats.totalAttentionScores.length * 100).toFixed(0) : 0;
        const lowFocusRate = focusSessionStats.totalAttentionScores.length > 0 ?
            ((focusSessionStats.lowFocusCount / focusSessionStats.totalAttentionScores.length) * 100).toFixed(0) : 0;
        
        // Build comprehensive stats prompt
        const statsPrompt = `Based on this focus session analysis, provide personalized recommendations:

SESSION PERFORMANCE:
- Total focus duration: ${Math.floor(focusSessionStats.duration / 60)} minutes ${focusSessionStats.duration % 60} seconds
- Average attention score: ${avgAttentionPercent}%
- Peak focus score: ${(focusSessionStats.peakScore * 100).toFixed(0)}%
- Low focus incidents: ${focusSessionStats.lowFocusCount} (${lowFocusRate}% of measurements)
- Content type: ${focusSessionStats.focusContent || 'Unknown'}
- Quizzes completed: ${focusSessionStats.quizzesCompleted}

USER PROFILE:
- Typical attention span: ${userProfile?.category || 'Not set'}
- Current time in session: ${Math.floor(timerTimeLeft / 60)} minutes remaining

Based on this data, provide:
1. Specific feedback on their focus performance (1-2 sentences)
2. ONE concrete strategy to improve their attention in future sessions
3. Whether they should take a break now (yes/no and brief reasoning)

Keep response brief and actionable.`;

        console.log('📤 Sending comprehensive stats to Gemini...');
        console.log('📊 Session stats:', {
            duration: focusSessionStats.duration,
            avgAttention: avgAttentionPercent,
            peakScore: focusSessionStats.peakScore,
            lowFocusCount: focusSessionStats.lowFocusCount,
            quizzesCompleted: focusSessionStats.quizzesCompleted
        });
        
        // Here you would call analyzeLandmarks with the stats prompt
        // The response would provide personalized recommendations
        
    } catch (error) {
        console.error('❌ Error sending session stats:', error);
    }
}

/**
 * Update timer duration from input
 */
function updateTimerDuration() {
    // Get the input from either regular or focus mode
    let inputElement = main.timerDuration;
    if (!inputElement) inputElement = main.timerDurationFocusMode;
    if (!inputElement) return;
    
    const newDuration = parseInt(inputElement.value) || 25;
    
    // Clamp to valid range
    let validDuration = newDuration;
    if (newDuration < 1) {
        validDuration = 1;
        inputElement.value = 1;
    } else if (newDuration > 120) {
        validDuration = 120;
        inputElement.value = 120;
    }
    
    timerDurationMinutes = validDuration;
    
    // Sync both input fields
    if (main.timerDuration) main.timerDuration.value = validDuration;
    if (main.timerDurationFocusMode) main.timerDurationFocusMode.value = validDuration;
    
    // Only update timer display if not running
    if (!timerRunning) {
        timerTimeLeft = timerDurationMinutes * 60;
        updateTimerDisplay();
        console.log('⏱️ Timer duration changed to:', timerDurationMinutes, 'minutes');
    }
    
    console.log('⚙️ Timer duration updated to', timerDurationMinutes, 'minutes');
}

/**
 * Update the timer display (MM:SS format)
 */
function updateTimerDisplay() {
    const minutes = Math.floor(timerTimeLeft / 60);
    const seconds = timerTimeLeft % 60;
    const displayText = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    
    // Update regular timer display
    if (main.timerDisplay) {
        main.timerDisplay.textContent = displayText;
    }
    
    // Update focus mode timer display
    if (main.timerDisplayFocusMode) {
        main.timerDisplayFocusMode.textContent = displayText;
    }
}

/**
 * Update focus session statistics every second
 */
function updateFocusSessionStats() {
    if (!focusModeEnabled || !focusSessionStartTime) return;
    
    // Calculate elapsed time
    focusSessionStats.duration = Math.floor((Date.now() - focusSessionStartTime) / 1000);
    
    // Calculate average score if we have scores
    if (focusSessionStats.totalAttentionScores.length > 0) {
        focusSessionStats.averageScore = 
            focusSessionStats.totalAttentionScores.reduce((a, b) => a + b, 0) / 
            focusSessionStats.totalAttentionScores.length;
        focusSessionStats.peakScore = Math.max(...focusSessionStats.totalAttentionScores);
        
        // Count low focus scores (below 0.4)
        focusSessionStats.lowFocusCount = focusSessionStats.totalAttentionScores.filter(s => s < 0.4).length;
    }
    
    // Update stat displays
    if (main.durationStat) {
        const mins = Math.floor(focusSessionStats.duration / 60);
        const secs = focusSessionStats.duration % 60;
        main.durationStat.textContent = 
            (mins > 0 ? mins + 'm ' : '') + secs + 's';
    }
    
    if (main.focusPercentageStat) {
        if (focusSessionStats.totalAttentionScores.length > 0) {
            const focusPercent = Math.round(focusSessionStats.averageScore * 100);
            main.focusPercentageStat.textContent = focusPercent + '%';
        }
    }
    
    if (main.avgScoreStat) {
        main.avgScoreStat.textContent = 
            (focusSessionStats.averageScore > 0 ? 
                (focusSessionStats.averageScore * 100).toFixed(1) : '0') + '%';
    }
    
    if (main.peakFocusStat) {
        main.peakFocusStat.textContent = 
            (focusSessionStats.peakScore > 0 ? 
                Math.round(focusSessionStats.peakScore * 100) : '0') + '%';
    }
    
    if (main.lowFocusStat) {
        main.lowFocusStat.textContent = focusSessionStats.lowFocusCount;
    }
    
    if (main.quizzesStat) {
        main.quizzesStat.textContent = focusSessionStats.quizzesCompleted;
    }
}

/**
 * Show distraction popup on the user's active tab
 */
function showDistractionPopup() {
    try {
        // Throttle popup frequency - only show every 30 seconds
        const now = Date.now();
        if (now - lastDistractionPopupTime < 30000) {
            return;
        }
        lastDistractionPopupTime = now;
        
        // Send message to content script on active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'SHOW_DISTRACTION_POPUP'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('⚠️ Could not show distraction popup:', chrome.runtime.lastError.message);
                    }
                });
            }
        });
    } catch (error) {
        console.error('❌ Error showing distraction popup:', error);
    }
}

/**
 * Track attention score for current focus session
 */
function trackAttentionScore(score) {
    if (!focusModeEnabled) return;
    
    focusSessionStats.totalAttentionScores.push(score);
    console.log('📊 Attention score tracked for session:', score.toFixed(2));
}

