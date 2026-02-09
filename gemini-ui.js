// Gemini-powered UI components for content script

/**
 * Show Gemini-generated suggestion during session
 */
function showGeminiSuggestion(message) {
    const existing = document.getElementById('fyx-gemini-suggestion');
    if (existing) existing.remove();

    const { analysis, suggestion, onTrack } = message;

    const overlay = document.createElement('div');
    overlay.id = 'fyx-gemini-suggestion';
    overlay.className = 'fyx-notification';
    overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    background: linear-gradient(135deg, ${onTrack ? '#10b981' : '#f59e0b'}, ${onTrack ? '#059669' : '#d97706'});
    color: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

    overlay.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">${onTrack ? '🎯' : '💡'}</span>
        <strong style="font-size: 16px;">FYX Gemini</strong>
      </div>
      <button id="fyx-close-suggestion" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; width: 24px; height: 24px; line-height: 20px;">×</button>
    </div>
    
    <div style="margin-bottom: 12px; opacity: 0.95; font-size: 14px;">
      ${analysis}
    </div>
    
    ${suggestion ? `
      <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-top: 12px;">
        <div style="font-weight: 600; margin-bottom: 4px;">💬 Suggestion:</div>
        <div style="font-size: 14px;">${suggestion}</div>
      </div>
    ` : ''}
    
    <button id="fyx-dismiss-suggestion" style="
      margin-top: 12px;
      width: 100%;
      padding: 8px;
      background: rgba(255,255,255,0.3);
      border: none;
      border-radius: 6px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
    ">Got it!</button>
  `;

    document.body.appendChild(overlay);

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
    document.head.appendChild(style);

    // Event listeners
    document.getElementById('fyx-close-suggestion').addEventListener('click', () => {
        overlay.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => overlay.remove(), 300);
    });

    document.getElementById('fyx-dismiss-suggestion').addEventListener('click', () => {
        overlay.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => overlay.remove(), 300);
    });

    // Auto-hide after 15 seconds
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s';
            setTimeout(() => overlay.remove(), 300);
        }
    }, 15000);
}

/**
 * Show relevance warning when user strays from session goal
 */
function showRelevanceWarning(message) {
    const existing = document.getElementById('fyx-relevance-warning');
    if (existing) existing.remove();

    const { reason, goal } = message;

    const overlay = document.createElement('div');
    overlay.id = 'fyx-relevance-warning';
    overlay.className = 'fyx-notification';
    overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(239,68,68,0.4);
    z-index: 10000;
    animation: slideIn 0.3s ease-out, pulse 2s infinite;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

    overlay.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">⚠️</span>
        <strong style="font-size: 16px;">Off Track</strong>
      </div>
      <button id="fyx-close-warning" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; width: 24px; height: 24px; line-height: 20px;">×</button>
    </div>
    
    <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
      <div style="font-weight: 600; margin-bottom: 4px;">Your Goal:</div>
      <div style="font-size: 14px;">"${goal}"</div>
    </div>
    
    <div style="margin-bottom: 12px; font-size: 14px;">
      ${reason}
    </div>
    
    <div style="display: flex; gap: 8px;">
      <button id="fyx-refocus" style="
        flex: 1;
        padding: 10px;
        background: white;
        border: none;
        border-radius: 6px;
        color: #dc2626;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
      ">Refocus Now</button>
      <button id="fyx-ignore-warning" style="
        flex: 1;
        padding: 10px;
        background: rgba(255,255,255,0.3);
        border: none;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
      ">Ignore</button>
    </div>
  `;

    document.body.appendChild(overlay);

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    @keyframes slideOut {
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
    document.head.appendChild(style);

    // Event listeners
    document.getElementById('fyx-close-warning').addEventListener('click', () => {
        overlay.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => overlay.remove(), 300);
    });

    document.getElementById('fyx-refocus').addEventListener('click', () => {
        // Go back to previous page or close tab
        window.history.back();
        overlay.remove();
    });

    document.getElementById('fyx-ignore-warning').addEventListener('click', () => {
        overlay.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => overlay.remove(), 300);
    });

    // Auto-hide after 20 seconds
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s';
            setTimeout(() => overlay.remove(), 300);
        }
    }, 20000);
}

// Export for use in content.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showGeminiSuggestion,
        showRelevanceWarning
    };
}
