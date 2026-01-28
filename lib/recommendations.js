const CONTENT_RECOMMENDATIONS = {
    High: [
        'Long-form technical articles (15-30 min)',
        'University lectures and courses (20-60 min)',
        'Technical documentation and references',
        'Research papers and academic content',
        'Complex coding tutorials and projects'
    ],
    Medium: [
        'Blog posts and articles (5-10 min)',
        'Tutorial videos (10-20 min)',
        'Podcasts with visual aids',
        'Interactive coding exercises',
        'News articles with summaries'
    ],
    Low: [
        'Short videos (under 5 min)',
        'Social media and quick updates',
        'Quick reference cards and cheatsheets',
        'Interactive quizzes and games',
        'Bite-sized learning modules'
    ]
};

function getRecommendations(level) {
    return CONTENT_RECOMMENDATIONS[level] || CONTENT_RECOMMENDATIONS.Medium;
}

function getSwitchSuggestion(level, customSuggestions) {
    if (level === 'High') {
        return null;
    }

    const suggestions = customSuggestions || [];

    if (suggestions.length === 0) {
        return {
            title: 'Take a Short Break',
            description: 'Step away from the screen for a few minutes to reset your focus',
            url: null
        };
    }

    const randomIndex = Math.floor(Math.random() * suggestions.length);
    return suggestions[randomIndex];
}

function shouldShowSwitchSuggestion(level, previousLevel, consecutiveLowCount) {
    if (level === 'High') {
        return false;
    }

    if (level === 'Low' && consecutiveLowCount >= 2) {
        return true;
    }

    if (level === 'Medium' && previousLevel === 'Low') {
        return true;
    }

    return false;
}

export {
    getRecommendations,
    getSwitchSuggestion,
    shouldShowSwitchSuggestion,
    CONTENT_RECOMMENDATIONS
};
