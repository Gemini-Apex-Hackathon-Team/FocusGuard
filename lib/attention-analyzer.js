function analyzeFaceAttention(faceResult) {
    if (!faceResult || !faceResult.faceLandmarks || faceResult.faceLandmarks.length === 0) {
        return {
            detected: false,
            score: 0,
            details: {}
        };
    }

    const landmarks = faceResult.faceLandmarks[0];
    let score = 0;
    const details = {};

    const nose = landmarks[1];

    const headForward = nose.x > 0.35 && nose.x < 0.65;
    details.headForward = headForward;
    if (headForward) {
        score += 0.35;
    }

    const headLevel = nose.y > 0.3 && nose.y < 0.7;
    details.headLevel = headLevel;
    if (headLevel) {
        score += 0.15;
    }

    if (faceResult.faceBlendshapes && faceResult.faceBlendshapes.length > 0) {
        const blendshapes = {};
        faceResult.faceBlendshapes[0].categories.forEach(function(shape) {
            blendshapes[shape.categoryName] = shape.score;
        });

        const leftBlink = blendshapes.eyeBlinkLeft || 0;
        const rightBlink = blendshapes.eyeBlinkRight || 0;
        const eyesOpen = leftBlink < 0.5 && rightBlink < 0.5;
        details.eyesOpen = eyesOpen;
        if (eyesOpen) {
            score += 0.3;
        }

        const lookDownLeft = blendshapes.eyeLookDownLeft || 0;
        const lookDownRight = blendshapes.eyeLookDownRight || 0;
        const lookUpLeft = blendshapes.eyeLookUpLeft || 0;
        const lookUpRight = blendshapes.eyeLookUpRight || 0;

        const totalLookDown = lookDownLeft + lookDownRight;
        const totalLookUp = lookUpLeft + lookUpRight;

        const eyesCentered = totalLookDown < 0.6 && totalLookUp < 0.6;
        details.eyesCentered = eyesCentered;
        if (eyesCentered) {
            score += 0.2;
        }
    } else {
        details.eyesOpen = null;
        details.eyesCentered = null;
        score += 0.25;
    }

    return {
        detected: true,
        score: Math.min(score, 1.0),
        details
    };
}

function analyzePoseAttention(poseResult) {
    if (!poseResult || !poseResult.landmarks || poseResult.landmarks.length === 0) {
        return {
            detected: false,
            score: 0,
            details: {}
        };
    }

    const landmarks = poseResult.landmarks[0];
    let score = 0;
    const details = {};

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const shoulderYDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    const shouldersLevel = shoulderYDiff < 0.1;
    details.shouldersLevel = shouldersLevel;
    if (shouldersLevel) {
        score += 0.5;
    }

    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
    const bodyCentered = shoulderCenterX > 0.3 && shoulderCenterX < 0.7;
    details.bodyCentered = bodyCentered;
    if (bodyCentered) {
        score += 0.5;
    }

    return {
        detected: true,
        score: Math.min(score, 1.0),
        details
    };
}

function calculateAttentionScore(faceAnalysis, poseAnalysis) {
    if (!faceAnalysis.detected && !poseAnalysis.detected) {
        return {
            score: 0,
            level: 'Unknown',
            confidence: 0
        };
    }

    let faceWeight = faceAnalysis.detected ? 0.7 : 0;
    let poseWeight = poseAnalysis.detected ? 0.3 : 0;

    const totalWeight = faceWeight + poseWeight;
    if (totalWeight > 0) {
        faceWeight = faceWeight / totalWeight;
        poseWeight = poseWeight / totalWeight;
    }

    const score = (faceAnalysis.score * faceWeight) + (poseAnalysis.score * poseWeight);
    const roundedScore = Math.round(score * 100) / 100;

    let level;
    if (roundedScore >= 0.75) {
        level = 'High';
    } else if (roundedScore >= 0.5) {
        level = 'Medium';
    } else {
        level = 'Low';
    }

    const confidence = faceAnalysis.detected && poseAnalysis.detected ? 1 : 0.6;

    return {
        score: roundedScore,
        level,
        confidence
    };
}

function analyzeAttention(faceResult, poseResult) {
    const faceAnalysis = analyzeFaceAttention(faceResult);
    const poseAnalysis = analyzePoseAttention(poseResult);
    const scoreResult = calculateAttentionScore(faceAnalysis, poseAnalysis);

    return {
        face: faceAnalysis,
        pose: poseAnalysis,
        overall: scoreResult
    };
}

export {
    analyzeFaceAttention,
    analyzePoseAttention,
    calculateAttentionScore,
    analyzeAttention
};
