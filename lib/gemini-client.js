const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent';

let apiKey = null;

function setApiKey(key) {
    apiKey = key;
}

function getApiKey() {
    return apiKey;
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

async function analyzeImage(imageBase64, attentionScore, attentionLevel) {
    if (!apiKey) {
        throw new Error('API key not configured');
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
        throw new Error(error.error?.message || 'Gemini API request failed');
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    }

    throw new Error('Unexpected response format from Gemini API');
}

async function getContentRecommendations(url, attentionScore, attentionLevel) {
    if (!apiKey) {
        throw new Error('API key not configured');
    }

    let prompt = 'Based on the following information:\n\n';
    prompt += '- Current page URL: ' + url + '\n';
    prompt += '- User attention score: ' + attentionScore + ' (' + attentionLevel + ')\n\n';
    
    if (attentionLevel === 'Low') {
        prompt += 'The user\'s attention is LOW. Suggest 3-4 topics or content types that are:\n';
        prompt += '- Lighter and more engaging\n';
        prompt += '- Shorter form content\n';
        prompt += '- More interactive or stimulating\n';
        prompt += '- Related to the current page topic but easier to digest\n';
    } else if (attentionLevel === 'Medium') {
        prompt += 'The user\'s attention is MEDIUM. Suggest 3-4 topics or content types that are:\n';
        prompt += '- Related to the current page topic\n';
        prompt += '- Moderately engaging\n';
        prompt += '- Balance between depth and accessibility\n';
    } else {
        prompt += 'The user\'s attention is HIGH. Suggest 3-4 topics or content types that are:\n';
        prompt += '- Deeper dives into the current topic\n';
        prompt += '- More detailed or technical content\n';
        prompt += '- Advanced resources or research papers\n';
        prompt += '- Related but more challenging material\n';
    }
    
    prompt += '\nProvide only the list of content suggestions, one per line, without numbering or bullet points. Keep each suggestion brief (5-10 words). Do not use emojis.';

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
        throw new Error(error.error?.message || 'Gemini API request failed');
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
    analyzeImage,
    getContentRecommendations
};
