const video = document.getElementById('v');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let detector = null;
let started = false;
let heartbeatTimer = null;
let signalTimer = null;
let streamRef = null;

async function maybeInitDetector() {
  if (!('FaceDetector' in self)) return null;
  try {
    detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    return detector;
  } catch {
    return null;
  }
}

function send(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function analyzeFrame() {
  if (!started) return;

  let facePresent = null;
  let lookingAway = null;
  let eyesClosed = null;

  try {
    if (detector) {
      const faces = await detector.detect(video);
      facePresent = faces.length > 0;
      lookingAway = false;
      eyesClosed = false;

      if (facePresent) {
        const box = faces[0].boundingBox;
        const cx = box.x + box.width / 2;
        const frameCx = (video.videoWidth || 320) / 2;
        const offset = Math.abs(cx - frameCx) / (video.videoWidth || 320);
        lookingAway = offset > 0.2;
      }
    }
  } catch {
    // keep defaults
  }

  send({
    type: 'CAMERA_SIGNAL',
    ts: Date.now(),
    facePresent,
    eyesClosed,
    lookingAway,
    detectorMode: detector ? 'FaceDetector' : 'camera-only'
  });
}

async function startCamera() {
  if (started) return;

  try {
    await maybeInitDetector();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: 'user' },
      audio: false
    });

    streamRef = stream;
    video.srcObject = stream;
    await video.play();

    started = true;

    send({
      type: 'CAMERA_STATUS',
      ok: true,
      detector: detector ? 'FaceDetector' : 'camera-only'
    });

    heartbeatTimer = setInterval(() => {
      send({
        type: 'CAMERA_HEARTBEAT',
        ts: Date.now(),
        readyState: video.readyState
      });
    }, 1000);

    signalTimer = setInterval(analyzeFrame, 500);
  } catch (e) {
    send({
      type: 'CAMERA_STATUS',
      ok: false,
      error: String(e)
    });
  }
}

function stopCamera() {
  started = false;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (signalTimer) {
    clearInterval(signalTimer);
    signalTimer = null;
  }
  if (streamRef) {
    streamRef.getTracks().forEach((t) => t.stop());
    streamRef = null;
  }
  video.srcObject = null;
  send({ type: 'CAMERA_STATUS', ok: false, stopped: true });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OFFSCREEN_CAMERA_START') {
    startCamera().then(() => sendResponse({ success: true })).catch((e) => sendResponse({ success: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'OFFSCREEN_CAMERA_STOP') {
    stopCamera();
    sendResponse({ success: true });
    return true;
  }
});
