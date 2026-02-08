// Learning Session Manager
// Handles: URL paste, content fetching, quiz generation, session tracking

const LEARNING_DOMAINS = [
    'youtube.com',
    'coursera.org',
    'udemy.com',
    'medium.com',
    'dev.to',
    'wikipedia.org',
    'arxiv.org',
    'github.com',
    'freecodecamp.org',
    'linkedin.com/learning',
    'khanacademy.org'
];

let currentSession = null;

function isLearningContent(url) {
    return LEARNING_DOMAINS.some(domain => url.includes(domain));
}

async function fetchUrlContent(url) {
    console.log('📥 Fetching content from URL:', url);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch URL: ' + response.status);
        }
        
        const html = await response.text();
        const title = extractPageTitle(html);
        const content = extractMainContent(html);
        
        console.log('✓ Content fetched. Title:', title);
        console.log('✓ Content length:', content.length, 'characters');
        
        return {
            url,
            title,
            content,
            fetchedAt: Date.now()
        };
    } catch (error) {
        console.error('❌ Failed to fetch URL:', error);
        throw error;
    }
}

function extractPageTitle(html) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
        return titleMatch[1].trim();
    }
    
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) {
        return h1Match[1].trim();
    }
    
    return 'Unknown Title';
}

function extractMainContent(html) {
    // Remove script and style tags
    let content = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove HTML tags
    content = content.replace(/<[^>]+>/g, ' ');
    
    // Remove extra whitespace
    content = content.replace(/\s+/g, ' ').trim();
    
    // Limit to 5000 characters for API efficiency
    return content.substring(0, 5000);
}

function createSessionObject(url, content, title) {
    return {
        sessionId: Date.now(),
        url,
        title,
        content,
        startTime: Date.now(),
        endTime: null,
        attentionEvents: [],  // Track attention drops
        quizzes: [],          // Track quizzes shown
        totalDuration: 0,
        focusPercentage: 0,
        isActive: true
    };
}

async function startLearningSession(url) {
    console.log('🎓 Starting learning session for:', url);
    
    try {
        // Fetch content
        const urlData = await fetchUrlContent(url);
        
        // Create session object
        currentSession = createSessionObject(urlData.url, urlData.content, urlData.title);
        
        console.log('✅ Learning session started:', currentSession.sessionId);
        
        return currentSession;
    } catch (error) {
        console.error('❌ Failed to start learning session:', error);
        throw error;
    }
}

function endLearningSession() {
    if (!currentSession) {
        console.warn('⚠️ No active learning session');
        return null;
    }
    
    console.log('🛑 Ending learning session');
    
    currentSession.endTime = Date.now();
    currentSession.totalDuration = currentSession.endTime - currentSession.startTime;
    currentSession.isActive = false;
    
    // Calculate focus percentage
    const focusEvents = currentSession.attentionEvents.filter(e => e.level === 'High').length;
    const totalEvents = currentSession.attentionEvents.length;
    currentSession.focusPercentage = totalEvents > 0 ? Math.round((focusEvents / totalEvents) * 100) : 0;
    
    const sessionData = currentSession;
    currentSession = null;
    
    console.log('✅ Session ended. Duration: ' + Math.round(sessionData.totalDuration / 1000) + 's, Focus: ' + sessionData.focusPercentage + '%');
    
    return sessionData;
}

function getCurrentSession() {
    return currentSession;
}

function logAttentionEvent(attentionScore, attentionLevel) {
    if (!currentSession) {
        return;
    }
    
    currentSession.attentionEvents.push({
        timestamp: Date.now(),
        score: attentionScore,
        level: attentionLevel
    });
}

function logQuizShown(quiz) {
    if (!currentSession) {
        return;
    }
    
    currentSession.quizzes.push({
        timestamp: Date.now(),
        quiz: quiz,
        answered: false,
        correct: false
    });
}

function logQuizAnswer(quizIndex, correct) {
    if (!currentSession || !currentSession.quizzes[quizIndex]) {
        return;
    }
    
    currentSession.quizzes[quizIndex].answered = true;
    currentSession.quizzes[quizIndex].correct = correct;
    currentSession.quizzes[quizIndex].answeredAt = Date.now();
}

function getSessionSummary() {
    if (!currentSession && !currentSession) {
        return null;
    }
    
    const session = currentSession;
    return {
        title: session.title,
        url: session.url,
        duration: Math.round(session.totalDuration / 1000),
        focusPercentage: session.focusPercentage,
        attentionEventsCount: session.attentionEvents.length,
        quizzesShown: session.quizzes.length,
        quizzesAnswered: session.quizzes.filter(q => q.answered).length,
        correctAnswers: session.quizzes.filter(q => q.correct).length,
        startTime: new Date(session.startTime).toLocaleString(),
        endTime: session.endTime ? new Date(session.endTime).toLocaleString() : 'Ongoing'
    };
}

export {
    isLearningContent,
    fetchUrlContent,
    startLearningSession,
    endLearningSession,
    getCurrentSession,
    logAttentionEvent,
    logQuizShown,
    logQuizAnswer,
    getSessionSummary,
    LEARNING_DOMAINS
};
