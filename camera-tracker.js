// FYX Camera Tracker - CSP-safe face monitoring
// Uses browser FaceDetector API (no remote scripts/CDN required)

class CameraTracker {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.stream = null;
    this.isRunning = false;

    this.detector = null;
    this.detectorMode = 'face-detector'; // face-detector | camera-only
    this.faceDetected = false;
    this.faceAbsentSince = null;

    this.lastFaceBox = null;
    this.lastCenter = null;
    this.movementHistory = [];
    this.lastFrameTime = Date.now();

    this.sleepinessScore = 100;
    this.userState = 'focused'; // focused | looking_away | absent | bored

    this.calibratedCenter = null;
    this.calibratedArea = null;
    this.lookAwayThreshold = 0.12;
    this.motionThreshold = 0.04;
  }

  async initialize() {
    if (!('FaceDetector' in window)) {
      console.warn('[CameraTracker] FaceDetector API not available, using camera-only fallback');
      this.detectorMode = 'camera-only';
      return true;
    }

    try {
      this.detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      this.detectorMode = 'face-detector';
      return true;
    } catch (error) {
      console.warn('[CameraTracker] Failed to initialize FaceDetector, using camera-only fallback:', error);
      this.detectorMode = 'camera-only';
      return true;
    }
  }

  async requestCameraAccess() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 20 }
        }
      });
      return true;
    } catch (error) {
      console.error('[CameraTracker] Camera access denied:', error);
      return false;
    }
  }

  async start(videoElement, canvasElement) {
    if (this.isRunning) return;

    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    const hasAccess = await this.requestCameraAccess();
    if (!hasAccess) {
      throw new Error('Camera access denied');
    }

    this.video.srcObject = this.stream;
    await this.video.play();

    this.isRunning = true;
    this.processFrame();

    console.log('[CameraTracker] Started (FaceDetector mode)');
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }

    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    console.log('[CameraTracker] Stopped');
  }

  async processFrame() {
    if (!this.isRunning || !this.video) return;

    try {
      if (this.detectorMode === 'face-detector' && this.detector) {
        const faces = await this.detector.detect(this.video);
        this.onResults(faces || []);
      } else {
        this.onFallbackResults();
      }
    } catch (error) {
      console.error('[CameraTracker] Frame processing error:', error);
      this.onFallbackResults();
    }

    if (this.isRunning) {
      setTimeout(() => this.processFrame(), 100);
    }
  }

  onResults(faces) {
    const now = Date.now();
    this.lastFrameTime = now;

    this.prepareCanvas();

    if (faces.length === 0) {
      this.faceDetected = false;
      if (!this.faceAbsentSince) this.faceAbsentSince = now;
      this.userState = 'absent';
      this.sleepinessScore = 0;
      this.dispatchMetrics();
      return;
    }

    this.faceDetected = true;
    this.faceAbsentSince = null;

    const box = faces[0].boundingBox;
    this.lastFaceBox = box;

    const center = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2
    };

    const frameW = this.canvas?.width || this.video.videoWidth || 640;
    const frameH = this.canvas?.height || this.video.videoHeight || 480;
    const frameDiag = Math.sqrt(frameW * frameW + frameH * frameH) || 1;

    let movement = 0;
    if (this.lastCenter) {
      const dx = center.x - this.lastCenter.x;
      const dy = center.y - this.lastCenter.y;
      movement = Math.sqrt(dx * dx + dy * dy) / frameDiag;
    }
    this.lastCenter = center;

    this.movementHistory.push(movement);
    if (this.movementHistory.length > 120) this.movementHistory.shift();

    const avgMovement = this.movementHistory.length
      ? this.movementHistory.reduce((a, b) => a + b, 0) / this.movementHistory.length
      : 0;

    const area = box.width * box.height;
    const areaDelta = this.calibratedArea
      ? Math.abs(area - this.calibratedArea) / Math.max(this.calibratedArea, 1)
      : 0;

    const centerOffset = this.calibratedCenter
      ? Math.hypot(center.x - this.calibratedCenter.x, center.y - this.calibratedCenter.y) / frameDiag
      : 0;

    const lookingAway = centerOffset > this.lookAwayThreshold;
    const restless = avgMovement > this.motionThreshold || areaDelta > 0.35;

    if (lookingAway) {
      this.userState = 'looking_away';
    } else if (restless) {
      this.userState = 'bored';
    } else {
      this.userState = 'focused';
    }

    // Proxy score from face stability + presence (not eye-blink based)
    let score = 100;
    score -= Math.min(55, avgMovement * 1200);
    score -= Math.min(35, centerOffset * 500);
    score -= Math.min(20, areaDelta * 80);
    if (lookingAway) score -= 15;

    this.sleepinessScore = Math.max(0, Math.min(100, Math.round(score)));

    this.drawFaceBox(box, this.userState);
    this.dispatchMetrics(avgMovement, centerOffset);
  }

  onFallbackResults() {
    const now = Date.now();
    this.prepareCanvas();
    this.lastFaceBox = null;
    this.faceDetected = false;
    if (!this.faceAbsentSince) this.faceAbsentSince = now;
    this.userState = 'absent';
    this.sleepinessScore = 0;
    this.dispatchMetrics(0, 0);
  }

  prepareCanvas() {
    if (!this.canvas || !this.ctx || !this.video) return;
    if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
      this.canvas.width = this.video.videoWidth || 640;
      this.canvas.height = this.video.videoHeight || 480;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawFaceBox(box, state) {
    if (!this.ctx || !this.canvas) return;

    const color = state === 'focused' ? '#10b981' : state === 'looking_away' ? '#f59e0b' : '#ef4444';
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(box.x, box.y, box.width, box.height);
  }

  calibrate(type) {
    if (!this.lastFaceBox) {
      console.warn('[CameraTracker] No face box available for calibration');
      return {};
    }

    const box = this.lastFaceBox;
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    if (type === 'normal') {
      this.calibratedCenter = center;
      this.calibratedArea = box.width * box.height;
    } else if (type === 'smile') {
      // No facial landmarks in FaceDetector; use this step to calibrate motion sensitivity.
      this.motionThreshold = Math.max(this.motionThreshold, 0.035);
    } else if (type === 'look_away' && this.calibratedCenter) {
      const frameW = this.canvas?.width || this.video.videoWidth || 640;
      const frameH = this.canvas?.height || this.video.videoHeight || 480;
      const frameDiag = Math.sqrt(frameW * frameW + frameH * frameH) || 1;
      const offset = Math.hypot(center.x - this.calibratedCenter.x, center.y - this.calibratedCenter.y) / frameDiag;
      this.lookAwayThreshold = Math.max(0.08, offset * 0.65);
    }

    return {
      normalCenter: this.calibratedCenter,
      normalArea: this.calibratedArea,
      motionThreshold: this.motionThreshold,
      lookAwayThreshold: this.lookAwayThreshold
    };
  }

  loadCalibration(data) {
    if (data.normalCenter) this.calibratedCenter = data.normalCenter;
    if (data.normalArea) this.calibratedArea = data.normalArea;
    if (data.motionThreshold) this.motionThreshold = data.motionThreshold;
    if (data.lookAwayThreshold) this.lookAwayThreshold = data.lookAwayThreshold;
  }

  dispatchMetrics(avgMovement = 0, centerOffset = 0) {
    const event = new CustomEvent('sleepinessMetrics', {
      detail: {
        leftEyeEAR: 0,
        rightEyeEAR: 0,
        avgEAR: 0,
        blinkCount: 0,
        lastBlinkDuration: 0,
        blinkRate: 0,
        perclos: 0,
        sleepinessScore: this.sleepinessScore,
        faceDetected: this.faceDetected,
        userState: this.userState,
        headPose: { yaw: centerOffset, pitch: 0 },
        avgMovement,
        faceAbsentDuration: this.faceAbsentSince ? Date.now() - this.faceAbsentSince : 0
        ,
        detectorMode: this.detectorMode
      }
    });

    window.dispatchEvent(event);
  }

  getMetrics() {
    return {
      sleepinessScore: this.sleepinessScore,
      userState: this.userState,
      faceDetected: this.faceDetected
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CameraTracker;
}
