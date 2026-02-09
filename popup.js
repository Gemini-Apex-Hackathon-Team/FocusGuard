// FYX Popup JavaScript

let attentionScore = 100;
let sessionActive = false;
let sessionTimer = null;
let sessionStartTime = null;
let sessionDuration = 25 * 60; // 25 minutes in seconds

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserGreeting();
  await loadAttentionScore();
  await loadStatistics();
  await loadSettings();
  await loadLatestInsight();
  await loadCameraRuntime();
  setupEventListeners();
  updateScoreDisplay();
});

// Load user name for greeting
async function loadUserGreeting() {
  const data = await chrome.storage.local.get(['userName']);
  const greetingEl = document.getElementById('greeting');
  if (data.userName) {
    const hour = new Date().getHours();
    let timeGreeting = 'Hey';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';
    greetingEl.textContent = `${timeGreeting}, ${data.userName}!`;
  }
}

// Load latest Gemini insight
async function loadLatestInsight() {
  const data = await chrome.storage.local.get(['geminiInsights']);
  const insightCard = document.getElementById('insight-card');
  const insightText = document.getElementById('insight-text');

  if (data.geminiInsights && data.geminiInsights.length > 0) {
    const latest = data.geminiInsights[data.geminiInsights.length - 1];
    insightText.textContent = latest.insight || latest;
    insightCard.style.display = 'block';
  }
}

async function loadCameraRuntime() {
  const data = await chrome.storage.local.get(['cameraStatus', 'cameraHeartbeat', 'cameraSignal']);

  const statusEl = document.getElementById('cam-status');
  const detectorEl = document.getElementById('cam-detector');
  const faceEl = document.getElementById('cam-face');
  const beatEl = document.getElementById('cam-beat');

  if (!statusEl || !detectorEl || !faceEl || !beatEl) return;

  statusEl.className = 'fyx-camera-value';
  detectorEl.className = 'fyx-camera-value';
  faceEl.className = 'fyx-camera-value';
  beatEl.className = 'fyx-camera-value';

  const status = data.cameraStatus || {};
  const heartbeat = data.cameraHeartbeat || {};
  const signal = data.cameraSignal || {};

  const lastBeatAge = heartbeat.ts ? Date.now() - heartbeat.ts : null;
  const isLive = typeof lastBeatAge === 'number' && lastBeatAge < 4000;
  const isStale = typeof lastBeatAge === 'number' && lastBeatAge >= 4000 && lastBeatAge < 12000;

  if (status.ok === false) {
    statusEl.textContent = 'Error';
    statusEl.classList.add('bad');
  } else if (isLive) {
    statusEl.textContent = 'Live';
    statusEl.classList.add('ok');
  } else if (isStale) {
    statusEl.textContent = 'Stale';
    statusEl.classList.add('warn');
  } else {
    statusEl.textContent = 'Offline';
    statusEl.classList.add('bad');
  }

  detectorEl.textContent = status.detector || '-';
  detectorEl.classList.add(status.detector ? 'ok' : 'warn');

  if (signal.facePresent === true) {
    faceEl.textContent = signal.lookingAway ? 'Away' : 'Present';
    faceEl.classList.add(signal.lookingAway ? 'warn' : 'ok');
  } else if (signal.facePresent === false) {
    faceEl.textContent = 'Missing';
    faceEl.classList.add('bad');
  } else {
    faceEl.textContent = '-';
    faceEl.classList.add('warn');
  }

  if (heartbeat.ts) {
    beatEl.textContent = `${Math.round(lastBeatAge / 1000)}s ago`;
    beatEl.classList.add(isLive ? 'ok' : (isStale ? 'warn' : 'bad'));
  } else {
    beatEl.textContent = '-';
    beatEl.classList.add('warn');
  }
}

// Load current attention score
async function loadAttentionScore() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_ATTENTION_SCORE' });
  if (response && response.score !== undefined) {
    attentionScore = response.score;
    updateScoreDisplay();
  }
}

// Update score display
function updateScoreDisplay() {
  const scoreValue = document.getElementById('score-value');
  const scoreStatus = document.getElementById('score-status');
  const scoreProgress = document.getElementById('score-progress');

  scoreValue.textContent = Math.round(attentionScore);

  // Update status text and color
  if (attentionScore >= 80) {
    scoreStatus.textContent = 'Excellent Focus';
    scoreStatus.style.color = '#10b981';
  } else if (attentionScore >= 60) {
    scoreStatus.textContent = 'Good Focus';
    scoreStatus.style.color = '#818cf8';
  } else if (attentionScore >= 40) {
    scoreStatus.textContent = 'Moderate Focus';
    scoreStatus.style.color = '#f59e0b';
  } else {
    scoreStatus.textContent = 'Low Focus';
    scoreStatus.style.color = '#ef4444';
  }

  // Update circle progress (circumference = 2 * PI * 52)
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (attentionScore / 100) * circumference;
  scoreProgress.style.strokeDasharray = circumference;
  scoreProgress.style.strokeDashoffset = offset;
}

// Load statistics
async function loadStatistics() {
  const stats = await chrome.storage.local.get(['dailyStats']);
  const dailyStats = stats.dailyStats || {
    sessions: 0,
    focusTime: 0,
    breaks: 0,
    date: new Date().toDateString()
  };

  // Reset if new day
  if (dailyStats.date !== new Date().toDateString()) {
    dailyStats.sessions = 0;
    dailyStats.focusTime = 0;
    dailyStats.breaks = 0;
    dailyStats.date = new Date().toDateString();
    await chrome.storage.local.set({ dailyStats });
  }

  document.getElementById('stat-sessions').textContent = dailyStats.sessions;
  document.getElementById('stat-focus-time').textContent = formatTime(dailyStats.focusTime);
  document.getElementById('stat-breaks').textContent = dailyStats.breaks;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Load settings
async function loadSettings() {
  const config = await chrome.storage.local.get(['userConfig']);
  const userConfig = config.userConfig || {};

  if (userConfig.enableContentQuiz !== undefined) {
    document.getElementById('enable-quizzes').checked = userConfig.enableContentQuiz;
  }

  if (userConfig.enableInterventions !== undefined) {
    document.getElementById('enable-interventions').checked = userConfig.enableInterventions;
  }

  if (userConfig.enableBreaks !== undefined) {
    document.getElementById('enable-breaks').checked = userConfig.enableBreaks;
  }

  if (userConfig.quizFrequency) {
    document.getElementById('quiz-frequency').value = userConfig.quizFrequency;
  }

  if (userConfig.cameraEnabled !== undefined) {
    document.getElementById('enable-camera').checked = userConfig.cameraEnabled;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Start focus session
  document.getElementById('start-session').addEventListener('click', startFocusSession);

  // Take break
  document.getElementById('take-break').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'REQUEST_BREAK' });
    updateStatistic('breaks', 1);
  });

  // Stop session
  document.getElementById('stop-session')?.addEventListener('click', stopFocusSession);

  // Settings changes
  document.getElementById('enable-quizzes').addEventListener('change', (e) => {
    updateConfig({ enableContentQuiz: e.target.checked });
  });

  document.getElementById('enable-interventions').addEventListener('change', (e) => {
    updateConfig({ enableInterventions: e.target.checked });
  });

  document.getElementById('enable-breaks').addEventListener('change', (e) => {
    updateConfig({ enableBreaks: e.target.checked });
  });

  document.getElementById('quiz-frequency').addEventListener('change', (e) => {
    updateConfig({ quizFrequency: parseInt(e.target.value) });
  });

  // Camera tracking
  document.getElementById('enable-camera').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await updateConfig({ cameraEnabled: enabled });

    // Notify all tabs to enable/disable camera
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'ENABLE_CAMERA',
        enabled: enabled
      }).catch(() => { });
    });

    // Also notify background
    chrome.runtime.sendMessage({
      type: 'ENABLE_CAMERA',
      enabled: enabled
    });

    setTimeout(loadCameraRuntime, 300);
  });

  // Footer buttons
  document.getElementById('open-settings')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'app.html' });
  });

  document.getElementById('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard.html' });
  });
}

// Start focus session
function startFocusSession() {
  sessionActive = true;
  sessionStartTime = Date.now();

  // Show session info, hide quick actions
  document.querySelector('.fyx-quick-actions').style.display = 'none';
  document.getElementById('session-info').style.display = 'block';

  // Start timer
  updateSessionTimer();
  sessionTimer = setInterval(updateSessionTimer, 1000);

  // Notify background script
  chrome.runtime.sendMessage({
    type: 'START_FOCUS_SESSION',
    duration: sessionDuration / 60
  });

  updateStatistic('sessions', 1);
}

// Stop focus session
function stopFocusSession() {
  sessionActive = false;

  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }

  // Calculate focus time
  const focusTime = Math.floor((Date.now() - sessionStartTime) / 1000);
  updateStatistic('focusTime', focusTime);

  // Reset UI
  document.querySelector('.fyx-quick-actions').style.display = 'flex';
  document.getElementById('session-info').style.display = 'none';

  sessionStartTime = null;
}

// Update session timer
function updateSessionTimer() {
  if (!sessionStartTime) return;

  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
  const remaining = Math.max(0, sessionDuration - elapsed);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  document.getElementById('session-timer').textContent =
    `${minutes}:${seconds.toString().padStart(2, '0')}`;

  if (remaining === 0) {
    stopFocusSession();
  }
}

// Update configuration
async function updateConfig(changes) {
  await chrome.runtime.sendMessage({
    type: 'UPDATE_CONFIG',
    config: changes
  });
}

// Update statistics
async function updateStatistic(key, increment) {
  const stats = await chrome.storage.local.get(['dailyStats']);
  const dailyStats = stats.dailyStats || {
    sessions: 0,
    focusTime: 0,
    breaks: 0,
    date: new Date().toDateString()
  };

  dailyStats[key] += increment;
  await chrome.storage.local.set({ dailyStats });

  // Update display
  if (key === 'focusTime') {
    document.getElementById(`stat-${key}`).textContent = formatTime(dailyStats[key]);
  } else {
    document.getElementById(`stat-${key}`).textContent = dailyStats[key];
  }
}

// Listen for attention score updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ATTENTION_UPDATE') {
    attentionScore = message.score;
    updateScoreDisplay();
  }
});

// Refresh score every 5 seconds
setInterval(loadAttentionScore, 5000);
setInterval(loadCameraRuntime, 1000);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.cameraStatus || changes.cameraHeartbeat || changes.cameraSignal) {
    loadCameraRuntime();
  }
});
