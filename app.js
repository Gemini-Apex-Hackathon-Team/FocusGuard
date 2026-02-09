const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_API_KEY = (self.FYX_LOCAL_CONFIG && self.FYX_LOCAL_CONFIG.GEMINI_API_KEY) || '';

const ui = {
  goal: document.getElementById('goal'),
  startBtn: document.getElementById('start-btn'),
  stopBtn: document.getElementById('stop-btn'),
  focusScore: document.getElementById('focus-score'),
  faceState: document.getElementById('face-state'),
  sessionTime: document.getElementById('session-time'),
  video: document.getElementById('camera'),
  overlay: document.getElementById('overlay'),
  agentStatus: document.getElementById('agent-status'),
  agentLog: document.getElementById('agent-log')
};

const state = {
  running: false,
  stream: null,
  startTs: 0,
  focusScore: 100,
  faceDetector: null,
  prevCenter: null,
  noFaceFrames: 0,
  focusHistory: [],
  movementHistory: [],
  sampleTimer: null,
  tickTimer: null,
  agentTimer: null,
  goal: ''
};

function init() {
  const savedGoal = localStorage.getItem('fyx_goal') || '';
  ui.goal.value = savedGoal;

  ui.startBtn.addEventListener('click', startSession);
  ui.stopBtn.addEventListener('click', stopSession);
}

async function startSession() {
  const goal = ui.goal.value.trim() || 'Stay focused on the active task';

  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'PASTE_NEW_GEMINI_KEY_HERE') {
    setAgentStatus('Set GEMINI_API_KEY in local-config.js before starting.', 'danger');
    return;
  }

  state.goal = goal;
  localStorage.setItem('fyx_goal', goal);

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 20 } },
      audio: false
    });
    ui.video.srcObject = state.stream;
    await ui.video.play();
  } catch (error) {
    setAgentStatus('Camera permission denied. Webcam is required for focus tracking.', 'danger');
    return;
  }

  state.faceDetector = 'FaceDetector' in window
    ? new FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
    : null;

  if (!state.faceDetector) {
    setAgentStatus('FaceDetector API not supported. Use latest Chrome for standalone mode.', 'danger');
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
    ui.video.srcObject = null;
    return;
  }

  state.running = true;
  state.startTs = Date.now();
  state.focusScore = 100;
  state.prevCenter = null;
  state.noFaceFrames = 0;
  state.focusHistory = [];
  state.movementHistory = [];

  ui.startBtn.disabled = true;
  ui.stopBtn.disabled = false;
  ui.focusScore.textContent = '100';
  ui.faceState.textContent = 'Tracking';

  state.sampleTimer = setInterval(sampleCamera, 700);
  state.tickTimer = setInterval(updateClock, 1000);
  state.agentTimer = setInterval(runAgentLoop, 30000);

  setAgentStatus('Gemini agent running. Monitoring focus signals.', 'normal');
  addLog('Session started. Agent will check every 30s.');

  runAgentLoop();
}

async function stopSession() {
  if (!state.running) return;

  state.running = false;
  clearInterval(state.sampleTimer);
  clearInterval(state.tickTimer);
  clearInterval(state.agentTimer);

  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  ui.video.srcObject = null;
  const ctx = ui.overlay.getContext('2d');
  ctx.clearRect(0, 0, ui.overlay.width, ui.overlay.height);

  ui.startBtn.disabled = false;
  ui.stopBtn.disabled = true;
  ui.faceState.textContent = 'Idle';

  const summary = summarizeFocus();
  addLog(`Session ended. Avg score ${summary.average}, away frames ${summary.awayFrames}.`);
  setAgentStatus('Session stopped.', 'normal');
}

function updateClock() {
  const elapsed = Math.floor((Date.now() - state.startTs) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  ui.sessionTime.textContent = `${mm}:${ss}`;
}

async function sampleCamera() {
  if (!state.running || !state.faceDetector) return;

  ensureCanvasSize();
  const ctx = ui.overlay.getContext('2d');
  ctx.clearRect(0, 0, ui.overlay.width, ui.overlay.height);

  try {
    const faces = await state.faceDetector.detect(ui.video);

    if (!faces.length) {
      state.noFaceFrames += 1;
      updateScore(-3);
      ui.faceState.textContent = 'Face not found';
      ui.faceState.className = 'metric-value small status-danger';
      recordMetrics(0);
      return;
    }

    const face = faces[0].boundingBox;
    const center = { x: face.x + face.width / 2, y: face.y + face.height / 2 };

    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.strokeRect(face.x, face.y, face.width, face.height);

    let movement = 0;
    if (state.prevCenter) {
      const dx = center.x - state.prevCenter.x;
      const dy = center.y - state.prevCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const diagonal = Math.sqrt(ui.overlay.width ** 2 + ui.overlay.height ** 2);
      movement = distance / diagonal;
    }

    state.prevCenter = center;

    if (movement > 0.06) {
      updateScore(-4);
      ui.faceState.textContent = 'High movement';
      ui.faceState.className = 'metric-value small status-warn';
    } else if (movement > 0.03) {
      updateScore(-1);
      ui.faceState.textContent = 'Moving';
      ui.faceState.className = 'metric-value small';
    } else {
      updateScore(1);
      ui.faceState.textContent = 'Stable';
      ui.faceState.className = 'metric-value small';
    }

    recordMetrics(movement);
  } catch (error) {
    setAgentStatus('Face detection failed in this browser. Use latest Chrome.', 'danger');
    stopSession();
  }
}

function updateScore(delta) {
  state.focusScore = Math.max(0, Math.min(100, state.focusScore + delta));
  ui.focusScore.textContent = String(state.focusScore);
}

function recordMetrics(movement) {
  state.focusHistory.push(state.focusScore);
  state.movementHistory.push(movement);

  if (state.focusHistory.length > 120) state.focusHistory.shift();
  if (state.movementHistory.length > 120) state.movementHistory.shift();
}

function summarizeFocus() {
  const count = state.focusHistory.length || 1;
  const average = Math.round(state.focusHistory.reduce((a, b) => a + b, 0) / count);
  return {
    average,
    awayFrames: state.noFaceFrames
  };
}

async function runAgentLoop() {
  if (!state.running) return;

  const avgScore = state.focusHistory.length
    ? Math.round(state.focusHistory.reduce((a, b) => a + b, 0) / state.focusHistory.length)
    : state.focusScore;

  const avgMovement = state.movementHistory.length
    ? Number((state.movementHistory.reduce((a, b) => a + b, 0) / state.movementHistory.length).toFixed(3))
    : 0;

  const payload = {
    goal: state.goal,
    score_now: state.focusScore,
    score_avg: avgScore,
    avg_face_movement: avgMovement,
    no_face_events: state.noFaceFrames,
    elapsed_min: Math.max(1, Math.round((Date.now() - state.startTs) / 60000))
  };

  const prompt = `You are FYX Agent, a focus coach that decides the next best action.

State:
${JSON.stringify(payload, null, 2)}

Return strict JSON:
{
  "status": "on_track" | "drifting" | "distracted",
  "coach_message": "one short message",
  "next_action": "continue" | "micro_break" | "recenter" | "hydrate",
  "reason": "one short reason"
}`;

  try {
    const text = await callGemini(prompt);
    const decision = parseJson(text);
    if (!decision) {
      addLog('Agent: unable to parse response, continuing session.');
      return;
    }

    const msg = `${decision.coach_message} (${decision.next_action})`;
    addLog(msg);

    if (decision.status === 'distracted') {
      setAgentStatus(`Attention dropped: ${decision.reason}`, 'danger');
    } else if (decision.status === 'drifting') {
      setAgentStatus(`Attention drifting: ${decision.reason}`, 'warn');
    } else {
      setAgentStatus('On track. Keep going.', 'normal');
    }
  } catch (error) {
    addLog('Agent call failed. Check API key/network and continue local tracking.');
  }
}

async function callGemini(prompt) {
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 220,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function setAgentStatus(text, level) {
  ui.agentStatus.textContent = text;
  ui.agentStatus.className = '';
  if (level === 'warn') ui.agentStatus.classList.add('status-warn');
  if (level === 'danger') ui.agentStatus.classList.add('status-danger');
}

function addLog(text) {
  const item = document.createElement('li');
  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  item.textContent = `${ts} - ${text}`;
  ui.agentLog.prepend(item);
  if (ui.agentLog.children.length > 8) {
    ui.agentLog.removeChild(ui.agentLog.lastChild);
  }
}

function ensureCanvasSize() {
  const rect = ui.video.getBoundingClientRect();
  ui.overlay.width = Math.round(rect.width);
  ui.overlay.height = Math.round(rect.height);
}

init();
