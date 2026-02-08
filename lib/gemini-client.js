const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';

let apiKey = null;
let lastQuotaExceededTime = null;
let quotaCooldownMs = 60000; // 1 minute cooldown after quota exceeded

function setApiKey(key) {
    apiKey = key;
}

function getApiKey() {
    return apiKey;
}

function isQuotaExceeded() {
    if (!lastQuotaExceededTime) {
        return false;
    }
    
    const timeSinceQuotaError = Date.now() - lastQuotaExceededTime;
    return timeSinceQuotaError < quotaCooldownMs;
}

function getRemainingCooldown() {
    if (!lastQuotaExceededTime) {
        return 0;
    }
    
    const timeSinceQuotaError = Date.now() - lastQuotaExceededTime;
    const remaining = quotaCooldownMs - timeSinceQuotaError;
    return remaining > 0 ? remaining : 0;
}

async function testConnection(key) {
    const testUrl = GEMINI_API_URL + '?key=' + key;

    const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: 'Reply with OK'
                }]
            }]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API connection failed');
    }

    return true;
}

async function analyzeLandmarks(landmarkData, attentionScore, attentionLevel, poseData) {
    if (!apiKey) {
        throw new Error('API key not configured');
    }

    // Check if quota cooldown is active
    if (isQuotaExceeded()) {
        const remainingSeconds = Math.ceil(getRemainingCooldown() / 1000);
        const error = new Error('Quota exceeded - cooldown active. Please wait ' + remainingSeconds + ' seconds.');
        error.isQuotaError = true;
        error.retryAfter = remainingSeconds;
        throw error;
    }

    const prompt = 'Analyze this facial and pose landmark data to assess attention state.\n\n' +
        'Based on the landmark positions and metrics:\n' +
        '1. Describe the person\'s apparent attention state in 1-2 sentences\n' +
        '2. Note which specific metrics indicate their focus level (head position, eye position, body alignment)\n' +
        '3. If attention is low, suggest one specific action they could take to improve focus\n\n' +
        'The automated system detected an attention score of ' + attentionScore + ' (' + attentionLevel + ').\n\n' +
        'Landmark Data:\n' + JSON.stringify(landmarkData, null, 2) + '\n\n' +
        (poseData ? 'Pose Data:\n' + JSON.stringify(poseData, null, 2) + '\n\n' : '') +
        'Keep your response brief, practical, and actionable. Do not use emojis.';

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };

    const response = await fetch(GEMINI_API_URL + '?key=' + apiKey, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error?.message || 'Gemini API request failed';
        
        // Check if this is a quota error (429)
        if (response.status === 429 || errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
            lastQuotaExceededTime = Date.now();
            console.warn('⚠️ Quota exceeded! Cooldown activated for 60 seconds.');
            
            const quotaError = new Error(errorMessage);
            quotaError.isQuotaError = true;
            quotaError.retryAfter = 60;
            throw quotaError;
        }
        
        throw new Error(errorMessage);
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    }

    throw new Error('Unexpected response format from Gemini API');
}

async function analyzeImage(imageBase64, attentionScore, attentionLevel) {
    if (!apiKey) {
        throw new Error('API key not configured');
    }

    // Check if quota cooldown is active
    if (isQuotaExceeded()) {
        const remainingSeconds = Math.ceil(getRemainingCooldown() / 1000);
        const error = new Error('Quota exceeded - cooldown active. Please wait ' + remainingSeconds + ' seconds.');
        error.isQuotaError = true;
        error.retryAfter = remainingSeconds;
        throw error;
    }

    const prompt = 'Analyze this image of a person. Based on their posture, facial expression, and body language:\n\n' +
        '1. Describe their apparent attention state in 1-2 sentences\n' +
        '2. Note any specific indicators you observe such as eye direction, posture, or head position\n' +
        '3. If attention seems low, suggest one specific action they could take to improve focus\n\n' +
        'The automated system detected an attention score of ' + attentionScore + ' (' + attentionLevel + ').\n\n' +
        'Keep your response brief, practical, and actionable. Do not use emojis.';

    const requestBody = {
        contents: [{
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageBase64
                    }
                },
                {
                    text: prompt
                }
            ]
        }]
    };

    const response = await fetch(GEMINI_API_URL + '?key=' + apiKey, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error?.message || 'Gemini API request failed';
        
        // Check if this is a quota error (429)
        if (response.status === 429 || errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
            lastQuotaExceededTime = Date.now();
            console.warn('⚠️ Quota exceeded! Cooldown activated for 60 seconds.');
            
            const quotaError = new Error(errorMessage);
            quotaError.isQuotaError = true;
            quotaError.retryAfter = 60;
            throw quotaError;
        }
        
        throw new Error(errorMessage);
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    }

    throw new Error('Unexpected response format from Gemini API');
}

export {
    setApiKey,
    getApiKey,
    testConnection,
    analyzeLandmarks,
    analyzeImage,
    isQuotaExceeded,
    getRemainingCooldown
};
