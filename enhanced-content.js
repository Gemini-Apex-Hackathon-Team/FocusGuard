// Enhanced page content extraction for better Gemini quiz generation

function getEnhancedPageContent() {
    // Try to get main content using multiple strategies
    const article =
        document.querySelector('article') ||
        document.querySelector('[role="main"]') ||
        document.querySelector('.post-content') ||
        document.querySelector('.article-content') ||
        document.querySelector('main') ||
        document.body;

    // Extract paragraphs
    const paragraphs = Array.from(article.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(text => text.length > 50); // Filter out short paragraphs

    // Extract headings for structure
    const headings = Array.from(article.querySelectorAll('h1, h2, h3'))
        .map(h => h.textContent.trim());

    // Combine content
    const fullText = paragraphs.join('\n\n');

    // Detect content type
    let contentType = 'webpage';
    if (window.location.hostname.includes('youtube.com')) {
        contentType = 'video';
    } else if (document.querySelector('article')) {
        contentType = 'article';
    } else if (document.querySelector('.documentation') || document.querySelector('.docs')) {
        contentType = 'documentation';
    }

    return {
        text: fullText.substring(0, 2000), // Limit for API
        headings: headings.slice(0, 5),
        contentType: contentType,
        title: document.title,
        url: window.location.href,
        wordCount: fullText.split(' ').length,
        scrollPosition: window.scrollY,
        timeOnPage: Math.floor((Date.now() - engagementData.startTime) / 1000)
    };
}

// Show intelligent intervention based on user state
function showIntelligentIntervention(message) {
    const existing = document.getElementById('fyx-intervention-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fyx-intervention-overlay';
    overlay.className = 'fyx-overlay';

    const { state, data, sleepinessScore, distractionScore, attentionScore } = message;
    const stateInfo = getStateInfo(state);

    let content = '';

    // Different content based on state
    if (state === 'sleepy' || state === 'both') {
        // Activity suggestion for sleepy users
        content = `
      <div class="fyx-intervention-card ${state}">
        <div class="fyx-header">
          <span class="fyx-logo">${stateInfo.emoji} FYX</span>
          <button class="fyx-close" id="fyx-close-intervention">×</button>
        </div>
        
        <div class="fyx-state-indicator">
          <div class="fyx-state-label">${stateInfo.text}</div>
          <div class="fyx-state-scores">
            <span>💤 Sleepiness: ${Math.round(100 - (sleepinessScore || 50))}%</span>
            <span>📱 Distraction: ${Math.round(distractionScore)}%</span>
          </div>
        </div>
        
        <div class="fyx-activity-suggestion">
          <h3>${data.activity || 'Take a Break'} ${data.emoji || '☕'}</h3>
          <p class="fyx-activity-why">${data.why || 'Your energy is low. A quick break will help you refocus.'}</p>
          
          ${data.steps ? `
            <ol class="fyx-activity-steps">
              ${data.steps.map(step => `<li>${step}</li>`).join('')}
            </ol>
          ` : ''}
          
          <div class="fyx-activity-duration">
            ⏱️ ${data.duration || '5 minutes'}
          </div>
        </div>
        
        <div class="fyx-actions">
          <button class="fyx-btn fyx-btn-primary" id="fyx-take-break">Take Break Now</button>
          <button class="fyx-btn fyx-btn-secondary" id="fyx-continue">Maybe Later</button>
        </div>
      </div>
    `;
    } else if (state === 'distracted') {
        // Simple message for distracted users  (quiz shown separately)
        content = `
      <div class="fyx-intervention-card ${state}">
        <div class="fyx-header">
          <span class="fyx-logo">${stateInfo.emoji} FYX</span>
          <button class="fyx-close" id="fyx-close-intervention">×</button>
        </div>
        
        <div class="fyx-state-indicator">
          <div class="fyx-state-label">${stateInfo.text}</div>
          <div class="fyx-state-scores">
            <span>🎯 Focus: ${Math.round(attentionScore)}%</span>
            <span>📱 Distraction: ${Math.round(distractionScore)}%</span>
          </div>
        </div>
        
        <div class="fyx-message">
          ${data.message || 'Your attention seems to be wandering. A quick comprehension check might help refocus.'}
        </div>
        
        <div class="fyx-actions">
          <button class="fyx-btn fyx-btn-primary" id="fyx-continue">Got It</button>
        </div>
      </div>
    `;
    }

    overlay.innerHTML = content;
    document.body.appendChild(overlay);

    // Event listeners
    const closeBtn = document.getElementById('fyx-close-intervention');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => overlay.remove());
    }

    const takeBreakBtn = document.getElementById('fyx-take-break');
    if (takeBreakBtn) {
        takeBreakBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'REQUEST_BREAK' });
            overlay.remove();
        });
    }

    const continueBtn = document.getElementById('fyx-continue');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => overlay.remove());
    }

    // Auto-hide after 20 seconds
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }
    }, 20000);
}

// Show contextual quiz based on page content
function showContextualQuiz(message) {
    const existing = document.getElementById('fyx-quiz-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fyx-quiz-overlay';
    overlay.className = 'fyx-overlay';

    const { data, state, distractionScore } = message;
    const startTime = Date.now();

    overlay.innerHTML = `
    <div class="fyx-quiz-card contextual">
      <div class="fyx-header">
        <span class="fyx-logo">🧠 FYX Focus Check</span>
      </div>
      
      <div class="fyx-quiz-context">
        <div class="fyx-quiz-label">📱 Distraction detected: ${Math.round(distractionScore)}%</div>
        <p>Let's check if you've been absorbing the content...</p>
      </div>
      
      <div class="fyx-quiz-question">
        ${data.question || 'Are you staying focused on this content?'}
      </div>
      
      <div class="fyx-quiz-options">
        ${(data.options || ['Yes', 'Somewhat', 'No']).map((option, index) => `
          <button class="fyx-quiz-option" data-index="${index}">
            ${option}
          </button>
        `).join('')}
      </div>
      
      <div class="fyx-quiz-timer">⏱️ Time's ticking...</div>
    </div>
  `;

    document.body.appendChild(overlay);

    // Handle option selection
    overlay.querySelectorAll('.fyx-quiz-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedIndex = parseInt(e.target.dataset.index);
            const correct = selectedIndex === (data.correctIndex || 0);
            const timeTaken = Date.now() - startTime;

            // Show result
            showQuizResult(overlay, correct, data.explanation || 'Keep focusing!');

            // Send result to background
            chrome.runtime.sendMessage({
                type: 'QUIZ_COMPLETED',
                correct: correct,
                timeTaken: timeTaken
            });
        });
    });
}

// Helper function to get state info
function getStateInfo(state) {
    const stateMap = {
        focused: { emoji: '🎯', text: 'Focused & Alert', color: '#10b981' },
        sleepy: { emoji: '😴', text: 'Drowsiness Detected', color: '#f59e0b' },
        distracted: { emoji: '📱', text: 'Distraction Detected', color: '#ef4444' },
        both: { emoji: '⚠️', text: 'Critical: Drowsy & Distracted', color: '#dc2626' }
    };

    return stateMap[state] || stateMap.focused;
}

// Export content extraction for background use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getEnhancedPageContent,
        showIntelligentIntervention,
        showContextualQuiz
    };
}
