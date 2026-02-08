// Onboarding System
// Calibrates user's attention span on first install

const ONBOARDING_KEY = 'onboarding_completed';
const USER_PROFILE_KEY = 'user_attention_profile';

const ATTENTION_PROFILES = {
    very_short: {
        name: 'Very Short (0-15 min)',
        minutes: 15,
        baselineThreshold: 0.40,
        breakInterval: 10,
        description: 'You prefer frequent breaks and shorter focus sessions'
    },
    short: {
        name: 'Short (15-30 min)',
        minutes: 30,
        baselineThreshold: 0.50,
        breakInterval: 20,
        description: 'You work best with regular breaks every 15-20 minutes'
    },
    medium: {
        name: 'Medium (30-60 min)',
        minutes: 60,
        baselineThreshold: 0.60,
        breakInterval: 45,
        description: 'You can focus deeply for extended periods'
    },
    long: {
        name: 'Long (60+ min)',
        minutes: 120,
        baselineThreshold: 0.70,
        breakInterval: 90,
        description: 'You excel at deep, sustained focus sessions'
    }
};

async function hasCompletedOnboarding() {
    const { onboarding_completed } = await chrome.storage.local.get(ONBOARDING_KEY);
    return onboarding_completed === true;
}

async function completeOnboarding() {
    await chrome.storage.local.set({ [ONBOARDING_KEY]: true });
    console.log('✅ Onboarding marked complete');
}

async function getUserAttentionProfile() {
    const { user_attention_profile } = await chrome.storage.local.get(USER_PROFILE_KEY);
    
    if (user_attention_profile) {
        return user_attention_profile;
    }
    
    // Default to medium if not set
    return ATTENTION_PROFILES.medium;
}

async function setUserAttentionProfile(profileKey) {
    if (!ATTENTION_PROFILES[profileKey]) {
        throw new Error('Invalid attention profile: ' + profileKey);
    }
    
    const profile = {
        ...ATTENTION_PROFILES[profileKey],
        key: profileKey,
        selectedAt: Date.now()
    };
    
    await chrome.storage.local.set({ [USER_PROFILE_KEY]: profile });
    console.log('✅ User profile set to: ' + profileKey);
    
    return profile;
}

function getAttentionThresholds(userProfile, contentType = 'default') {
    // Base threshold from profile
    let threshold = userProfile.baselineThreshold;
    
    // Adjust per content type
    if (contentType === 'video') {
        threshold += 0.10; // Videos hold attention better, so raise threshold
    } else if (contentType === 'code') {
        threshold -= 0.10; // Coding requires deep focus, lower threshold
    } else if (contentType === 'interactive') {
        threshold += 0.05; // Interactive content is engaging
    }
    
    return {
        low_threshold: threshold,
        medium_threshold: threshold + 0.15,
        high_threshold: threshold + 0.25,
        critical_threshold: Math.max(0, threshold - 0.20) // Emergency trigger
    };
}

function showOnboardingModal(onCompleteCallback) {
    console.log('📋 Showing onboarding modal');
    
    const modal = document.createElement('div');
    modal.id = 'onboarding-modal';
    modal.className = 'onboarding-modal';
    
    let html = `
        <div class="onboarding-content">
            <div class="onboarding-header">
                <h1>Welcome to FocusGuard!</h1>
                <p>Let's personalize your experience</p>
            </div>
            
            <div class="onboarding-section">
                <h2>How's your attention span?</h2>
                <p class="onboarding-subtitle">This helps us adjust notifications and break recommendations</p>
                
                <div class="attention-options">
    `;
    
    Object.entries(ATTENTION_PROFILES).forEach(([key, profile]) => {
        html += `
            <button class="attention-option" data-profile="${key}">
                <div class="option-title">${profile.name}</div>
                <div class="option-description">${profile.description}</div>
            </button>
        `;
    });
    
    html += `
                </div>
            </div>
            
            <div class="onboarding-section">
                <h3>What you'll get:</h3>
                <ul class="onboarding-benefits">
                    <li>✓ Smart break recommendations</li>
                    <li>✓ Personalized focus thresholds</li>
                    <li>✓ Content-aware quizzes</li>
                    <li>✓ Progress tracking</li>
                    <li>✓ AI coaching and motivation</li>
                </ul>
            </div>
        </div>
    `;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    // Add event listeners
    const options = modal.querySelectorAll('.attention-option');
    options.forEach(option => {
        option.addEventListener('click', async function() {
            const profileKey = this.getAttribute('data-profile');
            console.log('👤 User selected attention profile: ' + profileKey);
            
            // Remove selection from others
            options.forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            
            // After selection, show confirmation
            setTimeout(() => {
                setUserAttentionProfile(profileKey).then(() => {
                    completeOnboarding().then(() => {
                        modal.classList.add('closing');
                        setTimeout(() => {
                            modal.remove();
                            if (onCompleteCallback) onCompleteCallback();
                            console.log('✅ Onboarding completed');
                        }, 300);
                    });
                });
            }, 500);
        });
    });
}

export {
    hasCompletedOnboarding,
    completeOnboarding,
    getUserAttentionProfile,
    setUserAttentionProfile,
    getAttentionThresholds,
    showOnboardingModal,
    ATTENTION_PROFILES
};
