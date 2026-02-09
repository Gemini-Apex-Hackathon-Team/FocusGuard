/**
 * FocusGuard Distraction Intervention Popup
 * Displays a full-screen focus check dialog on the webpage itself
 * This ensures maximum visibility and user attention
 */

/**
 * Inject distraction popup HTML into the page
 */
function injectDistractionPopup() {
    // Check if popup already exists
    if (document.getElementById('focusguard-distraction-popup')) {
        return;
    }

    const popupHTML = `
        <div id="focusguard-distraction-popup" class="focusguard-distraction-popup">
            <div class="focusguard-popup-overlay"></div>
            <div class="focusguard-popup-modal">
                <div class="focusguard-popup-header">
                    <h2>🧠 FYX Focus Check</h2>
                    <p>Are you staying focused on this content?</p>
                </div>

                <div class="focusguard-popup-options">
                    <button class="focusguard-focus-option focusguard-option-yes" data-response="focused">
                        <span class="focusguard-option-icon">✅</span>
                        <span class="focusguard-option-text">Yes, fully engaged</span>
                    </button>
                    <button class="focusguard-focus-option focusguard-option-partial" data-response="partial">
                        <span class="focusguard-option-icon">🤔</span>
                        <span class="focusguard-option-text">Somewhat distracted</span>
                    </button>
                    <button class="focusguard-focus-option focusguard-option-no" data-response="notfocused">
                        <span class="focusguard-option-icon">❌</span>
                        <span class="focusguard-option-text">Not really paying attention</span>
                    </button>
                </div>

                <div class="focusguard-popup-footer">
                    <p class="focusguard-time-pressure">⏱️ Time's ticking... Focus now!</p>
                </div>
            </div>
        </div>
    `;

    // Inject popup HTML into page
    const popupElement = document.createElement('div');
    popupElement.innerHTML = popupHTML;
    document.body.appendChild(popupElement.firstElementChild);

    // Inject CSS
    injectDistractionPopupStyles();

    // Add event listeners
    setupDistractionPopupListeners();

    console.log('✅ Distraction popup injected into page');
}

/**
 * Inject CSS styles for distraction popup
 */
function injectDistractionPopupStyles() {
    // Check if styles already injected
    if (document.getElementById('focusguard-popup-styles')) {
        return;
    }

    const styles = `
        /* ===========================
           FocusGuard Distraction Popup
           =========================== */

        .focusguard-distraction-popup {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }

        .focusguard-distraction-popup.hidden {
            display: none !important;
        }

        /* Backdrop blur overlay */
        .focusguard-popup-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            z-index: -1;
        }

        /* Modal dialog */
        .focusguard-popup-modal {
            position: relative;
            z-index: 1;
            background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
            border-radius: 24px;
            box-shadow: 
                0 25px 50px -12px rgba(0, 0, 0, 0.3),
                0 0 0 1px rgba(0, 0, 0, 0.05);
            padding: 48px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            animation: focusguard-popup-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes focusguard-popup-slide-in {
            from {
                opacity: 0;
                transform: scale(0.85) translateY(-30px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        /* Header section */
        .focusguard-popup-header {
            text-align: center;
            margin-bottom: 32px;
        }

        .focusguard-popup-header h2 {
            font-size: 32px;
            font-weight: 700;
            color: #1f2937;
            margin: 0 0 12px 0;
            letter-spacing: -0.5px;
        }

        .focusguard-popup-header p {
            font-size: 16px;
            color: #6b7280;
            margin: 0;
            font-weight: 500;
        }

        /* Options container */
        .focusguard-popup-options {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 28px;
        }

        /* Individual focus option buttons */
        .focusguard-focus-option {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 18px 24px;
            border: 2px solid transparent;
            border-radius: 14px;
            background: #f3f4f6;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 15px;
            font-weight: 600;
            color: #374151;
            width: 100%;
            text-align: left;
        }

        .focusguard-focus-option:hover {
            background: #e5e7eb;
            transform: translateX(4px);
        }

        .focusguard-focus-option:active {
            transform: translateX(2px);
        }

        /* Yes - Fully Engaged */
        .focusguard-option-yes {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border-color: #bbf7d0;
            color: #15803d;
        }

        .focusguard-option-yes:hover {
            background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
            box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
        }

        .focusguard-option-yes .focusguard-option-icon {
            font-size: 24px;
        }

        /* Partial - Somewhat Distracted */
        .focusguard-option-partial {
            background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
            border-color: #fde047;
            color: #854d0e;
        }

        .focusguard-option-partial:hover {
            background: linear-gradient(135deg, #fef3c7 0%, #fde047 100%);
            box-shadow: 0 4px 12px rgba(202, 138, 4, 0.2);
        }

        .focusguard-option-partial .focusguard-option-icon {
            font-size: 24px;
        }

        /* No - Not Paying Attention */
        .focusguard-option-no {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            border-color: #fecaca;
            color: #991b1b;
        }

        .focusguard-option-no:hover {
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
        }

        .focusguard-option-no .focusguard-option-icon {
            font-size: 24px;
        }

        /* Option icon styling */
        .focusguard-option-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
            font-size: 24px;
            flex-shrink: 0;
        }

        /* Option text styling */
        .focusguard-option-text {
            flex: 1;
            font-size: 15px;
            font-weight: 600;
        }

        /* Footer section with time pressure */
        .focusguard-popup-footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }

        .focusguard-time-pressure {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #ef4444;
            animation: focusguard-time-pulse 1.5s ease-in-out infinite;
            letter-spacing: 0.5px;
        }

        @keyframes focusguard-time-pulse {
            0%, 100% {
                opacity: 0.8;
                transform: scale(1);
            }
            50% {
                opacity: 1;
                transform: scale(1.02);
            }
        }

        /* Selection animation */
        @keyframes focusguard-option-selected {
            0% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.05);
            }
            100% {
                transform: scale(1);
            }
        }

        .focusguard-focus-option.selected {
            animation: focusguard-option-selected 0.3s ease;
        }

        /* Responsive design */
        @media (max-width: 480px) {
            .focusguard-popup-modal {
                padding: 32px 20px;
                border-radius: 16px;
                width: 95%;
            }

            .focusguard-popup-header h2 {
                font-size: 26px;
            }

            .focusguard-popup-header p {
                font-size: 14px;
            }

            .focusguard-popup-options {
                gap: 10px;
            }

            .focusguard-focus-option {
                padding: 14px 16px;
                font-size: 14px;
                gap: 12px;
            }

            .focusguard-option-icon {
                min-width: 28px;
                font-size: 20px;
            }

            .focusguard-option-text {
                font-size: 14px;
            }
        }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = 'focusguard-popup-styles';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);

    console.log('✅ Distraction popup styles injected');
}

/**
 * Setup event listeners for distraction popup
 */
function setupDistractionPopupListeners() {
    const popup = document.getElementById('focusguard-distraction-popup');
    if (!popup) return;

    const focusOptions = popup.querySelectorAll('.focusguard-focus-option');

    focusOptions.forEach(button => {
        button.addEventListener('click', function(e) {
            const response = this.dataset.response;
            handleDistractionResponse(response);
        });
    });

    console.log('✅ Distraction popup event listeners attached');
}

/**
 * Handle user response to distraction popup
 */
function handleDistractionResponse(response) {
    const popup = document.getElementById('focusguard-distraction-popup');
    if (!popup) return;

    // Add selection animation
    const selectedButton = popup.querySelector(`[data-response="${response}"]`);
    if (selectedButton) {
        selectedButton.classList.add('selected');
    }

    console.log('👁️ User response to distraction check:', response);

    // Send response back to side panel
    chrome.runtime.sendMessage({
        action: 'DISTRACTION_POPUP_RESPONSE',
        response: response,
        timestamp: Date.now()
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn('⚠️ Could not send response:', chrome.runtime.lastError);
        }
    });

    // Provide visual feedback
    if (response === 'focused') {
        console.log('✅ Great! Keep up the focus!');
    } else if (response === 'partial') {
        console.log('⚠️ Try to refocus on the content');
    } else if (response === 'notfocused') {
        console.log('❌ Consider taking a break');
    }

    // Hide popup after 400ms
    setTimeout(() => {
        hideDistractionPopup();
    }, 400);
}

/**
 * Show distraction popup on page
 */
function showDistractionPopup() {
    // Inject if not already present
    if (!document.getElementById('focusguard-distraction-popup')) {
        injectDistractionPopup();
    }

    const popup = document.getElementById('focusguard-distraction-popup');
    if (popup) {
        popup.classList.remove('hidden');
        console.log('🎯 Distraction popup shown to user');

        // Auto-hide after 15 seconds if no response
        setTimeout(() => {
            const currentPopup = document.getElementById('focusguard-distraction-popup');
            if (currentPopup && !currentPopup.classList.contains('hidden')) {
                hideDistractionPopup();
                console.log('⏰ Popup auto-hidden after timeout');
            }
        }, 15000);
    }
}

/**
 * Hide distraction popup
 */
function hideDistractionPopup() {
    const popup = document.getElementById('focusguard-distraction-popup');
    if (popup) {
        popup.classList.add('hidden');
        console.log('✅ Distraction popup hidden');
    }
}

/**
 * Listen for messages from background/side-panel to show popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SHOW_DISTRACTION_POPUP') {
        console.log('📢 Received request to show distraction popup');
        showDistractionPopup();
        sendResponse({ success: true });
    }
    else if (request.action === 'HIDE_DISTRACTION_POPUP') {
        console.log('📢 Received request to hide distraction popup');
        hideDistractionPopup();
        sendResponse({ success: true });
    }
});

console.log('✅ FocusGuard distraction popup module loaded');
