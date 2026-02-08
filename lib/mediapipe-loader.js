import { FaceLandmarker, PoseLandmarker, FilesetResolver } from './mediapipe/vision_bundle.mjs';

const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let faceLandmarker = null;
let poseLandmarker = null;
let isInitialized = false;
let gpuAvailable = false;

// Detect GPU availability
function detectGPU() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        gpuAvailable = !!gl;
        console.log('🖥️ GPU Detection: GPU ' + (gpuAvailable ? 'AVAILABLE ✓' : 'NOT AVAILABLE ✗'));
        return gpuAvailable;
    } catch (e) {
        console.log('🖥️ GPU Detection: Error checking GPU -', e.message);
        gpuAvailable = false;
        return false;
    }
}

async function initializeLandmarkers() {
    if (isInitialized) {
        console.log('📦 Models already initialized');
        return { faceLandmarker, poseLandmarker };
    }

    try {
        console.log('🚀 Initializing MediaPipe detection models...');
        
        // Check GPU availability
        detectGPU();
        
        const wasmPath = chrome.runtime.getURL('lib/mediapipe/wasm');
        console.log('📂 WASM path:', wasmPath);
        
        const filesetResolver = await FilesetResolver.forVisionTasks(wasmPath);
        console.log('✓ FilesetResolver created');

        console.log('📥 Loading Face Landmarker model...');
        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: FACE_MODEL_URL,
                delegate: gpuAvailable ? 'GPU' : 'CPU'
            },
            runningMode: 'IMAGE',
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            outputFaceBlendshapes: true
        });
        console.log('✓ Face Landmarker loaded (Delegate: ' + (gpuAvailable ? 'GPU' : 'CPU') + ')');

        console.log('📥 Loading Pose Landmarker model...');
        poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: POSE_MODEL_URL,
                delegate: gpuAvailable ? 'GPU' : 'CPU'
            },
            runningMode: 'IMAGE',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5
        });
        console.log('✓ Pose Landmarker loaded (Delegate: ' + (gpuAvailable ? 'GPU' : 'CPU') + ')');

        isInitialized = true;
        console.log('✅ All detection models initialized successfully');
        return { faceLandmarker, poseLandmarker };
    } catch (error) {
        console.error('❌ Failed to initialize models:', error);
        throw error;
    }
}

async function switchToVideoMode() {
    if (!isInitialized) {
        await initializeLandmarkers();
    }

    await faceLandmarker.setOptions({ runningMode: 'VIDEO' });
    await poseLandmarker.setOptions({ runningMode: 'VIDEO' });
}

async function switchToImageMode() {
    if (!isInitialized) {
        await initializeLandmarkers();
    }

    await faceLandmarker.setOptions({ runningMode: 'IMAGE' });
    await poseLandmarker.setOptions({ runningMode: 'IMAGE' });
}

function detectFace(image, timestamp) {
    if (!faceLandmarker) {
        throw new Error('Face landmarker not initialized');
    }

    try {
        const startTime = performance.now();
        let result;
        
        if (timestamp !== undefined) {
            result = faceLandmarker.detectForVideo(image, timestamp);
        } else {
            result = faceLandmarker.detect(image);
        }
        
        const endTime = performance.now();
        const processingTime = (endTime - startTime).toFixed(2);
        const faceDetected = result && result.faceLandmarks && result.faceLandmarks.length > 0;
        
        console.log(
            '👤 Face Analysis Complete | Detected: ' + (faceDetected ? '✓' : '✗') + 
            ' | Processing Time: ' + processingTime + 'ms | GPU: ' + (gpuAvailable ? '✓' : '✗')
        );
        
        return result;
    } catch (error) {
        console.error('❌ Face detection error:', error);
        throw error;
    }
}

function detectPose(image, timestamp) {
    if (!poseLandmarker) {
        throw new Error('Pose landmarker not initialized');
    }

    try {
        const startTime = performance.now();
        let result;
        
        if (timestamp !== undefined) {
            result = poseLandmarker.detectForVideo(image, timestamp);
        } else {
            result = poseLandmarker.detect(image);
        }
        
        const endTime = performance.now();
        const processingTime = (endTime - startTime).toFixed(2);
        const poseDetected = result && result.landmarks && result.landmarks.length > 0;
        
        console.log(
            '🧍 Pose Analysis Complete | Detected: ' + (poseDetected ? '✓' : '✗') + 
            ' | Processing Time: ' + processingTime + 'ms | GPU: ' + (gpuAvailable ? '✓' : '✗')
        );
        
        return result;
    } catch (error) {
        console.error('❌ Pose detection error:', error);
        throw error;
    }
}

function cleanup() {
    if (faceLandmarker) {
        faceLandmarker.close();
        faceLandmarker = null;
    }
    if (poseLandmarker) {
        poseLandmarker.close();
        poseLandmarker = null;
    }
    isInitialized = false;
}

export {
    initializeLandmarkers,
    switchToVideoMode,
    switchToImageMode,
    detectFace,
    detectPose,
    cleanup
};
