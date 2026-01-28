import { FaceLandmarker, PoseLandmarker, FilesetResolver } from './mediapipe/vision_bundle.mjs';

const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let faceLandmarker = null;
let poseLandmarker = null;
let isInitialized = false;

async function initializeLandmarkers() {
    if (isInitialized) {
        return { faceLandmarker, poseLandmarker };
    }

    const wasmPath = chrome.runtime.getURL('lib/mediapipe/wasm');
    const filesetResolver = await FilesetResolver.forVisionTasks(wasmPath);

    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: FACE_MODEL_URL,
            delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        outputFaceBlendshapes: true
    });

    poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: POSE_MODEL_URL,
            delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5
    });

    isInitialized = true;
    return { faceLandmarker, poseLandmarker };
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

    if (timestamp !== undefined) {
        return faceLandmarker.detectForVideo(image, timestamp);
    }
    return faceLandmarker.detect(image);
}

function detectPose(image, timestamp) {
    if (!poseLandmarker) {
        throw new Error('Pose landmarker not initialized');
    }

    if (timestamp !== undefined) {
        return poseLandmarker.detectForVideo(image, timestamp);
    }
    return poseLandmarker.detect(image);
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
