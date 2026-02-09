// FYX Onboarding JavaScript

let currentStep = 1;
const totalSteps = 5;
let userName = '';
let selectedLevel = null; // low, medium, high
let cameraTracker = null;
let calibrationStep = 0; // 0=not started, 1=normal, 2=smile, 3=look_away
let faceCalibration = {};
let cameraStream = null;
let faceDetectedForCapture = false;

// Attention level mapping
const levelMap = { low: 3, medium: 5, high: 8 };

document.addEventListener('DOMContentLoaded', () => {
  setupAttentionCards();
  setupNavigation();
  setupCalibration();
  updateUI();
});

// Setup attention card selection
function setupAttentionCards() {
  const cards = document.querySelectorAll('.attention-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedLevel = card.dataset.level;
    });
  });
}

// Setup navigation
function setupNavigation() {
  document.getElementById('btn-next').addEventListener('click', nextStep);
  document.getElementById('btn-back').addEventListener('click', prevStep);
}

// Setup face calibration
function setupCalibration() {
  document.getElementById('skip-calibration')?.addEventListener('click', () => {
    stopCalibrationCamera();
    currentStep++;
    updateUI();
  });

  document.getElementById('cal-capture-btn')?.addEventListener('click', captureCalibration);
}

async function nextStep() {
  // Validate current step
  if (currentStep === 1) {
    userName = document.getElementById('user-name-input').value.trim();
    if (!userName) {
      document.getElementById('user-name-input').focus();
      document.getElementById('user-name-input').style.borderColor = '#ef4444';
      return;
    }
  }

  if (currentStep === 2) {
    if (!selectedLevel) {
      return; // Must select attention level
    }
  }

  if (currentStep < totalSteps) {
    currentStep++;
    updateUI();

    // Start camera when entering calibration step
    if (currentStep === 4) {
      startCalibrationCamera();
    }
  } else {
    await completeOnboarding();
  }
}

function prevStep() {
  if (currentStep === 4) {
    stopCalibrationCamera();
  }
  if (currentStep > 1) {
    currentStep--;
    updateUI();
  }
}

function updateUI() {
  // Hide all steps
  document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${currentStep}`).classList.add('active');

  // Back button
  document.getElementById('btn-back').style.display = currentStep > 1 ? 'block' : 'none';

  // Next button text
  const nextBtn = document.getElementById('btn-next');
  if (currentStep === 1) nextBtn.textContent = 'Get Started';
  else if (currentStep === 4) nextBtn.textContent = 'Skip & Continue';
  else if (currentStep === totalSteps) nextBtn.textContent = 'Start Using FYX';
  else nextBtn.textContent = 'Next';

  // Disable next on step 1 if no name
  if (currentStep === 1) {
    const nameInput = document.getElementById('user-name-input');
    nextBtn.disabled = !nameInput.value.trim();
    nameInput.addEventListener('input', () => {
      nextBtn.disabled = !nameInput.value.trim();
      nameInput.style.borderColor = nameInput.value.trim() ? 'rgba(255,255,255,0.15)' : '#ef4444';
    });
  } else if (currentStep === 2) {
    nextBtn.disabled = !selectedLevel;
    // Re-check when card is clicked
    document.querySelectorAll('.attention-card').forEach(card => {
      card.addEventListener('click', () => { nextBtn.disabled = false; });
    });
  } else {
    nextBtn.disabled = false;
  }

  // Progress dots
  const dots = document.querySelectorAll('.progress-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('active', 'completed');
    if (i === currentStep - 1) dot.classList.add('active');
    else if (i < currentStep - 1) dot.classList.add('completed');
  });
}

// === FACE CALIBRATION ===

async function startCalibrationCamera() {
  const video = document.getElementById('cal-video');
  const canvas = document.getElementById('cal-canvas');
  const captureBtn = document.getElementById('cal-capture-btn');
  const instructionEl = document.getElementById('cal-instruction');

  captureBtn.disabled = true;
  instructionEl.textContent = 'Requesting camera access...';

  try {
    // Request camera first
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }
    });
    video.srcObject = cameraStream;
    await video.play();

    instructionEl.textContent = 'Camera active. Loading face detection...';

    // Create tracker instance
    if (typeof CameraTracker !== 'undefined') {
      cameraTracker = new CameraTracker();
      instructionEl.textContent = 'Initializing face tracker...';
      const initialized = await cameraTracker.initialize();
      if (!initialized) {
        instructionEl.textContent = 'Camera initialization failed. You can skip this step.';
        return;
      }

      if (cameraTracker.detectorMode === 'camera-only') {
        instructionEl.textContent = 'Camera-only mode: facial calibration unavailable here. Use Skip & Continue.';
        captureBtn.disabled = true;
      }

      // Use onboarding-owned stream
      if (cameraTracker.stream) {
        cameraTracker.stream.getTracks().forEach(t => t.stop());
      }
      cameraTracker.stream = cameraStream;
      cameraTracker.video = video;
      cameraTracker.canvas = canvas;
      cameraTracker.ctx = canvas.getContext('2d');
      cameraTracker.isRunning = true;

      // Listen for face detection events to enable capture button
      window.addEventListener('sleepinessMetrics', (event) => {
        const metrics = event.detail;
        faceDetectedForCapture = metrics.faceDetected;

        // Update UI based on face detection
        if (faceDetectedForCapture && calibrationStep >= 1 && calibrationStep <= 3) {
          if (metrics.detectorMode === 'camera-only') {
            captureBtn.disabled = true;
            captureBtn.style.opacity = '0.5';
          } else {
            captureBtn.disabled = false;
            captureBtn.style.opacity = '1';
          }
        } else if (!faceDetectedForCapture) {
          captureBtn.disabled = true;
          captureBtn.style.opacity = '0.5';
          if (calibrationStep >= 1 && calibrationStep <= 3) {
            instructionEl.textContent = 'Position your face in the camera frame...';
          }
        }
      });

      // Start processing frames
      cameraTracker.processFrame();

      calibrationStep = 1;
      updateCalibrationUI();

      console.log('[FYX] Face calibration camera started successfully');
    } else {
      instructionEl.textContent = 'Face detection not available. You can skip this step.';
      console.error('[FYX] CameraTracker class not found');
    }

  } catch (error) {
    console.error('[FYX] Camera access denied:', error);
    instructionEl.textContent = 'Camera access denied. You can skip this step.';
    captureBtn.disabled = true;
  }
}

function stopCalibrationCamera() {
  if (cameraTracker) {
    cameraTracker.isRunning = false;
    cameraTracker = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

function updateCalibrationUI() {
  const labels = {
    1: { label: 'Step 1: Look at the screen normally', instruction: 'Keep your normal posture and click Capture' },
    2: { label: 'Step 2: Move a little', instruction: 'Slightly shift your head, then click Capture' },
    3: { label: 'Step 3: Look to the side', instruction: 'Turn your head slightly to the side and click Capture' }
  };

  const step = labels[calibrationStep];
  if (step) {
    document.getElementById('cal-step-label').textContent = step.label;
    document.getElementById('cal-instruction').textContent = step.instruction;
  }

  // Enable capture button only if face is detected
  const captureBtn = document.getElementById('cal-capture-btn');
  captureBtn.disabled = !faceDetectedForCapture;
  captureBtn.textContent = 'Capture';
  captureBtn.style.background = '';

  // Update dots
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`cal-dot-${i}`);
    dot.classList.remove('active', 'done');
    if (i < calibrationStep) dot.classList.add('done');
    else if (i === calibrationStep) dot.classList.add('active');
  }
}

function captureCalibration() {
  if (!cameraTracker || !cameraTracker.isRunning) {
    console.warn('[FYX] Camera tracker not running');
    return;
  }

  if (!cameraTracker.lastFaceBox) {
    document.getElementById('cal-instruction').textContent = 'No face detected yet. Make sure your face is visible in the frame.';
    return;
  }

  const types = { 1: 'normal', 2: 'smile', 3: 'look_away' };
  const type = types[calibrationStep];

  if (type) {
    const result = cameraTracker.calibrate(type);
    Object.assign(faceCalibration, result);

    console.log(`[FYX] Calibration capture "${type}":`, result);

    // Flash the capture button
    const btn = document.getElementById('cal-capture-btn');
    btn.textContent = 'Captured!';
    btn.style.background = '#10b981';
    btn.disabled = true;

    setTimeout(() => {
      calibrationStep++;
      if (calibrationStep > 3) {
        // Calibration complete
        document.getElementById('cal-step-label').textContent = 'Calibration complete!';
        document.getElementById('cal-instruction').textContent = 'FYX now knows your facial patterns. Great job!';
        btn.disabled = true;
        btn.textContent = 'Done';
        btn.style.background = '#10b981';

        // Update all dots to done
        for (let i = 1; i <= 3; i++) {
          document.getElementById(`cal-dot-${i}`).classList.add('done');
          document.getElementById(`cal-dot-${i}`).classList.remove('active');
        }

        // Auto-advance after 1.5s
        setTimeout(() => {
          stopCalibrationCamera();
          currentStep++;
          updateUI();
        }, 1500);
      } else {
        updateCalibrationUI();
      }
    }, 800);
  }
}

// === COMPLETE ONBOARDING ===

async function completeOnboarding() {
  const attentionLevel = levelMap[selectedLevel] || 5;

  const config = {
    attentionLevel: attentionLevel,
    attentionCategory: selectedLevel, // low/medium/high
    blockedSites: [],
    allowedSites: [],
    quizFrequency: selectedLevel === 'low' ? 10 : selectedLevel === 'medium' ? 15 : 20,
    enableFaceTracking: true,
    enableContentQuiz: true,
    enableInterventions: true,
    enableBreaks: true,
    cameraEnabled: Object.keys(faceCalibration).length > 0
  };

  await chrome.storage.local.set({
    userConfig: config,
    userName: userName,
    faceCalibration: faceCalibration,
    onboarded: true,
    onboardingDate: new Date().toISOString()
  });

  // Show success animation
  showSuccessMessage();

  setTimeout(() => {
    window.close();
  }, 2500);
}

function showSuccessMessage() {
  const container = document.querySelector('.onboarding-container');
  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px;">
      <div style="font-size: 80px; margin-bottom: 24px;">✨</div>
      <h2 style="font-size: 32px; color: #f1f5f9; margin-bottom: 16px; font-weight: 800;">
        Welcome, ${userName}!
      </h2>
      <p style="font-size: 18px; color: rgba(255,255,255,0.6); margin-bottom: 32px;">
        Your focus journey starts now
      </p>
      <div style="display: flex; justify-content: center; gap: 8px;">
        <div style="width: 12px; height: 12px; background: #818cf8; border-radius: 50%; animation: bounce 0.6s infinite;"></div>
        <div style="width: 12px; height: 12px; background: #a78bfa; border-radius: 50%; animation: bounce 0.6s 0.2s infinite;"></div>
        <div style="width: 12px; height: 12px; background: #c084fc; border-radius: 50%; animation: bounce 0.6s 0.4s infinite;"></div>
      </div>
    </div>
    <style>
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-12px); }
      }
    </style>
  `;
}
