// FYX Onboarding Page Handler
// Handles the onboarding.html page functionality

let currentStep = 1;
const totalSteps = 4;
let selectedAttentionLevel = 5;
let apiKey = '';

/**
 * Initialize onboarding page
 */
document.addEventListener('DOMContentLoaded', () => {
  setupAttentionScale();
  setupNavigation();
  updateUI();
  console.log('✅ FYX Onboarding page initialized');
});

/**
 * Setup attention scale selection
 */
function setupAttentionScale() {
  const options = document.querySelectorAll('.scale-option');
  
  if (options.length === 0) return; // Not on onboarding page
  
  options.forEach(option => {
    option.addEventListener('click', () => {
      // Remove previous selection
      options.forEach(opt => opt.classList.remove('selected'));
      
      // Select new option
      option.classList.add('selected');
      selectedAttentionLevel = parseInt(option.dataset.value);
      
      // Update display
      const selectedValueEl = document.getElementById('selected-value');
      if (selectedValueEl) {
        selectedValueEl.textContent = selectedAttentionLevel;
      }
      
      console.log('📊 Attention level selected:', selectedAttentionLevel);
    });
  });
}

/**
 * Setup navigation buttons
 */
function setupNavigation() {
  const nextBtn = document.getElementById('btn-next');
  const backBtn = document.getElementById('btn-back');
  
  if (nextBtn) {
    nextBtn.addEventListener('click', nextStep);
  }
  if (backBtn) {
    backBtn.addEventListener('click', prevStep);
  }
}

/**
 * Navigate to next step
 */
async function nextStep() {
  // Validate current step
  if (currentStep === 3) {
    const apiInput = document.getElementById('api-key-input');
    apiKey = apiInput ? apiInput.value.trim() : '';
    
    if (!apiKey) {
      alert('Please enter your Gemini API key to continue.');
      return;
    }
    
    // Optionally validate API key format
    if (!apiKey.startsWith('AIza')) {
      const proceed = confirm('This doesn\'t look like a valid Gemini API key. Continue anyway?');
      if (!proceed) return;
    }
  }
  
  // Move to next step
  if (currentStep < totalSteps) {
    currentStep++;
    updateUI();
  } else {
    // Final step - complete onboarding
    await completeOnboarding();
  }
}

/**
 * Navigate to previous step
 */
function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    updateUI();
  }
}

/**
 * Update UI based on current step
 */
function updateUI() {
  // Hide all steps
  const steps = document.querySelectorAll('.onboarding-step');
  steps.forEach(step => {
    step.classList.remove('active');
  });
  
  // Show current step
  const currentStepEl = document.getElementById(`step-${currentStep}`);
  if (currentStepEl) {
    currentStepEl.classList.add('active');
  }
  
  // Update back button visibility
  const backBtn = document.getElementById('btn-back');
  if (backBtn) {
    backBtn.style.display = currentStep > 1 ? 'block' : 'none';
  }
  
  // Update next button text
  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) {
    if (currentStep === 1) {
      nextBtn.textContent = 'Get Started';
    } else if (currentStep === totalSteps) {
      nextBtn.textContent = 'Start Using FYX';
    } else {
      nextBtn.textContent = 'Next';
    }
  }
  
  // Disable next button on API key step if empty
  if (currentStep === 3) {
    const apiInput = document.getElementById('api-key-input');
    if (apiInput && nextBtn) {
      apiInput.addEventListener('input', () => {
        nextBtn.disabled = !apiInput.value.trim();
      });
      nextBtn.disabled = !apiInput.value.trim();
    }
  } else if (nextBtn) {
    nextBtn.disabled = false;
  }
  
  // Update progress dots
  const dots = document.querySelectorAll('.progress-dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentStep - 1);
  });
  
  console.log('📄 Step updated to:', currentStep);
}

/**
 * Complete onboarding and save configuration
 */
async function completeOnboarding() {
  console.log('🎉 Completing onboarding...');
  
  // Map attention level to quiz frequency
  const quizFrequency = selectedAttentionLevel <= 3 ? 10 : 
                       selectedAttentionLevel <= 6 ? 15 : 20;
  
  // Create user config
  const config = {
    attentionLevel: selectedAttentionLevel,
    blockedSites: [],
    allowedSites: [],
    quizFrequency: quizFrequency,
    enableFaceTracking: true,
    enableContentQuiz: true,
    enableInterventions: true,
    enableBreaks: true
  };
  
  // Save to chrome storage
  await chrome.storage.local.set({
    userConfig: config,
    apiKey: apiKey,
    onboarded: true,
    onboardingDate: new Date().toISOString()
  });
  
  // Also save to sync storage for API key
  await chrome.storage.sync.set({
    focusguard_settings: {
      geminiApiKey: apiKey
    }
  });
  
  console.log('✅ User config saved:', config);
  console.log('✅ API key saved to storage');
  
  // Show success message
  showSuccessMessage();
  
  // Redirect to main page after delay
  setTimeout(() => {
    window.location.href = 'side-panel.html';
  }, 2500);
}

/**
 * Show success message
 */
function showSuccessMessage() {
  const container = document.querySelector('.onboarding-container');
  if (!container) return;
  
  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px;">
      <div style="font-size: 80px; margin-bottom: 24px; animation: bounce 0.6s infinite;">✨</div>
      <h2 style="font-size: 32px; color: #1f2937; margin-bottom: 16px;">
        Welcome to FYX!
      </h2>
      <p style="font-size: 18px; color: #6b7280; margin-bottom: 32px;">
        Your focus journey starts now
      </p>
      <div style="display: flex; justify-content: center; gap: 8px;">
        <div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 50%; animation: bounce 0.6s infinite;"></div>
        <div style="width: 12px; height: 12px; background: #8b5cf6; border-radius: 50%; animation: bounce 0.6s 0.2s infinite;"></div>
        <div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 50%; animation: bounce 0.6s 0.4s infinite;"></div>
      </div>
    </div>
    
    <style>
      @keyframes bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-12px);
        }
      }
    </style>
  `;
  
  console.log('✨ Success message displayed');
}
