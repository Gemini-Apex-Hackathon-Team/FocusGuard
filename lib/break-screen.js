// Break Screen
// Displays lock screen during break with timer and motivation

import { getRandomMotivationalQuote } from './break-recommender.js';

let activeBreakInterval = null;

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
}

function showBreakScreen(breakData, onBreakComplete) {
    console.log('☕ Showing break screen for: ' + breakData.duration + ' minutes');
    
    const breakDurationSeconds = breakData.duration * 60;
    let timeRemaining = breakDurationSeconds;
    
    const overlay = document.createElement('div');
    overlay.id = 'break-screen-overlay';
    overlay.className = 'break-screen-overlay';
    
    const screen = document.createElement('div');
    screen.className = 'break-screen-content';
    
    screen.innerHTML = `
        <div class="break-header">
            <div class="break-icon">${breakData.icon}</div>
            <h1>${breakData.name}</h1>
        </div>
        
        <div class="break-timer">
            <div class="timer-display" id="break-timer">${formatTime(breakDurationSeconds)}</div>
            <p class="timer-label">Take your time</p>
        </div>
        
        <div class="break-content">
            <h2>${breakData.description}</h2>
            
            <div class="break-tips" id="break-tips">
                <!-- Tips will be populated -->
            </div>
            
            <div class="break-progress">
                <div class="progress-bar">
                    <div class="progress-fill" id="break-progress-fill" style="width: 0%"></div>
                </div>
                <p class="progress-text" id="break-progress-text">0% complete</p>
            </div>
        </div>
        
        <div class="break-motivation">
            <p id="break-quote" class="motivation-quote">${getRandomMotivationalQuote()}</p>
        </div>
        
        <div class="break-stats">
            <div class="stat">
                <span class="stat-value" id="break-focus-avg">--</span>
                <span class="stat-label">Avg Focus</span>
            </div>
            <div class="stat">
                <span class="stat-value" id="break-session-time">--</span>
                <span class="stat-label">Session Time</span>
            </div>
            <div class="stat">
                <span class="stat-value" id="break-accuracy">--</span>
                <span class="stat-label">Quiz Accuracy</span>
            </div>
        </div>
        
        <button id="break-skip" class="break-button secondary">Skip Break</button>
    `;
    
    overlay.appendChild(screen);
    document.body.appendChild(overlay);
    
    // Populate tips
    const tipsContainer = screen.querySelector('#break-tips');
    if (breakData.tips && breakData.tips.length > 0) {
        tipsContainer.innerHTML = `
            <div class="tips-list">
                ${breakData.tips.map(tip => '<div class="tip-item">• ' + tip + '</div>').join('')}
            </div>
        `;
    }
    
    // Update stats from session
    updateBreakStats(screen);
    
    // Timer countdown
    activeBreakInterval = setInterval(() => {
        timeRemaining--;
        
        document.getElementById('break-timer').textContent = formatTime(timeRemaining);
        
        // Update progress
        const progress = ((breakDurationSeconds - timeRemaining) / breakDurationSeconds) * 100;
        document.getElementById('break-progress-fill').style.width = progress + '%';
        document.getElementById('break-progress-text').textContent = Math.round(progress) + '% complete';
        
        // Change quote every 30 seconds
        if (timeRemaining % 30 === 0 && timeRemaining !== breakDurationSeconds) {
            document.getElementById('break-quote').textContent = getRandomMotivationalQuote();
        }
        
        // Break complete
        if (timeRemaining <= 0) {
            clearInterval(activeBreakInterval);
            completeBreak(overlay, onBreakComplete);
        }
    }, 1000);
    
    // Skip button
    document.getElementById('break-skip').addEventListener('click', function() {
        clearInterval(activeBreakInterval);
        overlay.remove();
        if (onBreakComplete) onBreakComplete();
    });
    
    // Prevent closing the modal
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            e.stopPropagation();
        }
    });
}

function updateBreakStats(screenElement) {
    // These would be passed from popup.js session data
    // For now, show placeholders
    
    const focusAvg = screenElement.querySelector('#break-focus-avg');
    const sessionTime = screenElement.querySelector('#break-session-time');
    const accuracy = screenElement.querySelector('#break-accuracy');
    
    // Get from chrome storage or pass as param
    chrome.storage.local.get(['current_session'], function(result) {
        if (result.current_session) {
            const session = result.current_session;
            focusAvg.textContent = Math.round(session.focusScore * 100) + '%';
            
            const minutes = Math.floor(session.duration / 60);
            const seconds = session.duration % 60;
            sessionTime.textContent = minutes + 'm ' + seconds + 's';
            
            if (session.quizzesTaken > 0) {
                const acc = (session.quizzesCorrect / session.quizzesTaken) * 100;
                accuracy.textContent = Math.round(acc) + '%';
            } else {
                accuracy.textContent = '--';
            }
        }
    });
}

function completeBreak(overlay, onBreakComplete) {
    console.log('✅ Break completed!');
    
    // Show completion message
    const content = overlay.querySelector('.break-screen-content');
    content.innerHTML = `
        <div class="break-completion">
            <div class="completion-icon">🎉</div>
            <h1>Great Job!</h1>
            <p>You've completed your break.</p>
            <p class="completion-message">You're refreshed and ready to get back to learning!</p>
            
            <div class="completion-question">
                <h3>How's your focus now?</h3>
                <div class="feeling-options">
                    <button class="feeling-btn" data-feeling="1">😢 Still tired</button>
                    <button class="feeling-btn" data-feeling="3">😐 Okay</button>
                    <button class="feeling-btn" data-feeling="5">😊 Much better!</button>
                </div>
            </div>
            
            <button id="completion-resume" class="break-button primary">Resume Learning</button>
        </div>
    `;
    
    // Handle feeling selection
    content.querySelectorAll('.feeling-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const feeling = parseInt(this.getAttribute('data-feeling'));
            console.log('😊 User feeling after break:', feeling);
            chrome.storage.local.get(['current_session'], function(result) {
                if (result.current_session) {
                    result.current_session.postBreakFeeling = feeling;
                    result.current_session.lastBreakTime = Date.now();
                    chrome.storage.local.set({ current_session: result.current_session });
                }
            });
        });
    });
    
    // Resume button
    document.getElementById('completion-resume').addEventListener('click', function() {
        overlay.remove();
        if (onBreakComplete) onBreakComplete();
    });
}

function showFeelingCheckIn(currentSession) {
    console.log('💭 Showing feeling check-in');
    
    const modal = document.createElement('div');
    modal.className = 'feeling-modal';
    
    modal.innerHTML = `
        <div class="feeling-content">
            <h2>How are you feeling?</h2>
            <p>This helps us improve your experience</p>
            
            <div class="feeling-emoji-options">
                <button class="emoji-btn" data-feeling="1">
                    <span class="emoji">😢</span>
                    <span class="label">Frustrated</span>
                </button>
                <button class="emoji-btn" data-feeling="2">
                    <span class="emoji">😐</span>
                    <span class="label">Neutral</span>
                </button>
                <button class="emoji-btn" data-feeling="3">
                    <span class="emoji">🙂</span>
                    <span class="label">Good</span>
                </button>
                <button class="emoji-btn" data-feeling="4">
                    <span class="emoji">😊</span>
                    <span class="label">Great</span>
                </button>
                <button class="emoji-btn" data-feeling="5">
                    <span class="emoji">😄</span>
                    <span class="label">Excellent</span>
                </button>
            </div>
            
            <h3>What would help?</h3>
            <div class="help-checkboxes">
                <label class="checkbox">
                    <input type="checkbox" value="break">
                    <span>Take another break</span>
                </label>
                <label class="checkbox">
                    <input type="checkbox" value="simplify">
                    <span>Simplify the content</span>
                </label>
                <label class="checkbox">
                    <input type="checkbox" value="game">
                    <span>Try a focus game</span>
                </label>
                <label class="checkbox">
                    <input type="checkbox" value="motivation">
                    <span>Get some encouragement</span>
                </label>
            </div>
            
            <button id="feeling-close" class="modal-button">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle selections
    modal.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const feeling = parseInt(this.getAttribute('data-feeling'));
            console.log('😊 User feeling:', feeling);
            
            // Track feeling
            if (currentSession) {
                currentSession.emotionalState = feeling;
                currentSession.lastFeelingCheck = Date.now();
                chrome.storage.local.set({ current_session: currentSession });
            }
            
            btn.classList.add('selected');
        });
    });
    
    // Handle checkboxes
    modal.querySelectorAll('.checkbox input').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            console.log('✓ Help option selected:', this.value);
        });
    });
    
    // Close button
    document.getElementById('feeling-close').addEventListener('click', function() {
        modal.remove();
    });
}

function stopBreakTimer() {
    if (activeBreakInterval) {
        clearInterval(activeBreakInterval);
        activeBreakInterval = null;
        console.log('⏸️ Break timer stopped');
    }
}

export {
    showBreakScreen,
    showFeelingCheckIn,
    stopBreakTimer,
    formatTime
};
