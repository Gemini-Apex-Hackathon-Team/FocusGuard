// Break Recommendation Engine
// Analyzes session data and recommends breaks using Gemini

const BREAK_TYPES = {
    stretch: {
        id: 'stretch',
        name: '🤸 Quick Stretch',
        duration: 5,
        description: 'Stand up and stretch your muscles',
        icon: '🤸',
        tips: [
            'Stand and reach above your head',
            'Roll your shoulders backward',
            'Touch your toes (or get close)',
            'Rotate your head in circles',
            'Stretch your wrists and fingers'
        ]
    },
    walk: {
        id: 'walk',
        name: '🚶 Take a Walk',
        duration: 10,
        description: 'Walk around and get fresh air',
        icon: '🚶',
        tips: [
            'Walk around your room or house',
            'Go outside for fresh air',
            'Climb some stairs if available',
            'Walk to a different room',
            'Step outside for 2-3 minutes'
        ]
    },
    meditation: {
        id: 'meditation',
        name: '🧘 Meditate',
        duration: 15,
        description: 'Calm your mind with meditation',
        icon: '🧘',
        tips: [
            'Find a quiet place',
            'Sit comfortably',
            'Focus on your breathing',
            'Let thoughts pass without judgment',
            'Return to focus when ready'
        ]
    },
    hydration: {
        id: 'hydration',
        name: '💧 Hydrate',
        duration: 5,
        description: 'Drink water and rest your eyes',
        icon: '💧',
        tips: [
            'Drink a glass of water',
            'Look away from screen for 20 seconds',
            'Blink slowly 10 times',
            'Focus on distant object',
            'Refill your water bottle'
        ]
    },
    snack: {
        id: 'snack',
        name: '🍎 Healthy Snack',
        duration: 5,
        description: 'Grab a healthy snack',
        icon: '🍎',
        tips: [
            'Eat a piece of fruit',
            'Have some nuts',
            'Drink some tea',
            'Eat a yogurt',
            'Enjoy a light snack'
        ]
    }
};

function needsBreak(sessionDurationMinutes, attentionDropCount, userProfile) {
    // Recommend break based on:
    // 1. Time since last break
    // 2. Number of attention drops
    // 3. User's attention profile
    
    const recommendedInterval = userProfile.breakInterval || 45;
    
    // Condition 1: Time-based
    if (sessionDurationMinutes >= recommendedInterval) {
        return true;
    }
    
    // Condition 2: Too many attention drops (every 2 drops = break needed)
    if (attentionDropCount >= 2) {
        return true;
    }
    
    // Condition 3: Session at critical length
    if (sessionDurationMinutes >= (recommendedInterval * 1.5)) {
        return true;
    }
    
    return false;
}

function getBreakRecommendation(sessionDurationMinutes, attentionDropCount, userProfile) {
    // Return structure with reason and recommended breaks
    
    const recommendedInterval = userProfile.breakInterval || 45;
    let reason = '';
    let priority = 'normal'; // normal, urgent
    let recommendedDuration = 10;
    
    if (attentionDropCount >= 3) {
        reason = 'You\'ve been distracted ' + attentionDropCount + ' times. Your brain needs a reset!';
        priority = 'urgent';
        recommendedDuration = 15;
    } else if (sessionDurationMinutes >= recommendedInterval * 1.5) {
        reason = 'You\'ve been focusing for ' + Math.round(sessionDurationMinutes) + ' minutes. Time for a break!';
        priority = 'urgent';
        recommendedDuration = 15;
    } else if (sessionDurationMinutes >= recommendedInterval) {
        reason = 'You\'ve reached your recommended focus time. Take a well-earned break!';
        priority = 'normal';
        recommendedDuration = 10;
    } else if (attentionDropCount >= 2) {
        reason = 'Your attention is wavering. A quick break can help you refocus.';
        priority = 'normal';
        recommendedDuration = 5;
    }
    
    return {
        needsBreak: true,
        reason: reason,
        priority: priority,
        recommendedDuration: recommendedDuration,
        sessionDuration: sessionDurationMinutes,
        attentionDrops: attentionDropCount
    };
}

async function getGeminiBreakSuggestion(sessionData, contentType, apiKey) {
    if (!apiKey) {
        console.log('⏭️ No API key for Gemini break suggestions');
        return getDefaultBreakSuggestion(sessionData.duration, contentType);
    }
    
    const prompt = 'Based on a student learning session, suggest the best break:\n\n' +
        'Session Details:\n' +
        '- Duration: ' + sessionData.duration + ' minutes\n' +
        '- Content Type: ' + contentType + '\n' +
        '- Attention Drops: ' + sessionData.attentionDrops + '\n' +
        '- Focus Score: ' + Math.round(sessionData.focusScore * 100) + '%\n\n' +
        'Break options:\n' +
        '1. Stretch (5 min) - Physical movement\n' +
        '2. Walk (10 min) - Fresh air and movement\n' +
        '3. Meditate (15 min) - Mental reset\n' +
        '4. Hydrate (5 min) - Eye rest and water\n' +
        '5. Snack (5 min) - Healthy food\n\n' +
        'Respond with ONLY the break option number (1-5) and a 1-sentence explanation why. ' +
        'Format: "Number: Explanation"';
    
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });
        
        if (!response.ok) {
            throw new Error('Gemini API error');
        }
        
        const data = await response.json();
        const responseText = data.candidates[0].content.parts[0].text;
        
        // Parse response: "Number: Explanation"
        const match = responseText.match(/(\d):\s*(.*)/);
        if (match) {
            const number = parseInt(match[1]);
            const explanation = match[2];
            const breakOptions = Object.values(BREAK_TYPES);
            
            if (number >= 1 && number <= breakOptions.length) {
                return {
                    selectedBreak: breakOptions[number - 1],
                    explanation: explanation,
                    geminiSuggested: true
                };
            }
        }
        
        return getDefaultBreakSuggestion(sessionData.duration, contentType);
    } catch (error) {
        console.error('Gemini break suggestion failed:', error);
        return getDefaultBreakSuggestion(sessionData.duration, contentType);
    }
}

function getDefaultBreakSuggestion(durationMinutes, contentType) {
    let suggestedBreak;
    let explanation;
    
    // Choose break based on content type
    if (contentType === 'video') {
        suggestedBreak = BREAK_TYPES.hydration; // Eyes need rest from video
        explanation = 'Videos strain your eyes. Take a break and look away from the screen.';
    } else if (contentType === 'code') {
        suggestedBreak = BREAK_TYPES.walk; // Coding requires physical reset
        explanation = 'Coding requires intense focus. A walk will refresh your mind.';
    } else if (contentType === 'article') {
        suggestedBreak = BREAK_TYPES.stretch; // Light activity for reading
        explanation = 'Reading can lead to bad posture. Stand up and stretch!';
    } else {
        suggestedBreak = BREAK_TYPES.walk;
        explanation = 'You\'ve earned a break. Go take a short walk.';
    }
    
    return {
        selectedBreak: suggestedBreak,
        explanation: explanation,
        geminiSuggested: false
    };
}

function getBreakOptions() {
    return Object.values(BREAK_TYPES);
}

function getBreakById(breakId) {
    return BREAK_TYPES[breakId];
}

function getBreakTips(breakId) {
    const breakType = BREAK_TYPES[breakId];
    if (!breakType) return [];
    
    return breakType.tips;
}

function getMotivationalQuotes() {
    return [
        '💪 You\'re doing amazing!',
        '✨ Keep up the great work!',
        '🎯 You\'re crushing your goals!',
        '🌟 You\'re more focused than ever!',
        '🚀 Taking breaks makes you more productive!',
        '🧠 Rest is part of learning!',
        '❤️ You\'re taking care of yourself!',
        '🏆 Every break brings you closer to mastery!',
        '⚡ Energy restored = Better focus!',
        '🎉 You\'re building better study habits!'
    ];
}

function getRandomMotivationalQuote() {
    const quotes = getMotivationalQuotes();
    return quotes[Math.floor(Math.random() * quotes.length)];
}

export {
    BREAK_TYPES,
    needsBreak,
    getBreakRecommendation,
    getGeminiBreakSuggestion,
    getDefaultBreakSuggestion,
    getBreakOptions,
    getBreakById,
    getBreakTips,
    getMotivationalQuotes,
    getRandomMotivationalQuote
};
