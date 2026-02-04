import { initializeLandmarkers, switchToVideoMode, switchToImageMode, detectFace, detectPose, cleanup } from './lib/mediapipe-loader.js';
import { analyzeAttention } from './lib/attention-analyzer.js';
import { setApiKey as setGeminiApiKey, analyzeImage, getContentRecommendations } from './lib/gemini-client.js';
import { getRecommendations, getSwitchSuggestion, shouldShowSwitchSuggestion } from './lib/recommendations.js';
import { getApiKey, getSettings, getSuggestions } from './lib/storage-manager.js';
import { captureVideoFrame, canvasToBase64, fileToImage, imageToCanvas, fileToBase64, resizeImage } from './lib/image-processor.js';

let videoStream = null;
let monitoringInterval = null;
let isMonitoring = false;
let consecutiveLowCount = 0;
let previousLevel = null;
let settings = null;
let suggestions = null;

const elements = {
    apiKeyWarning: document.getElementById('apiKeyWarning'),
    settingsButton: document.getElementById('settingsButton'),
    webcamTab: document.getElementById('webcamTab'),
    uploadTab: document.getElementById('uploadTab'),
    webcamSection: document.getElementById('webcamSection'),
    uploadSection: document.getElementById('uploadSection'),
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
    contentRecommendations: document.getElementById('contentRecommendations'),
    currentPageUrl: document.getElementById('currentPageUrl'),
    contentRecommendationsList: document.getElementById('contentRecommendationsList'),
    statusMessage: document.getElementById('statusMessage')
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

    setupEventListeners();
    showStatus('Ready. Select webcam or upload an image.', 'info');
}

function setupEventListeners() {
    elements.settingsButton.addEventListener('click', openSettings);
    elements.webcamTab.addEventListener('click', switchToWebcamTab);
    elements.uploadTab.addEventListener('click', switchToUploadTab);
    elements.startWebcam.addEventListener('click', startWebcamMonitoring);
    elements.stopWebcam.addEventListener('click', stopWebcamMonitoring);
    elements.dropZone.addEventListener('click', triggerFileInput);
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleFileDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.analyzeImage.addEventListener('click', analyzeUploadedImage);
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
    elements.uploadSection.classList.remove('hidden');
    elements.webcamSection.classList.add('hidden');
    stopWebcamMonitoring();
    hideResults();
}

async function startWebcamMonitoring() {
    try {
        showStatus('Initializing camera...', 'info');

        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });

        elements.webcamVideo.srcObject = videoStream;

        showStatus('Loading detection models...', 'info');
        await initializeLandmarkers();
        await switchToVideoMode();

        elements.startWebcam.classList.add('hidden');
        elements.stopWebcam.classList.remove('hidden');

        isMonitoring = true;
        consecutiveLowCount = 0;
        previousLevel = null;

        showStatus('Monitoring active', 'success');

        runAnalysis();

        const intervalMs = (settings.analysisInterval || 3) * 1000;
        monitoringInterval = setInterval(runAnalysis, intervalMs);

    } catch (error) {
        showStatus('Camera access denied or unavailable', 'error');
        console.error(error);
    }
}

function stopWebcamMonitoring() {
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
    showStatus('Monitoring stopped', 'info');
}

async function runAnalysis() {
    if (!isMonitoring) return;

    try {
        const timestamp = performance.now();
        const faceResult = detectFace(elements.webcamVideo, timestamp);
        const poseResult = detectPose(elements.webcamVideo, timestamp);

        const analysis = analyzeAttention(faceResult, poseResult);

        updateResultsDisplay(analysis);

        if (analysis.overall.level === 'Low') {
            consecutiveLowCount++;
        } else {
            consecutiveLowCount = 0;
        }

        if (settings.enableSwitchSuggestions && shouldShowSwitchSuggestion(analysis.overall.level, previousLevel, consecutiveLowCount)) {
            showSwitchSuggestion(analysis.overall.level);
        }

        if (settings.enableGemini && await getApiKey()) {
            const canvas = captureVideoFrame(elements.webcamVideo);
            const base64 = canvasToBase64(canvas, 0.7);

            try {
                const geminiResponse = await analyzeImage(base64, analysis.overall.score, analysis.overall.level);
                showGeminiAnalysis(geminiResponse);
                
                await showContentRecommendations(analysis.overall.score, analysis.overall.level);
            } catch (geminiError) {
                console.error('Gemini analysis failed:', geminiError);
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
            const base64 = canvasToBase64(resizedCanvas, 0.8);

            try {
                const geminiResponse = await analyzeImage(base64, analysis.overall.score, analysis.overall.level);
                showGeminiAnalysis(geminiResponse);
                
                await showContentRecommendations(analysis.overall.score, analysis.overall.level);
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

async function showContentRecommendations(attentionScore, attentionLevel) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tabs || tabs.length === 0) {
            elements.contentRecommendations.classList.add('hidden');
            return;
        }
        
        const currentUrl = tabs[0].url;
        
        if (!currentUrl || currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://')) {
            elements.contentRecommendations.classList.add('hidden');
            return;
        }
        
        elements.currentPageUrl.textContent = currentUrl;
        elements.contentRecommendations.classList.remove('hidden');
        elements.contentRecommendationsList.innerHTML = '<li class="loading-text">Loading recommendations...</li>';
        
        const recommendations = await getContentRecommendations(currentUrl, attentionScore, attentionLevel);
        
        const lines = recommendations.split('\n').filter(function(line) {
            return line.trim().length > 0;
        });
        
        elements.contentRecommendationsList.innerHTML = '';
        lines.forEach(function(line) {
            const li = document.createElement('li');
            li.textContent = line.trim();
            elements.contentRecommendationsList.appendChild(li);
        });
        
    } catch (error) {
        console.error('Content recommendations failed:', error);
        elements.contentRecommendations.classList.add('hidden');
    }
}

function hideResults() {
    elements.resultsSection.classList.add('hidden');
    elements.geminiAnalysis.classList.add('hidden');
    elements.switchRecommendation.classList.add('hidden');
    elements.contentRecommendations.classList.add('hidden');
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

initialize();
