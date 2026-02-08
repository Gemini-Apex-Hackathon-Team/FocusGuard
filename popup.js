import { initializeLandmarkers, switchToVideoMode, switchToImageMode, detectFace, detectPose, cleanup } from './lib/mediapipe-loader.js';
import { analyzeAttention } from './lib/attention-analyzer.js';
import { setApiKey as setGeminiApiKey, analyzeLandmarks, analyzeImage, isQuotaExceeded, getRemainingCooldown } from './lib/gemini-client.js';
import { getRecommendations, getSwitchSuggestion, shouldShowSwitchSuggestion } from './lib/recommendations.js';
import { getApiKey, getSettings, getSuggestions } from './lib/storage-manager.js';
import { captureVideoFrame, canvasToBase64, fileToImage, imageToCanvas, fileToBase64, resizeImage } from './lib/image-processor.js';
import { generateQuizFromContent, validateQuizAnswer } from './lib/quiz-generator.js';
import { hasCompletedOnboarding, showOnboardingModal, getUserAttentionProfile, getAttentionThresholds } from './lib/onboarding.js';
import { initializeBlocker, isBlockedSite, showBlockerOverlay } from './lib/website-blocker.js';
import { detectContentTypeFromUrl } from './lib/content-detector.js';
import { getBreakRecommendation, getGeminiBreakSuggestion, getBreakById } from './lib/break-recommender.js';
import { showBreakScreen, showFeelingCheckIn } from './lib/break-screen.js';

let videoStream = null;
let monitoringInterval = null;
let isMonitoring = false;
let consecutiveLowCount = 0;
let previousLevel = null;
let settings = null;
let suggestions = null;
let lastGeminiCallTime = 0;
let geminiCallInterval = 60000; // Increased to 60 seconds to respect free tier limits (20 req/min max)

// Learning session variables
let activeSession = null;
let sessionStartTime = null;
let currentQuiz = null;
let sessionTimer = null;

const elements = {
    apiKeyWarning: document.getElementById('apiKeyWarning'),
    settingsButton: document.getElementById('settingsButton'),
    webcamTab: document.getElementById('webcamTab'),
    uploadTab: document.getElementById('uploadTab'),
    learningTab: document.getElementById('learningTab'),
    webcamSection: document.getElementById('webcamSection'),
    uploadSection: document.getElementById('uploadSection'),
    learningSection: document.getElementById('learningSection'),
    webcamVideo: document.getElementById('webcamVideo'),
    startWebcam: document.getElementById('startWebcam'),
    stopWebcam: document.getElementById('stopWebcam'),
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    uploadedImage: document.getElementById('uploadedImage'),
    analyzeImage: document.getElementById('analyzeImage'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    resultsSection: document.getElementById('resultsSection'),
    scoreValue: document.getElementById('scoreValue'),
    scoreBarFill: document.getElementById('scoreBarFill'),
    levelValue: document.getElementById('levelValue'),
    detailsList: document.getElementById('detailsList'),
    geminiAnalysis: document.getElementById('geminiAnalysis'),
    geminiText: document.getElementById('geminiText'),
    switchRecommendation: document.getElementById('switchRecommendation'),
    switchContent: document.getElementById('switchContent'),
    recommendationsList: document.getElementById('recommendationsList'),
    statusMessage: document.getElementById('statusMessage'),
    // Learning session elements
    learningUrl: document.getElementById('learningUrl'),
    startLearningSession: document.getElementById('startLearningSession'),
    learningSessionActive: document.getElementById('learningSessionActive'),
    endLearningSession: document.getElementById('endLearningSession'),
    sessionFocus: document.getElementById('sessionFocus'),
    sessionTime: document.getElementById('sessionTime'),
    sessionDistractions: document.getElementById('sessionDistractions'),
    sessionProgressBar: document.getElementById('sessionProgressBar'),
    sessionTitle: document.getElementById('sessionTitle'),
    learningLoading: document.getElementById('learningLoading'),
    // Quiz modal elements
    quizModal: document.getElementById('quizModal'),
    questionText: document.getElementById('questionText'),
    optionsDisplay: document.getElementById('optionsDisplay'),
    submitAnswerButton: document.getElementById('submitAnswerButton'),
    feedbackDisplay: document.getElementById('feedbackDisplay'),
    feedbackContent: document.getElementById('feedbackContent'),
    continueLearningButton: document.getElementById('continueLearningButton')
};

async function initialize() {
    settings = await getSettings();
    suggestions = await getSuggestions();

    const apiKey = await getApiKey();
    if (apiKey) {
        setGeminiApiKey(apiKey);
        elements.apiKeyWarning.classList.add('hidden');
    } else {
        elements.apiKeyWarning.classList.remove('hidden');
    }

    // Check if onboarding completed
    const onboardingDone = await hasCompletedOnboarding();
    if (!onboardingDone) {
        showOnboardingModal(() => {
            setupEventListeners();
            showStatus('Onboarding complete! Let\'s get started!', 'success');
        });
    } else {
        setupEventListeners();
        showStatus('Ready. Select webcam or upload an image.', 'info');
    }
    
    // Initialize blocker
    await initializeBlocker();
}

function setupEventListeners() {
    elements.settingsButton.addEventListener('click', openSettings);
    elements.webcamTab.addEventListener('click', switchToWebcamTab);
    elements.uploadTab.addEventListener('click', switchToUploadTab);
    elements.learningTab.addEventListener('click', switchToLearningTab);
    elements.startWebcam.addEventListener('click', startWebcamMonitoring);
    elements.stopWebcam.addEventListener('click', stopWebcamMonitoring);
    elements.dropZone.addEventListener('click', triggerFileInput);
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleFileDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.analyzeImage.addEventListener('click', analyzeUploadedImage);
    // Learning session listeners
    elements.startLearningSession.addEventListener('click', initiateLearningSession);
    elements.endLearningSession.addEventListener('click', endLearningSession);
    elements.submitAnswerButton.addEventListener('click', submitQuizAnswer);
    elements.continueLearningButton.addEventListener('click', continueLearningSession);
}

function openSettings() {
    chrome.tabs.create({ url: 'settings.html' });
}

function switchToWebcamTab() {
    elements.webcamTab.classList.add('active');
    elements.uploadTab.classList.remove('active');
    elements.webcamSection.classList.remove('hidden');
    elements.uploadSection.classList.add('hidden');
    hideResults();
}

function switchToUploadTab() {
    elements.uploadTab.classList.add('active');
    elements.webcamTab.classList.remove('active');
    elements.learningTab.classList.remove('active');
    elements.uploadSection.classList.remove('hidden');
    elements.webcamSection.classList.add('hidden');
    elements.learningSection.classList.add('hidden');
    stopWebcamMonitoring();
    hideResults();
}

function switchToLearningTab() {
    elements.learningTab.classList.add('active');
    elements.webcamTab.classList.remove('active');
    elements.uploadTab.classList.remove('active');
    elements.learningSection.classList.remove('hidden');
    elements.webcamSection.classList.add('hidden');
    elements.uploadSection.classList.add('hidden');
    stopWebcamMonitoring();
    hideResults();
    
    // Check if article is currently being read
    checkForAutoDetectedArticle();
}

async function startWebcamMonitoring() {
    try {

        showStatus('Initializing camera...', 'info');
        console.log('🎥 Starting webcam monitoring...');

        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });
        console.log('✓ Webcam access granted');

        elements.webcamVideo.srcObject = videoStream;

        showStatus('Loading detection models...', 'info');
        console.log('📦 Loading MediaPipe models...');
        await initializeLandmarkers();
        await switchToVideoMode();
        console.log('✓ Models loaded and switched to VIDEO mode');

        elements.startWebcam.classList.add('hidden');
        elements.stopWebcam.classList.remove('hidden');

        isMonitoring = true;
        consecutiveLowCount = 0;
        previousLevel = null;

        showStatus('Monitoring active', 'success');
        console.log('✅ Webcam monitoring started');

        runAnalysis();

        const intervalMs = (settings.analysisInterval || 3) * 1000;
        monitoringInterval = setInterval(runAnalysis, intervalMs);
        console.log('⏱️ Analysis interval set to ' + (settings.analysisInterval || 3) + ' seconds');

    } catch (error) {
        showStatus('Camera access denied or unavailable', 'error');
        console.error('❌ Webcam error:', error);
    }
}

function stopWebcamMonitoring() {
    console.log('🛑 Stopping webcam monitoring...');
    isMonitoring = false;

    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }

    if (videoStream) {
        videoStream.getTracks().forEach(function(track) { track.stop(); });
        videoStream = null;
    }

    elements.webcamVideo.srcObject = null;
    elements.startWebcam.classList.remove('hidden');
    elements.stopWebcam.classList.add('hidden');

    cleanup();
    console.log('✓ Webcam stopped and models cleaned up');
    showStatus('Monitoring stopped', 'info');
}

async function runAnalysis() {
    if (!isMonitoring) return;

    try {
        const timestamp = performance.now();
        const faceResult = detectFace(elements.webcamVideo, timestamp);
        const poseResult = detectPose(elements.webcamVideo, timestamp);

        const analysis = analyzeAttention(faceResult, poseResult);
        
        // Update active session focus score
        if (activeSession) {
            activeSession.focusScore = analysis.overall.score;
            activeSession.duration = Math.floor((Date.now() - sessionStartTime) / 1000);
            
            // Get user's attention profile for thresholds
            const userProfile = await getUserAttentionProfile();
            const contentType = activeSession.contentType || 'article';
            const thresholds = getAttentionThresholds(userProfile, contentType);
            
            // Check if should trigger quiz interrupt based on personalized threshold
            if (analysis.overall.score < thresholds.low_threshold) {
                consecutiveLowCount++;
            } else {
                consecutiveLowCount = 0;
            }
            
            // Show quiz modal if attention drops significantly
            if (activeSession && consecutiveLowCount >= 2 && currentQuiz && !elements.quizModal.classList.contains('hidden')) {
                showQuizModal(currentQuiz.questions[activeSession.quizzesTaken], activeSession.quizzesTaken);
            }
        }

        updateResultsDisplay(analysis);

        if (analysis.overall.level === 'Low') {
            if (!activeSession) consecutiveLowCount++;
        } else {
            consecutiveLowCount = 0;
        }

        if (settings.enableSwitchSuggestions && shouldShowSwitchSuggestion(analysis.overall.level, previousLevel, consecutiveLowCount)) {
            showSwitchSuggestion(analysis.overall.level);
        }

        if (settings.enableGemini && await getApiKey()) {
            // Check if quota cooldown is active
            if (isQuotaExceeded()) {
                const remainingSeconds = Math.ceil(getRemainingCooldown() / 1000);
                console.warn('⏳ Gemini quota cooldown active. Next attempt in ' + remainingSeconds + ' seconds...');
            } else {
                const currentTime = Date.now();
                const timeSinceLastCall = currentTime - lastGeminiCallTime;

                // Only call Gemini if enough time has passed (throttle to prevent quota issues)
                if (timeSinceLastCall >= geminiCallInterval) {
                    const landmarkData = {
                        face: {
                            detected: analysis.face.detected,
                            score: analysis.face.score,
                            landmarks: faceResult && faceResult.faceLandmarks ? faceResult.faceLandmarks[0] : null,
                            blendshapes: faceResult && faceResult.faceBlendshapes ? faceResult.faceBlendshapes[0] : null,
                            details: analysis.face.details
                        },
                        pose: {
                            detected: analysis.pose.detected,
                            score: analysis.pose.score,
                            landmarks: poseResult && poseResult.landmarks ? poseResult.landmarks[0] : null,
                            details: analysis.pose.details
                        }
                    };

                    try {
                        console.log('📤 Sending landmarks to Gemini (throttled, every ' + (geminiCallInterval / 1000) + ' seconds)...');
                        lastGeminiCallTime = currentTime;
                        const geminiResponse = await analyzeLandmarks(landmarkData, analysis.overall.score, analysis.overall.level);
                        showGeminiAnalysis(geminiResponse);
                    } catch (geminiError) {
                        if (geminiError.isQuotaError) {
                            console.error('⚠️ Quota exceeded. Gemini will pause for 60 seconds automatically.', geminiError.message);
                        } else {
                            console.error('Gemini analysis failed:', geminiError);
                        }
                    }
                } else {
                    const secondsUntilNext = Math.ceil((geminiCallInterval - timeSinceLastCall) / 1000);
                    console.log('⏳ Gemini call throttled. Next call in ' + secondsUntilNext + ' seconds...');
                }
            }
        }

        previousLevel = analysis.overall.level;

    } catch (error) {
        console.error('Analysis error:', error);
    }
}

function triggerFileInput() {
    elements.fileInput.click();
}

function handleDragOver(event) {
    event.preventDefault();
    elements.dropZone.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    elements.dropZone.classList.remove('dragover');
}

async function handleFileDrop(event) {
    event.preventDefault();
    elements.dropZone.classList.remove('dragover');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        await loadImageFile(files[0]);
    }
}

async function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        await loadImageFile(files[0]);
    }
}

async function loadImageFile(file) {
    if (!file.type.startsWith('image/')) {
        showStatus('Please select an image file', 'error');
        return;
    }

    try {
        const img = await fileToImage(file);
        elements.uploadedImage.src = img.src;
        elements.uploadedImage.classList.remove('hidden');
        elements.dropZone.classList.add('hidden');
        elements.analyzeImage.classList.remove('hidden');
        showStatus('Image loaded. Click Analyze to continue.', 'info');
    } catch (error) {
        showStatus('Failed to load image', 'error');
    }
}

async function analyzeUploadedImage() {
    try {
        showLoading(true);
        showStatus('Analyzing image...', 'info');

        await initializeLandmarkers();
        await switchToImageMode();

        const resizedCanvas = resizeImage(elements.uploadedImage, 640, 480);

        const faceResult = detectFace(resizedCanvas);
        const poseResult = detectPose(resizedCanvas);

        const analysis = analyzeAttention(faceResult, poseResult);

        updateResultsDisplay(analysis);

        if (settings.enableSwitchSuggestions && analysis.overall.level !== 'High') {
            showSwitchSuggestion(analysis.overall.level);
        }

        if (settings.enableGemini && await getApiKey()) {
            const landmarkData = {
                face: {
                    detected: analysis.face.detected,
                    score: analysis.face.score,
                    landmarks: faceResult && faceResult.faceLandmarks ? faceResult.faceLandmarks[0] : null,
                    blendshapes: faceResult && faceResult.faceBlendshapes ? faceResult.faceBlendshapes[0] : null,
                    details: analysis.face.details
                },
                pose: {
                    detected: analysis.pose.detected,
                    score: analysis.pose.score,
                    landmarks: poseResult && poseResult.landmarks ? poseResult.landmarks[0] : null,
                    details: analysis.pose.details
                }
            };

            try {
                console.log('📸 Analyzing uploaded image landmarks with Gemini...');
                const geminiResponse = await analyzeLandmarks(landmarkData, analysis.overall.score, analysis.overall.level);
                showGeminiAnalysis(geminiResponse);
            } catch (geminiError) {
                console.error('Gemini analysis failed:', geminiError);
            }
        }

        showLoading(false);
        showStatus('Analysis complete', 'success');

        cleanup();

    } catch (error) {
        showLoading(false);
        showStatus('Analysis failed: ' + error.message, 'error');
    }
}

function updateResultsDisplay(analysis) {
    elements.resultsSection.classList.remove('hidden');

    const scorePercent = Math.round(analysis.overall.score * 100);
    elements.scoreValue.textContent = scorePercent;
    elements.scoreValue.className = 'score-value ' + analysis.overall.level.toLowerCase();

    elements.scoreBarFill.style.width = scorePercent + '%';
    elements.scoreBarFill.className = 'score-bar-fill ' + analysis.overall.level.toLowerCase();

    elements.levelValue.textContent = analysis.overall.level;
    elements.levelValue.className = 'level-value ' + analysis.overall.level.toLowerCase();

    updateDetailsList(analysis);
    updateRecommendationsList(analysis.overall.level);
}

function updateDetailsList(analysis) {
    elements.detailsList.innerHTML = '';

    const details = [
        { label: 'Face Detected', value: analysis.face.detected },
        { label: 'Head Facing Forward', value: analysis.face.details.headForward },
        { label: 'Head Level', value: analysis.face.details.headLevel },
        { label: 'Eyes Open', value: analysis.face.details.eyesOpen },
        { label: 'Eyes Centered', value: analysis.face.details.eyesCentered },
        { label: 'Pose Detected', value: analysis.pose.detected },
        { label: 'Shoulders Level', value: analysis.pose.details.shouldersLevel },
        { label: 'Body Centered', value: analysis.pose.details.bodyCentered }
    ];

    details.forEach(function(detail) {
        if (detail.value === null || detail.value === undefined) return;

        const li = document.createElement('li');
        li.innerHTML = detail.label + '<span class="detail-status ' + (detail.value ? 'positive' : 'negative') + '">' + (detail.value ? 'Yes' : 'No') + '</span>';
        elements.detailsList.appendChild(li);
    });
}

function updateRecommendationsList(level) {
    elements.recommendationsList.innerHTML = '';

    const recommendations = getRecommendations(level);
    recommendations.forEach(function(rec) {
        const li = document.createElement('li');
        li.textContent = rec;
        elements.recommendationsList.appendChild(li);
    });
}

function showGeminiAnalysis(text) {
    elements.geminiAnalysis.classList.remove('hidden');
    elements.geminiText.textContent = text;
}

function showSwitchSuggestion(level) {
    const suggestion = getSwitchSuggestion(level, suggestions);

    if (!suggestion) {
        elements.switchRecommendation.classList.add('hidden');
        return;
    }

    elements.switchRecommendation.classList.remove('hidden');

    let html = '<div class="switch-title">' + suggestion.title + '</div>';
    html += '<div class="switch-description">' + suggestion.description + '</div>';

    if (suggestion.url) {
        html += '<a href="' + suggestion.url + '" target="_blank" class="switch-link">Open</a>';
    }

    elements.switchContent.innerHTML = html;
}

function hideResults() {
    elements.resultsSection.classList.add('hidden');
    elements.geminiAnalysis.classList.add('hidden');
    elements.switchRecommendation.classList.add('hidden');
}

function showLoading(show) {
    if (show) {
        elements.loadingIndicator.classList.remove('hidden');
    } else {
        elements.loadingIndicator.classList.add('hidden');
    }
}

function showStatus(message, type) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = 'status-message ' + type;
}

// ======================== LEARNING SESSION FUNCTIONS ========================

async function initiateLearningSession() {
    const url = elements.learningUrl.value.trim();

    if (!url) {
        showStatus('Please enter a URL', 'error');
        return;
    }

    // Basic URL validation
    try {
        new URL(url);
    } catch (e) {
        showStatus('Please enter a valid URL', 'error');
        return;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
        showStatus('API key required for learning sessions. Go to Settings.', 'error');
        return;
    }

    try {
        elements.learningLoading.classList.remove('hidden');
        showStatus('Loading content from page...', 'info');
        console.log('📚 Starting learning session for URL: ' + url);

        // Step 1: Get content from the active tab using content script
        console.log('📄 Requesting content from page...');
        const contentData = await getPageContent();
        
        if (!contentData || !contentData.content) {
            throw new Error('Could not extract page content. Make sure the page with the URL is open in a browser tab.');
        }

        console.log('✅ Content extracted: ' + contentData.title);
        console.log('📊 Content type: ' + contentData.contentType);
        console.log('📝 Content length: ' + contentData.content.length + ' characters');

        // Step 2: Generate quiz using Gemini
        showStatus('Generating quiz from content...', 'info');
        console.log('🧠 Generating quiz with Gemini...');
        const quiz = await generateQuizFromContent(contentData.content, contentData.title, apiKey);

        if (!quiz || !quiz.questions || quiz.questions.length === 0) {
            throw new Error('Failed to generate quiz');
        }

        console.log('✅ Quiz generated with ' + quiz.questions.length + ' questions');

        // Step 3: Initialize session
        const contentType = contentData.contentType;
        activeSession = {
            url: url,
            title: contentData.title,
            contentType: contentType,
            contentLength: contentData.content.length,
            startTime: Date.now(),
            focusScore: 1.0,
            attentionDips: 0,
            quizzesTaken: 0,
            quizzesCorrect: 0,
            duration: 0,
            breakShown: false
        };

        currentQuiz = quiz;
        sessionStartTime = Date.now();

        // Update UI
        elements.learningUrl.value = '';
        elements.learningSessionActive.classList.remove('hidden');
        elements.sessionTitle.textContent = contentData.title;
        elements.learningLoading.classList.add('hidden');
        showStatus('Learning session started!', 'success');
        console.log('✅ Learning session initialized with quiz');

        // Start session timer
        updateSessionDisplay();
        sessionTimer = setInterval(updateSessionDisplay, 1000);

        // Start analyzing attention for this session
        startSessionMonitoring();

    } catch (error) {
        elements.learningLoading.classList.add('hidden');
        showStatus('Failed to start session: ' + error.message, 'error');
        console.error('❌ Learning session error:', error);
    }
}

// Helper function to get page content from active tab
async function getPageContent() {
    return new Promise((resolve, reject) => {
        // Get the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) {
                reject(new Error('No active tab found. Please make sure you have a tab open with the content you want to study.'));
                return;
            }
            
            const activeTab = tabs[0];
            console.log('📍 Active tab URL: ' + activeTab.url);
            
            // Send message to content script
            chrome.tabs.sendMessage(
                activeTab.id,
                { action: 'getPageContent' },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Content script error:', chrome.runtime.lastError.message);
                        reject(new Error('Content script unavailable. Try reloading the page you want to study and try again.'));
                    } else if (response && response.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response?.error || 'Failed to get page content'));
                    }
                }
            );
        });
    });
}

// Auto-detection: Check if user is reading an article
async function checkForAutoDetectedArticle() {
    console.log('🔍 Checking for auto-detected articles...');
    
    // Ask background service worker if an article was detected
    chrome.runtime.sendMessage(
        { action: 'getCurrentContext' },
        (response) => {
            if (response && response.session) {
                const session = response.session;
                console.log('✅ Article detected:', session.title);
                
                // Show article detection banner
                showArticleDetectionBanner(session);
                
                // Hide manual URL input
                elements.learningUrl.style.display = 'none';
                elements.startLearningSession.style.display = 'none';
                
            } else {
                console.log('ℹ️ No article detected. User can paste URL manually.');
                
                // Show manual URL input
                elements.learningUrl.style.display = 'block';
                elements.startLearningSession.style.display = 'block';
                elements.statusMessage.innerHTML = '<p>Open an article page to auto-start, or paste a URL below</p>';
            }
        }
    );
}

function showArticleDetectionBanner(session) {
    const banner = document.createElement('div');
    banner.className = 'article-detected-banner';
    banner.innerHTML = `
        <div class="banner-content">
            <h3>📖 Article Detected!</h3>
            <p><strong>${session.title}</strong></p>
            <p>FocusGuard detected you're reading an article. Start monitoring to get real-time attention feedback.</p>
            <div class="banner-actions">
                <button id="startAutoMonitoringBtn" class="btn btn-primary">Start Monitoring</button>
                <button id="useManualUrlBtn" class="btn btn-secondary">Use Manual URL Instead</button>
            </div>
        </div>
    `;
    
    elements.resultsDiv = elements.resultsDiv || document.getElementById('resultsDiv');
    elements.resultsDiv.innerHTML = '';
    elements.resultsDiv.appendChild(banner);
    
    document.getElementById('startAutoMonitoringBtn').addEventListener('click', () => {
        startAutoMonitoring(session);
    });
    
    document.getElementById('useManualUrlBtn').addEventListener('click', () => {
        elements.learningUrl.style.display = 'block';
        elements.startLearningSession.style.display = 'block';
        banner.remove();
    });
}

async function startAutoMonitoring(session) {
    console.log('👁️ Starting auto-monitoring for detected article');
    
    try {
        // Tell background to start monitoring
        chrome.runtime.sendMessage(
            { action: 'startAutoMonitoring' },
            (response) => {
                if (response && response.success) {
                    console.log('✅ Auto-monitoring started');
                    
                    // Initialize session in popup
                    activeSession = response.session;
                    sessionStartTime = Date.now();
                    
                    // Show monitoring interface
                    elements.learningSessionActive.classList.remove('hidden');
                    elements.sessionTitle.textContent = session.title;
                    
                    showStatus('Auto-monitoring started! Focus on reading and we\'ll watch for distractions.', 'success');
                    
                    // Start updating session display
                    updateSessionDisplay();
                    sessionTimer = setInterval(updateSessionDisplay, 1000);
                    
                    // Start webcam monitoring
                    startWebcamMonitoring();
                } else {
                    showStatus('Failed to start auto-monitoring', 'error');
                }
            }
        );
    } catch (error) {
        console.error('❌ Auto-monitoring error:', error);
        showStatus('Error starting auto-monitoring', 'error');
    }
}

function startSessionMonitoring() {
    // If already monitoring webcam, this will track attention during the session
    if (!isMonitoring) {
        // Optionally auto-start webcam monitoring
        // For now, user can manually start it on webcam tab
    }
}

function updateSessionDisplay() {
    if (!activeSession) return;

    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    elements.sessionTime.textContent = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    elements.sessionFocus.textContent = Math.round(activeSession.focusScore * 100) + '%';
    elements.sessionDistractions.textContent = activeSession.attentionDips;

    // Update progress based on quiz completion
    const progress = activeSession.quizzesTaken > 0 ? 
        Math.min(100, (activeSession.quizzesCorrect / activeSession.quizzesTaken) * 100) : 0;
    elements.sessionProgressBar.style.width = progress + '%';
    
    // Check if break is needed
    const userProfile = getUserAttentionProfile().then(profile => {
        const minutesElapsed = Math.floor(elapsed / 60);
        const breakNeeded = getBreakRecommendation(minutesElapsed, activeSession.attentionDips, profile);
        
        if (breakNeeded.needsBreak && !activeSession.breakShown) {
            activeSession.breakShown = true;
            console.log('☕ Break recommended: ' + breakNeeded.reason);
            showBreakRecommendation(breakNeeded, profile);
        }
    });
}

async function showBreakRecommendation(breakData, userProfile) {
    const apiKey = await getApiKey();
    const contentType = activeSession.contentType || 'article';
    
    // Get Gemini suggestion if available
    const breakSuggestion = apiKey ? 
        await getGeminiBreakSuggestion({
            duration: Math.floor((Date.now() - sessionStartTime) / 1000 / 60),
            attentionDrops: activeSession.attentionDips,
            focusScore: activeSession.focusScore
        }, contentType, apiKey) :
        { selectedBreak: getBreakById('walk'), explanation: 'Time for a break!' };
    
    // Show break screen
    showBreakScreen(breakSuggestion.selectedBreak, () => {
        console.log('✅ Break completed, resuming session');
        showFeelingCheckIn(activeSession);
    });
}

function showQuizModal(question, questionIndex) {
    console.log('📋 Showing quiz modal for question ' + (questionIndex + 1) + ' of ' + currentQuiz.questions.length);
    
    elements.questionText.textContent = question.question;
    elements.optionsDisplay.innerHTML = '';
    
    question.options.forEach(function(option, index) {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'answer';
        radio.value = index;
        radio.id = 'option-' + index;
        
        const label = document.createElement('label');
        label.htmlFor = 'option-' + index;
        label.textContent = option;
        
        optionDiv.appendChild(radio);
        optionDiv.appendChild(label);
        elements.optionsDisplay.appendChild(optionDiv);
        
        radio.addEventListener('change', function() {
            elements.submitAnswerButton.disabled = false;
        });
    });
    
    elements.submitAnswerButton.disabled = true;
    elements.feedbackDisplay.classList.add('hidden');
    elements.quizModal.classList.remove('hidden');
}

async function submitQuizAnswer() {
    const selectedRadio = document.querySelector('input[name="answer"]:checked');
    if (!selectedRadio) return;

    const answerIndex = parseInt(selectedRadio.value);
    const currentQuestion = currentQuiz.questions[0]; // Show first unanswered question

    try {
        elements.submitAnswerButton.disabled = true;
        const validation = await validateQuizAnswer(currentQuestion, answerIndex, await getApiKey());
        
        activeSession.quizzesTaken++;
        if (validation.correct) {
            activeSession.quizzesCorrect++;
        }

        // Show feedback
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'feedback-content ' + (validation.correct ? 'correct' : 'incorrect');
        
        let html = '<strong>' + (validation.correct ? '✓ Correct!' : '✗ Incorrect') + '</strong>';
        html += '<p>' + validation.feedback + '</p>';
        html += '<div class="explanation"><strong>Correct Answer:</strong> ' + validation.correctAnswer + '</div>';
        
        feedbackDiv.innerHTML = html;
        elements.feedbackContent.innerHTML = html;
        elements.feedbackDisplay.classList.remove('hidden');

        updateSessionDisplay();

    } catch (error) {
        console.error('Answer validation failed:', error);
        elements.feedbackContent.textContent = 'Error validating answer: ' + error.message;
        elements.feedbackDisplay.classList.remove('hidden');
    }
}

function continueLearningSession() {
    // Remove the answered question and show next one if available
    if (currentQuiz && currentQuiz.questions.length > 1) {
        currentQuiz.questions.shift();
        showQuizModal(currentQuiz.questions[0], 0);
    } else {
        // All questions answered
        elements.quizModal.classList.add('hidden');
        showStatus('Quiz completed! Great job focusing!', 'success');
    }
}

function endLearningSession() {
    console.log('🏁 Ending learning session');
    
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const focusPercentage = Math.round(activeSession.focusScore * 100);
    const accuracy = activeSession.quizzesTaken > 0 ? 
        Math.round((activeSession.quizzesCorrect / activeSession.quizzesTaken) * 100) : 0;

    showStatus('Session ended. Focus: ' + focusPercentage + '%, Quiz Accuracy: ' + accuracy + '%', 'success');

    activeSession = null;
    currentQuiz = null;
    sessionStartTime = null;
    elements.learningSessionActive.classList.add('hidden');
    elements.quizModal.classList.add('hidden');

    console.log('✅ Session ended and cleaned up');
}

initialize();

