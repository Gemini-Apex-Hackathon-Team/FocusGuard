// FYX Background Service Worker
// Handles attention tracking, Gemini agent decisions, and interventions

importScripts('intervention-manager.js');
importScripts('enhanced-intervention.js');
importScripts('gemini-session-manager.js');
importScripts('intervention-decision.js');
importScripts('local-config.js');

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
let geminiApiKey = (self.FYX_LOCAL_CONFIG && self.FYX_LOCAL_CONFIG.GEMINI_API_KEY) || '';

let geminiSession = null;
let currentTab = null;
let attentionScore = 100;
let sessionStartTime = Date.now();
let currentSessionDurationMs = 25 * 60 * 1000;

let focusSession = {
  workDuration: 25 * 60 * 1000,
  breakDuration: 5 * 60 * 1000,
  isWorking: false,
  isPaused: false
};

let userConfig = {
  attentionLevel: 5,
  blockedSites: [],
  allowedSites: [],
  quizFrequency: 15,
  enableFaceTracking: true,
  enableContentQuiz: true,
  enableInterventions: true,
  cameraEnabled: false
};

let sleepinessScore = null;
let cameraUserState = 'unknown';
let faceAbsentDuration = 0;

let latestEngagement = {
  isVisible: true,
  idleSeconds: 0,
  scrollCount: 0,
  mouseMovements: 0,
  keyPresses: 0,
  timeVisible: 0
};

let distractionMetrics = {
  rapidTabSwitches: [],
  excessiveScrolling: 0,
  erraticMouseMovement: 0
};

let tabActivity = {
  switches: 0,
  lastSwitchTime: Date.now(),
  lastTabId: null
};

let interventionState = {
  cooldownMs: 8 * 60 * 1000,
  dismissedAt: [],
  sensitivityBackoffUntil: 0
};

const AGENT_STATES = {
  FOCUSED: 'FOCUSED',
  DRIFTING: 'DRIFTING',
  DISTRACTED: 'DISTRACTED',
  INTERVENING: 'INTERVENING',
  COOLDOWN: 'COOLDOWN'
};

const TAB_AGENT = new Map();
let offscreenEnabled = false;

function getTabAgent(tabId) {
  if (!TAB_AGENT.has(tabId)) {
    TAB_AGENT.set(tabId, {
      tabId,
      state: AGENT_STATES.FOCUSED,
      lastActivityAt: Date.now(),
      distractionScore: 0,
      lastInterventionAt: 0,
      interventionCooldownUntil: 0,
      recentInterventions: [],
      interventionInProgress: false
    });
  }
  return TAB_AGENT.get(tabId);
}

function pushInterventionHistory(agent, item) {
  agent.recentInterventions.push({
    at: Date.now(),
    ...item
  });
  if (agent.recentInterventions.length > 12) {
    agent.recentInterventions = agent.recentInterventions.slice(-12);
  }
}

async function hasOffscreenDocument() {
  if (chrome.offscreen?.hasDocument) {
    return chrome.offscreen.hasDocument();
  }
  return false;
}

async function ensureOffscreenCamera() {
  if (!chrome.offscreen?.createDocument) return;
  if (await hasOffscreenDocument()) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Detect face/gaze signals for local attention scoring.'
  });
}

async function stopOffscreenCamera() {
  try {
    await chrome.runtime.sendMessage({ type: 'OFFSCREEN_CAMERA_STOP' });
  } catch {
    // ignore
  }
  if (!chrome.offscreen?.closeDocument) return;
  if (!(await hasOffscreenDocument())) return;
  await chrome.offscreen.closeDocument();
}

async function startOffscreenCameraCapture() {
  await ensureOffscreenCamera();
  // Offscreen document load can race; retry start briefly.
  for (let i = 0; i < 5; i++) {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_CAMERA_START' });
      if (result?.success) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

function scoreFromSignal(signal) {
  let score = 0;
  const effectiveCameraState =
    signal.cameraUserState && signal.cameraUserState !== 'unknown'
      ? signal.cameraUserState
      : cameraUserState;
  const effectiveFaceDetected =
    typeof signal.faceDetected === 'boolean'
      ? signal.faceDetected
      : (effectiveCameraState === 'absent' ? false : null);

  if ((signal.idleSeconds || 0) >= 45) score += 2;
  if (signal.visible === false) score += 3;
  if (effectiveFaceDetected === false) score += 2;
  if (effectiveCameraState === 'looking_away') score += 3;
  if ((signal.tabSwitchesLastMinute || 0) >= 4) score += 2;
  if ((signal.interactionBursts || 0) === 0 && (signal.idleSeconds || 0) > 20) score += 1;
  return Math.min(10, score);
}

function deriveState(score) {
  if (score >= 7) return AGENT_STATES.DISTRACTED;
  if (score >= 4) return AGENT_STATES.DRIFTING;
  return AGENT_STATES.FOCUSED;
}

async function callDecideWorker(payload) {
  const res = await fetch('https://focus-quiz-api.amaasabea09.workers.dev/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Decide worker HTTP ${res.status}`);
  }
  return res.json();
}

async function handleAgentSignal(tabId, signal) {
  const agent = getTabAgent(tabId);
  const now = Date.now();

  if ((signal.idleSeconds || 0) < 8) {
    agent.lastActivityAt = now;
  }

  agent.distractionScore = scoreFromSignal(signal);

  if (agent.interventionCooldownUntil > now) {
    agent.state = AGENT_STATES.COOLDOWN;
    return { state: agent.state, score: agent.distractionScore };
  }

  const nextState = deriveState(agent.distractionScore);
  agent.state = nextState;

  if (nextState === AGENT_STATES.FOCUSED) {
    return { state: agent.state, score: agent.distractionScore };
  }

  if (agent.interventionInProgress) {
    return { state: AGENT_STATES.INTERVENING, score: agent.distractionScore };
  }

  if (nextState === AGENT_STATES.DRIFTING) {
    await chrome.tabs.sendMessage(tabId, {
      type: 'INTERVENTION',
      action: 'SHOW_NUDGE',
      payload: {
        message: 'You are drifting. Quick reset: summarize the main idea in one sentence.',
        score: agent.distractionScore
      }
    }).catch(() => {});

    agent.lastInterventionAt = now;
    agent.interventionCooldownUntil = now + (2 * 60 * 1000);
    pushInterventionHistory(agent, { kind: 'nudge', score: agent.distractionScore });
    return { state: AGENT_STATES.COOLDOWN, score: agent.distractionScore };
  }

  // DISTRACTED path: gather context and ask decide worker
  agent.interventionInProgress = true;
  agent.state = AGENT_STATES.INTERVENING;
  try {
    const context = await chrome.tabs.sendMessage(tabId, { type: 'GET_CONTEXT' }).catch(() => ({}));
    const decidePayload = {
      signal,
      score: agent.distractionScore,
      state: agent.state,
      context,
      recentInterventions: agent.recentInterventions
    };

    let decision;
    try {
      decision = await callDecideWorker(decidePayload);
    } catch {
      decision = { action: 'START_QUIZ', reason: 'fallback', tool: 'generate_quiz' };
    }

    if (decision.tool === 'generate_quiz') {
      const quizRes = await fetch('https://focus-quiz-api.amaasabea09.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: context.snippet || signal.contentHint || '',
          title: context.title || 'Current Page'
        })
      });
      const quiz = quizRes.ok ? await quizRes.json() : null;
      await chrome.tabs.sendMessage(tabId, {
        type: 'INTERVENTION',
        action: 'START_QUIZ',
        payload: {
          message: decision.message || 'Focus check time.',
          quiz
        }
      }).catch(() => {});
      pushInterventionHistory(agent, { kind: 'quiz', score: agent.distractionScore });
      agent.lastInterventionAt = now;
      // Keep INTERVENING until RESULT message marks completion.
      return { state: agent.state, score: agent.distractionScore };
    } else if (decision.tool === 'suggest_break' || decision.action === 'SUGGEST_BREAK') {
      await chrome.tabs.sendMessage(tabId, {
        type: 'INTERVENTION',
        action: 'SHOW_NUDGE',
        payload: {
          message: decision.message || 'Take a 60-second break. Look away, breathe, then come back.'
        }
      }).catch(() => {});
      pushInterventionHistory(agent, { kind: 'break', score: agent.distractionScore });
    } else {
      await chrome.tabs.sendMessage(tabId, {
        type: 'INTERVENTION',
        action: 'SHOW_NUDGE',
        payload: {
          message: decision.message || 'Stay with the task for 90 more seconds.'
        }
      }).catch(() => {});
      pushInterventionHistory(agent, { kind: 'nudge', score: agent.distractionScore });
    }

    agent.lastInterventionAt = now;
    agent.interventionCooldownUntil = now + (8 * 60 * 1000);
    agent.state = AGENT_STATES.COOLDOWN;
    agent.interventionInProgress = false;
  } finally {
    // handled above for non-quiz paths; quiz path returns early and keeps INTERVENING.
  }

  return { state: agent.state, score: agent.distractionScore };
}

async function initializeState() {
  try {
    const saved = await chrome.storage.local.get(['userConfig', 'attentionScore']);
    if (saved.userConfig) userConfig = { ...userConfig, ...saved.userConfig };
    if (typeof saved.attentionScore === 'number') attentionScore = saved.attentionScore;
    offscreenEnabled = !!userConfig.cameraEnabled;
    if (offscreenEnabled) {
      await ensureOffscreenCamera();
    }
  } catch (error) {
    console.error('[FYX] Failed to initialize state:', error);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await initializeState();

  const onboarded = await chrome.storage.local.get('onboarded');
  if (!onboarded.onboarded) {
    chrome.tabs.create({ url: 'onboarding.html' });
  }

  chrome.alarms.create('updateAttention', { periodInMinutes: 0.5 });
  chrome.alarms.create('checkIntervention', { periodInMinutes: 1 });
  chrome.alarms.create('snapshotScore', { periodInMinutes: 5 });
});

chrome.action.onClicked.addListener(async () => {
  if (!offscreenEnabled) return;
  await startOffscreenCameraCapture();
});

chrome.runtime.onStartup.addListener(() => {
  initializeState();
});

initializeState();

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  handleTabSwitch(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) handleTabSwitch(tab);
});

function handleTabSwitch(tab) {
  currentTab = tab;
  tabActivity.switches++;
  tabActivity.lastSwitchTime = Date.now();
  tabActivity.lastTabId = tab.id;

  distractionMetrics.rapidTabSwitches.push(Date.now());
  distractionMetrics.rapidTabSwitches = distractionMetrics.rapidTabSwitches
    .filter((ts) => Date.now() - ts < 60000);

  if (isBlockedSite(tab.url)) {
    showBlockedPage(tab.id);
    return;
  }

  if (tabActivity.switches > 5) updateAttentionScore(-5);
  injectContentScript(tab.id);
}

function isBlockedSite(url) {
  if (!url) return false;
  try {
    const domain = new URL(url).hostname;
    return userConfig.blockedSites.some((blocked) => domain.includes(blocked));
  } catch {
    return false;
  }
}

async function showBlockedPage(tabId) {
  await chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') });
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (error) {
    // Ignore pages where script injection is not allowed
  }
}

function updateAttentionScore(delta) {
  attentionScore = Math.max(0, Math.min(100, attentionScore + delta));
  chrome.storage.local.set({ attentionScore });
  chrome.runtime.sendMessage({ type: 'ATTENTION_UPDATE', score: attentionScore }).catch(() => {});
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateAttention') calculateAttentionScore();
  if (alarm.name === 'checkIntervention') checkForIntervention();
  if (alarm.name === 'sessionEnd') stopFocusSession();
  if (alarm.name === 'snapshotScore') snapshotAttentionScore();
});

async function calculateAttentionScore() {
  if (!currentTab) return;

  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'GET_ENGAGEMENT_DATA' });
    if (!response) return;

    latestEngagement = {
      ...latestEngagement,
      ...response,
      idleSeconds: response.idleSeconds || 0,
      keyPresses: response.keyPresses || 0
    };

    distractionMetrics.excessiveScrolling = response.scrollCount || 0;
    distractionMetrics.erraticMouseMovement = response.mouseMovements || 0;

    let scoreChange = 0;

    if (response.timeVisible > 30) scoreChange += 2;
    if (response.scrollCount > 0 && response.scrollCount < 20) scoreChange += 1;
    if (response.scrollCount > 50) scoreChange -= 3;
    if (response.mouseMovements > 10 || response.keyPresses > 3) scoreChange += 1;
    if (!response.isVisible) scoreChange -= 5;
    if ((response.idleSeconds || 0) > 45) scoreChange -= 4;
    if (tabActivity.switches > 10) scoreChange -= 2;

    if (userConfig.cameraEnabled && sleepinessScore !== null) {
      if (cameraUserState === 'absent' || sleepinessScore === 0) scoreChange -= 12;
      else if (cameraUserState === 'looking_away') scoreChange -= 10;
      else if (cameraUserState === 'bored' || sleepinessScore < 50) scoreChange -= 6;
      else if (sleepinessScore < 70) scoreChange -= 3;
      else scoreChange += 2;
    }

    updateAttentionScore(scoreChange);
  } catch {
    // Ignore tabs where messages can't be sent
  }
}

function computeDistractionSignals() {
  const signals = [];
  let score = 0;

  if ((latestEngagement.idleSeconds || 0) >= 45) {
    score += 2;
    signals.push('No interaction for 45s+');
  }
  if (latestEngagement.isVisible === false) {
    score += 3;
    signals.push('Window/tab lost focus');
  }
  if (userConfig.cameraEnabled && (cameraUserState === 'absent' || faceAbsentDuration > 3000)) {
    score += 2;
    signals.push('Face not detected');
  }
  if (userConfig.cameraEnabled && cameraUserState === 'looking_away' && faceAbsentDuration > 3000) {
    score += 3;
    signals.push('Looking away from screen');
  }
  if (distractionMetrics.rapidTabSwitches.length >= 4) {
    score += 2;
    signals.push('Rapid tab switching');
  }
  if (attentionScore < 45) {
    score += 2;
    signals.push('Low focus score');
  }

  return { score, signals };
}

async function checkForIntervention() {
  if (TAB_AGENT.size > 0) {
    // Signal-driven agent runtime handles interventions. Keep this path for passive maintenance only.
    return;
  }
  if (focusSession.isPaused || !userConfig.enableInterventions) return;

  const lastIntervention = await chrome.storage.local.get('lastInterventionTime');
  const timeSinceIntervention = Date.now() - (lastIntervention.lastInterventionTime || 0);
  if (timeSinceIntervention < interventionState.cooldownMs) return;

  const signalState = computeDistractionSignals();
  const threshold = Date.now() < interventionState.sensitivityBackoffUntil ? 9 : 7;

  if (signalState.score >= threshold) {
    await triggerAgenticIntervention('challenge_break', signalState);
    return;
  }

  if (signalState.score >= 4) {
    // Cheap local nudge: do not call Gemini in this band.
    await chrome.tabs.sendMessage(currentTab.id, {
      type: 'SHOW_INTERVENTION',
      reason: 'local_nudge',
      suggestion: 'You seem slightly off-track. Close one distractor tab and spend 60 seconds on the main idea.',
      attentionScore
    }).catch(() => {});

    await chrome.storage.local.set({ lastInterventionTime: Date.now() });
    return;
  }

  const lastQuiz = await chrome.storage.local.get('lastQuizTime');
  const timeSinceQuiz = Date.now() - (lastQuiz.lastQuizTime || 0);
  if (userConfig.enableContentQuiz && timeSinceQuiz > userConfig.quizFrequency * 60 * 1000) {
    await triggerContentQuiz();
  }
}

async function triggerAgenticIntervention(mode = 'auto', signalState = { score: 0, signals: [] }) {
  if (!currentTab) return;

  const context = await getCurrentContext();
  context.distractionSignals = signalState.signals;
  context.distractionScore = signalState.score;
  context.idleSeconds = latestEngagement.idleSeconds || 0;
  context.tabSwitchesLastMinute = distractionMetrics.rapidTabSwitches.length;

  const prompt = generateInterventionPrompt('agentic_intervention', context, mode);
  const aiResponse = await callGeminiAPI(prompt);

  await chrome.storage.local.set({ lastInterventionTime: Date.now() });

  let decision;
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) decision = JSON.parse(jsonMatch[0]);
  } catch {
    // fallback below
  }

  if (!decision) {
    decision = signalState.score >= 7
      ? { type: 'break_tab', reason: 'Distraction is high', message: 'Let’s reset with a quick challenge.', topic: context.title }
      : { type: 'fun_popup', reason: 'Attention drift', message: aiResponse || 'Quick reset?', topic: context.title };
  }

  const stored = await chrome.storage.local.get('userName');
  const userName = stored.userName || '';

  try {
    if (decision.type === 'break_tab' || decision.type === 'quiz_game') {
      const challenge = decision.challenge || await generateFocusChallenge(context);
      await openWakeUpTab({
        topic: decision.topic || context.title,
        reason: decision.reason,
        message: decision.message,
        challenge
      });
      return;
    }

    if (decision.type === 'quiz' && decision.quiz) {
      await chrome.tabs.sendMessage(currentTab.id, { type: 'SHOW_QUIZ', quiz: decision.quiz });
      await chrome.storage.local.set({ lastQuizTime: Date.now() });
      return;
    }

    if (decision.type === 'blink_screen') {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: 'SHOW_BLINK_SCREEN',
        message: decision.message,
        topic: decision.topic,
        userName
      });
      return;
    }

    if (decision.type === 'break') {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: 'SHOW_INTERVENTION',
        reason: decision.reason,
        suggestion: decision.message,
        attentionScore
      });
      return;
    }

    await chrome.tabs.sendMessage(currentTab.id, {
      type: 'SHOW_FUN_POPUP',
      message: decision.message || 'Hey, quick focus check?',
      reason: decision.reason,
      topic: decision.topic || context.title,
      userName,
      attentionScore
    });
  } catch {
    // ignore tab messaging failures
  }
}

async function generateFocusChallenge(context) {
  const prompt = `You are FYX agent. Create a short focus challenge from current content.

Topic: ${context.title}
Content excerpt: ${(context.contentExcerpt || '').substring(0, 900)}

Return strict JSON:
{
  "mode": "quiz" | "game",
  "title": "short title",
  "question": "question",
  "options": ["A","B","C"],
  "correctIndex": 0,
  "memoryHook": "one memorable line",
  "miniChallenge": "one tiny action"
}`;

  const response = await callGeminiAPI(prompt);
  try {
    const parsed = JSON.parse((response.match(/\{[\s\S]*\}/) || [])[0]);
    if (parsed && parsed.question && Array.isArray(parsed.options)) return parsed;
  } catch {
    // fallback below
  }

  return {
    mode: 'quiz',
    title: 'Quick Recall',
    question: 'Which option best matches the page\'s core idea?',
    options: ['Main concept', 'Minor side note', 'Unrelated point'],
    correctIndex: 0,
    memoryHook: 'Main idea first, details second.',
    miniChallenge: 'Take 3 deep breaths, then answer in under 20 seconds.'
  };
}

async function openWakeUpTab(payload) {
  await chrome.storage.local.set({ wakeChallenge: payload });
  await chrome.tabs.create({ url: chrome.runtime.getURL('wake-tab.html') });
}

async function triggerAIIntervention(reason) {
  const context = await getCurrentContext();
  const prompt = generateInterventionPrompt(reason, context, 'nudge');
  const aiResponse = await callGeminiAPI(prompt);

  if (currentTab) {
    chrome.tabs.sendMessage(currentTab.id, {
      type: 'SHOW_INTERVENTION',
      reason,
      suggestion: aiResponse,
      attentionScore
    }).catch(() => {});
  }
}

async function getCurrentContext() {
  if (!currentTab) return {};

  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'GET_PAGE_CONTEXT' });
    return {
      url: currentTab.url,
      title: currentTab.title,
      timeOnPage: response?.timeOnPage || 0,
      contentType: response?.contentType || 'unknown',
      scrollPosition: response?.scrollPosition || 0,
      contentExcerpt: response?.text || '',
      scrollProgress: response?.scrollProgress || 0
    };
  } catch {
    return { url: currentTab.url, title: currentTab.title };
  }
}

function getCameraStateDescription() {
  if (!userConfig.cameraEnabled || sleepinessScore === null) return 'Camera disabled';
  if (cameraUserState === 'absent') return `Face not detected for ${Math.round(faceAbsentDuration / 1000)}s`;
  if (cameraUserState === 'looking_away') return 'Looking away from screen';
  if (cameraUserState === 'bored') return 'Restless movement detected';
  return 'User appears focused';
}

function generateInterventionPrompt(reason, context, mode = 'auto') {
  const cameraState = getCameraStateDescription();

  const prompts = {
    low_attention: `You are FYX, a focus assistant. Attention is ${attentionScore}/100.
Context: ${context.title}. Content: ${(context.contentExcerpt || '').substring(0, 300)}
Camera: ${cameraState}
Give one short empathetic refocus suggestion under 40 words.`,

    break_suggestion: `You are FYX. Suggest a short break action.
Attention: ${attentionScore}/100. Camera: ${cameraState}
Return one activity + duration in under 30 words.`,

    agentic_intervention: `You are FYX agent orchestrator.

Mode: ${mode}
Attention: ${attentionScore}/100
Camera: ${cameraState}
Page: ${context.title}
Content: ${(context.contentExcerpt || '').substring(0, 700)}
Distraction score: ${context.distractionScore || 0}/10
Signals: ${(context.distractionSignals || []).join(', ') || 'none'}
Idle seconds: ${context.idleSeconds || 0}
Tab switches last minute: ${context.tabSwitchesLastMinute || 0}

Return strict JSON:
{
  "type": "none" | "fun_popup" | "quiz" | "blink_screen" | "break" | "quiz_game" | "break_tab",
  "reason": "brief reason",
  "message": "short user-facing message",
  "topic": "topic",
  "quiz": { "question": "...", "options": ["a","b","c"], "correctIndex": 0, "explanation": "..." },
  "challenge": { "mode": "quiz|game", "title": "...", "question": "...", "options": ["a","b","c"], "correctIndex": 0, "memoryHook": "...", "miniChallenge": "..." }
}
If type is quiz, include quiz. If type is quiz_game or break_tab, include challenge.`
  };

  return prompts[reason] || prompts.low_attention;
}

async function callGeminiAPI(prompt) {
  if (!geminiApiKey || geminiApiKey === 'PASTE_NEW_GEMINI_KEY_HERE') {
    await chrome.storage.local.set({ lastGeminiError: 'Gemini key missing in local-config.js' });
    return 'Gemini key is not configured. Set GEMINI_API_KEY in local-config.js.';
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 280,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      await chrome.storage.local.set({ lastGeminiError: `Gemini HTTP ${response.status}` });
      return 'Take a brief reset and refocus on the main idea.';
    }

    const data = await response.json();
    await chrome.storage.local.set({ lastGeminiError: '' });

    if (data.candidates && data.candidates[0]) {
      return data.candidates[0].content.parts[0].text;
    }

    if (data.error) {
      await chrome.storage.local.set({ lastGeminiError: data.error.message || 'Gemini API error' });
      return 'Take a brief reset and refocus on the main idea.';
    }

    return 'Take a brief reset and refocus on the main idea.';
  } catch (error) {
    await chrome.storage.local.set({ lastGeminiError: error.message || 'Gemini request failed' });
    return 'Take a brief reset and refocus on the main idea.';
  }
}

async function triggerContentQuiz() {
  if (!currentTab) return;

  try {
    const content = await chrome.tabs.sendMessage(currentTab.id, { type: 'GET_PAGE_CONTENT' });
    if (!content || !content.text) return;

    const quiz = await generateQuiz(content);
    await chrome.tabs.sendMessage(currentTab.id, { type: 'SHOW_QUIZ', quiz });
    await chrome.storage.local.set({ lastQuizTime: Date.now() });
  } catch {
    // ignore
  }
}

async function generateQuiz(content) {
  const prompt = `Create one quick comprehension MCQ from this content.

Content excerpt: "${content.text.substring(0, 700)}"

Return JSON:
{
  "question": "brief question",
  "options": ["A", "B", "C"],
  "correctIndex": 0,
  "explanation": "why this concept matters"
}`;

  const response = await callGeminiAPI(prompt);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {
    // fallback below
  }

  return {
    question: 'Which option best reflects the main point you were reading?',
    options: ['Main concept', 'Minor detail', 'Unrelated idea'],
    correctIndex: 0,
    explanation: 'Checking the main idea is the fastest way to recover focus.'
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'UPDATE_CONFIG') {
        userConfig = { ...userConfig, ...message.config };
        await chrome.storage.local.set({ userConfig });
        sendResponse({ success: true });
      }

      if (message.type === 'GET_ATTENTION_SCORE') sendResponse({ score: attentionScore });

      if (message.type === 'SIGNAL') {
        const tabId = sender?.tab?.id;
        if (!tabId) {
          sendResponse({ success: false, error: 'Missing tab id' });
          return;
        }
        const result = await handleAgentSignal(tabId, message.payload || {});
        sendResponse({ success: true, ...result });
      }

      if (message.type === 'QUIZ_COMPLETED') {
        handleQuizResult(message.correct);
        sendResponse({ success: true });
      }

      if (message.type === 'REQUEST_BREAK') {
        await triggerAIIntervention('break_suggestion');
        sendResponse({ success: true });
      }

      if (message.type === 'START_FOCUS_SESSION') {
        await startFocusSession(message.duration);
        sendResponse({ success: true });
      }

      if (message.type === 'UPDATE_SLEEPINESS_SCORE') {
        sleepinessScore = message.score;
        cameraUserState = message.userState || 'unknown';
        faceAbsentDuration = message.faceAbsentDuration || 0;
        sendResponse({ success: true });
      }

      if (message.type === 'CAMERA_METRICS') {
        const metrics = message.metrics || {};
        sleepinessScore = typeof metrics.sleepinessScore === 'number' ? metrics.sleepinessScore : sleepinessScore;
        cameraUserState = metrics.userState || cameraUserState || 'unknown';
        faceAbsentDuration = metrics.faceAbsentDuration || 0;
        await chrome.storage.local.set({ latestSleepinessScore: sleepinessScore });
        sendResponse({ success: true });
      }

      if (message.type === 'CAMERA_STATUS') {
        await chrome.storage.local.set({ cameraStatus: message });
        sendResponse({ success: true });
      }

      if (message.type === 'CAMERA_HEARTBEAT') {
        await chrome.storage.local.set({ cameraHeartbeat: message });
        sendResponse({ success: true });
      }

      if (message.type === 'CAMERA_SIGNAL') {
        await chrome.storage.local.set({ cameraSignal: message });
        if (message.facePresent === true) {
          sleepinessScore = message.eyesClosed === true ? 35 : 80;
          cameraUserState = message.lookingAway === true ? 'looking_away' : (message.eyesClosed === true ? 'bored' : 'focused');
          faceAbsentDuration = 0;
        } else if (message.facePresent === false) {
          sleepinessScore = 0;
          cameraUserState = 'absent';
          faceAbsentDuration = 1000;
        } else {
          // Camera-only mode: no reliable face inference. Keep camera state neutral.
          sleepinessScore = null;
          cameraUserState = 'unknown';
          faceAbsentDuration = 0;
        }
        sendResponse({ success: true });
      }

      if (message.type === 'START_SESSION') {
        const result = await startFocusSession(message.duration, message.goal);
        sendResponse(result);
      }

      if (message.type === 'STOP_SESSION') {
        const summary = await stopFocusSession();
        sendResponse(summary);
      }

      if (message.type === 'GET_SESSION_STATE') {
        sendResponse(geminiSession ? geminiSession.getState() : { active: false });
      }

      if (message.type === 'ENABLE_CAMERA') {
        userConfig.cameraEnabled = message.enabled;
        await chrome.storage.local.set({ userConfig });
        offscreenEnabled = !!message.enabled;
        if (offscreenEnabled) await startOffscreenCameraCapture();
        else await stopOffscreenCamera();
        sendResponse({ success: true });
      }

      if (message.type === 'ANALYZE_PATTERNS') {
        await analyzeUserPatterns();
        const insights = await chrome.storage.local.get('geminiInsights');
        sendResponse(insights.geminiInsights || {});
      }

      if (message.type === 'GET_DASHBOARD_DATA') {
        const dashData = await chrome.storage.local.get([
          'sessionHistory', 'dailyScores', 'dailyStats',
          'geminiInsights', 'userName', 'lastAnalysisTime', 'lastGeminiError'
        ]);
        sendResponse(dashData);
      }

      if (message.type === 'FUN_POPUP_RESPONSE') {
        if (message.action === 'focused') updateAttentionScore(5);
        sendResponse({ success: true });
      }

      if (message.type === 'INTERVENTION_DISMISSED') {
        interventionState.dismissedAt.push(Date.now());
        interventionState.dismissedAt = interventionState.dismissedAt
          .filter((ts) => Date.now() - ts < 30 * 60 * 1000);

        if (interventionState.dismissedAt.length >= 2) {
          interventionState.sensitivityBackoffUntil = Date.now() + (30 * 60 * 1000);
          interventionState.dismissedAt = [];
        }
        sendResponse({ success: true });
      }

      if (message.type === 'RESULT') {
        const tabId = sender?.tab?.id;
        if (!tabId) {
          sendResponse({ success: false, error: 'Missing tab id' });
          return;
        }
        const agent = getTabAgent(tabId);
        const now = Date.now();
        const correctCount = Number(message.correct || 0);
        const dismissed = Boolean(message.dismissed);
        const durationMs = Number(message.durationMs || 0);

        pushInterventionHistory(agent, {
          kind: message.kind || 'quiz',
          correct: correctCount,
          dismissed,
          durationMs
        });

        if (dismissed) {
          agent.interventionCooldownUntil = now + (6 * 60 * 1000);
        } else {
          agent.interventionCooldownUntil = now + (9 * 60 * 1000);
        }
        agent.interventionInProgress = false;
        agent.state = AGENT_STATES.COOLDOWN;
        sendResponse({ success: true, state: agent.state });
      }

      if (message.type === 'REQUEST_QUIZ_AFTER_BLINK') {
        await triggerContentQuiz();
        sendResponse({ success: true });
      }

      if (message.type === 'GEN_QUIZ') {
        const payload = {
          content: message.content || '',
          title: message.title || 'Untitled'
        };

        const workerResponse = await fetch('https://focus-quiz-api.amaasabea09.workers.dev', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!workerResponse.ok) {
          sendResponse({
            success: false,
            error: `Quiz worker HTTP ${workerResponse.status}`
          });
          return;
        }

        const quizJson = await workerResponse.json();
        sendResponse({
          success: true,
          quiz: quizJson
        });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});

function handleQuizResult(correct) {
  if (correct) updateAttentionScore(10);
  else {
    updateAttentionScore(-5);
    if (attentionScore < 50) triggerAIIntervention('low_attention');
  }
}

async function startFocusSession(duration, goal = '') {
  currentSessionDurationMs = duration
    ? (duration < 1000 ? duration * 60 * 1000 : duration)
    : 25 * 60 * 1000;

  focusSession.workDuration = currentSessionDurationMs;
  focusSession.isWorking = true;
  focusSession.isPaused = false;

  // Local-only monitoring session. Gemini is called only on high-confidence distraction
  // or when quiz/game generation is required.
  geminiSession = null;
  const sessionData = {
    message: 'Session started. Local monitoring active.',
    suggestions: ['Keep one tab open for the main task.']
  };

  chrome.runtime.sendMessage({
    type: 'SESSION_STARTED',
    suggestions: sessionData.suggestions,
    goal
  }).catch(() => {});

  chrome.alarms.create('sessionEnd', { delayInMinutes: currentSessionDurationMs / 60000 });

  return sessionData;
}

async function handleSessionTabChange(activeInfo) {
  return activeInfo;
}

async function handleSessionTabUpdate(tabId, changeInfo, tab) {
  return { tabId, changeInfo, tab };
}

async function stopFocusSession() {
  focusSession.isWorking = false;
  focusSession.isPaused = false;

  let summary = {
    duration: Math.round(currentSessionDurationMs / 60000),
    goal: '',
    focusRating: Math.max(1, Math.min(10, Math.round(attentionScore / 10))),
    summary: 'Session completed with local distraction monitoring.',
    tabsVisited: tabActivity.switches
  };

  await saveSessionData(summary);
  chrome.alarms.clear('sessionEnd');

  chrome.runtime.sendMessage({ type: 'SESSION_ENDED', summary }).catch(() => {});

  return summary;
}

async function snapshotAttentionScore() {
  const data = await chrome.storage.local.get(['dailyScores']);
  const dailyScores = data.dailyScores || [];
  const today = new Date().toDateString();

  let todayEntry = dailyScores.find((d) => d.date === today);
  if (!todayEntry) {
    todayEntry = { date: today, scores: [] };
    dailyScores.push(todayEntry);
  }

  todayEntry.scores.push({
    time: new Date().toLocaleTimeString(),
    score: attentionScore,
    cameraState: cameraUserState
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const filtered = dailyScores.filter((d) => new Date(d.date) >= sevenDaysAgo);

  await chrome.storage.local.set({ dailyScores: filtered });
}

async function saveSessionData(summary) {
  const data = await chrome.storage.local.get(['sessionHistory']);
  const sessionHistory = data.sessionHistory || [];

  sessionHistory.push({
    date: new Date().toISOString(),
    duration: summary?.duration || 0,
    goal: summary?.goal || '',
    focusRating: summary?.focusRating || 5,
    summary: summary?.summary || '',
    tabsVisited: summary?.tabsVisited || 0,
    averageScore: attentionScore
  });

  if (sessionHistory.length > 100) sessionHistory.shift();
  await chrome.storage.local.set({ sessionHistory });
}

async function analyzeUserPatterns() {
  const data = await chrome.storage.local.get(['sessionHistory', 'dailyScores', 'dailyStats']);
  const sessions = data.sessionHistory || [];

  if (sessions.length < 3) {
    await chrome.storage.local.set({
      geminiInsights: {
        insights: ['Complete a few more sessions to unlock personalized insights.'],
        suggestion: 'Start a focus session to begin tracking patterns.',
        trend: 'stable'
      }
    });
    return;
  }

  const prompt = `Analyze user focus trends and return JSON only:
{
  "bestFocusTime": "morning/afternoon/evening/unknown",
  "optimalDuration": "X minutes",
  "trend": "improving/stable/declining",
  "insights": ["i1","i2","i3"],
  "suggestion": "one action"
}
Data: ${JSON.stringify(sessions.slice(-10))}`;

  try {
    const response = await callGeminiAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const insights = JSON.parse(jsonMatch[0]);
      await chrome.storage.local.set({
        geminiInsights: insights,
        lastAnalysisTime: Date.now()
      });
    }
  } catch (error) {
    console.error('[FYX] Pattern analysis failed:', error);
  }
}
