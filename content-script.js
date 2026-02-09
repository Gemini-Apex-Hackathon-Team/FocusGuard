// FocusGuard Content Script
// Runs on all web pages to detect articles and monitor reading progress

console.log('🔗 FocusGuard content script loaded');

let isArticle = false;
let articleElement = null;
let lastScrollPercent = 0;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent') {
        console.log('📄 Content script extracting page...');
        
        try {
            // Extract main content
            const content = extractMainContent();
            const metadata = {
                title: document.title,
                url: window.location.href,
                content: content,
                contentType: 'article',
                timestamp: Date.now(),
                charCount: content.length
            };
            
            console.log('✅ Content extracted:', metadata.title);
            console.log('📊 Content type:', metadata.contentType);
            console.log('📝 Content length:', metadata.charCount, 'characters');
            
            sendResponse({ success: true, data: metadata });
        } catch (error) {
            console.error('❌ Content extraction error:', error.message);
            sendResponse({ success: false, error: error.message });
        }
    }
});

// Auto-detect articles on page load
window.addEventListener('load', () => {
    console.log('📖 Checking if page is an article...');
    isArticle = detectArticle();
    
    if (isArticle) {
        articleElement = findArticleElement();
        console.log('✅ Article detected!');
        
        // Send initial article detection to background
        const initialContext = extractArticleContext();
        chrome.runtime.sendMessage({
            action: 'articleDetected',
            data: initialContext
        }, (response) => {
            if (response && response.success) {
                console.log('✅ Background notified of article');
            }
        });
        
        // Start monitoring scroll position
        setupScrollMonitoring();
    } else {
        console.log('ℹ️ Not an article page');
    }
});

function detectArticle() {
    // Check for article-specific meta tags
    const ogType = document.querySelector('meta[property="og:type"]')?.getAttribute('content');
    if (ogType === 'article') {
        console.log('📌 Detected via og:type=article');
        return true;
    }
    
    // Check for article element
    if (document.querySelector('article')) {
        console.log('📌 Detected via <article> element');
        return true;
    }
    
    // Check for common article domains
    const url = window.location.hostname.toLowerCase();
    const articleDomains = [
        'medium.com',
        'dev.to',
        'wikipedia.org',
        'hackernoon.com',
        'freecodecamp.org',
        'css-tricks.com',
        'smashingmagazine.com',
        'alistapart.com',
        'blog.', // Any blog subdomain
        'news.', // Any news subdomain
    ];
    
    if (articleDomains.some(domain => url.includes(domain))) {
        console.log('📌 Detected via domain pattern:', url);
        return true;
    }
    
    // Check for common article selectors
    const articleSelectors = [
        'main',
        '.article-content',
        '.post-content',
        '.entry-content',
        '.content',
        '.story-body',
        '[role="main"]',
        '.markdown-body' // GitHub
    ];
    
    for (const selector of articleSelectors) {
        if (document.querySelector(selector)) {
            console.log('📌 Detected via selector:', selector);
            return true;
        }
    }
    
    return false;
}

function findArticleElement() {
    // Try to find main content area in order of preference
    const selectors = [
        'article',
        'main',
        '[role="main"]',
        '.article-content',
        '.post-content',
        '.entry-content',
        '.content',
        '.story-body',
        '[data-testid="article-content"]',
        '.markdown-body'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
    }
    
    return document.body;
}

function setupScrollMonitoring() {
    console.log('👀 Setting up scroll monitoring for article...');
    
    // Monitor scroll with debouncing (max 1 update per second)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const context = extractArticleContext();
            
            // Only send if scroll position changed significantly (5%)
            if (Math.abs(context.scrollPercent - lastScrollPercent) >= 5) {
                lastScrollPercent = context.scrollPercent;
                
                console.log(`📍 Scroll position: ${context.scrollPercent}%`);
                
                chrome.runtime.sendMessage({
                    action: 'articleScrolled',
                    data: context
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Background service worker might be inactive, that's ok
                        console.log('ℹ️ Background not active, will sync when needed');
                    }
                });
            }
        }, 1000); // Debounce: 1 second
    });
}

function extractArticleContext() {
    const article = articleElement || document.querySelector('article') || document.querySelector('main') || document.body;
    
    // Get visible text (what user is reading right now)
    const visibleText = getVisibleText(article);
    
    // Calculate scroll percentage
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollHeight > 0 
        ? Math.round((window.scrollY / scrollHeight) * 100)
        : 0;
    
    // Get title
    const title = document.querySelector('h1')?.textContent || 
                 document.querySelector('title')?.textContent ||
                 document.title;
    
    // Get article metadata
    const author = document.querySelector('[rel="author"]')?.textContent ||
                  document.querySelector('.author')?.textContent ||
                  'Unknown';
    
    const publishDate = document.querySelector('time')?.getAttribute('datetime') ||
                       document.querySelector('[itemprop="datePublished"]')?.getAttribute('content') ||
                       '';
    
    return {
        contentType: 'article',
        title: title.trim(),
        author: author.trim(),
        publishDate: publishDate,
        url: window.location.href,
        visibleText: visibleText.substring(0, 1000),  // Current visible section
        scrollPercent: scrollPercent,
        fullPageText: article.innerText || article.textContent, // For quiz generation
        timestamp: Date.now()
    };
}

function getVisibleText(element) {
    // Get text that's currently visible in viewport
    const range = document.createRange();
    const sel = window.getSelection();
    
    // Get all text nodes in the element
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let visibleText = '';
    let currentNode;
    
    while (currentNode = walker.nextNode()) {
        const rect = currentNode.parentElement.getBoundingClientRect();
        
        // Check if element is in viewport
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            const text = currentNode.textContent.trim();
            if (text.length > 0) {
                visibleText += text + ' ';
            }
        }
        
        // Limit to avoid too much text
        if (visibleText.length > 1000) {
            break;
        }
    }
    
    return visibleText.trim();
}

/**
 * ==========================================
 * DISTRACTION POPUP - Full-screen overlay
 * ==========================================
 */

/**
 * Show distraction check popup on the webpage
 */
function showDistractionPopup() {
    // Inject popup if not already present
    if (!document.getElementById('focusguard-popup-container')) {
        injectDistractionPopup();
    }

    const popup = document.getElementById('focusguard-popup-container');
    if (popup) {
        popup.classList.remove('hidden');
        console.log('🎯 Distraction popup shown');

        // Auto-hide after 15 seconds if no response
        setTimeout(() => {
            const currentPopup = document.getElementById('focusguard-popup-container');
            if (currentPopup && !currentPopup.classList.contains('hidden')) {
                hideDistractionPopup();
            }
        }, 15000);
    }
}

/**
 * Hide distraction popup
 */
function hideDistractionPopup() {
    const popup = document.getElementById('focusguard-popup-container');
    if (popup) {
        popup.classList.add('hidden');
        console.log('✅ Distraction popup hidden');
    }
}

/**
 * Inject popup HTML and styles into page
 */
function injectDistractionPopup() {
    const popupHTML = `
        <div id="focusguard-popup-container" class="focusguard-popup-container">
            <div class="focusguard-popup-overlay"></div>
            <div class="focusguard-popup-modal">
                <div class="focusguard-popup-header">
                    <h2>🧠 FYX Focus Check</h2>
                    <p>Are you staying focused on this content?</p>
                </div>
                <div class="focusguard-popup-options">
                    <button class="focusguard-popup-btn focusguard-btn-yes" data-response="focused">
                        <span>✅</span> Yes, fully engaged
                    </button>
                    <button class="focusguard-popup-btn focusguard-btn-partial" data-response="partial">
                        <span>🤔</span> Somewhat distracted
                    </button>
                    <button class="focusguard-popup-btn focusguard-btn-no" data-response="notfocused">
                        <span>❌</span> Not really paying attention
                    </button>
                </div>
                <div class="focusguard-popup-footer">
                    <p>⏱️ Time's ticking... Focus now!</p>
                </div>
            </div>
        </div>
    `;

    // Create and insert popup
    const popupDiv = document.createElement('div');
    popupDiv.innerHTML = popupHTML;
    document.body.appendChild(popupDiv.firstElementChild);

    // Inject styles
    injectPopupStyles();

    // Attach event listeners
    attachPopupListeners();

    console.log('✅ Distraction popup injected');
}

/**
 * Inject CSS for the popup
 */
function injectPopupStyles() {
    if (document.getElementById('focusguard-popup-styles')) {
        return; // Already injected
    }

    const styles = `
        .focusguard-popup-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .focusguard-popup-container.hidden {
            display: none !important;
        }

        .focusguard-popup-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            z-index: 1;
        }

        .focusguard-popup-modal {
            position: relative;
            z-index: 2;
            background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3);
            animation: focusguard-popup-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes focusguard-popup-in {
            from {
                opacity: 0;
                transform: scale(0.85) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        .focusguard-popup-header {
            text-align: center;
            margin-bottom: 30px;
        }

        .focusguard-popup-header h2 {
            font-size: 28px;
            font-weight: 700;
            color: #1f2937;
            margin: 0 0 8px 0;
        }

        .focusguard-popup-header p {
            font-size: 16px;
            color: #6b7280;
            margin: 0;
            font-weight: 500;
        }

        .focusguard-popup-options {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
        }

        .focusguard-popup-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 20px;
            border: 2px solid transparent;
            border-radius: 12px;
            background: #f3f4f6;
            cursor: pointer;
            font-size: 15px;
            font-weight: 600;
            transition: all 0.3s ease;
            width: 100%;
            text-align: left;
        }

        .focusguard-popup-btn:hover {
            transform: translateX(4px);
        }

        .focusguard-popup-btn span {
            font-size: 20px;
            flex-shrink: 0;
        }

        .focusguard-btn-yes {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            color: #15803d;
            border-color: #bbf7d0;
        }

        .focusguard-btn-yes:hover {
            background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
            box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
        }

        .focusguard-btn-partial {
            background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
            color: #854d0e;
            border-color: #fde047;
        }

        .focusguard-btn-partial:hover {
            background: linear-gradient(135deg, #fef3c7 0%, #fde047 100%);
            box-shadow: 0 4px 12px rgba(202, 138, 4, 0.2);
        }

        .focusguard-btn-no {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            color: #991b1b;
            border-color: #fecaca;
        }

        .focusguard-btn-no:hover {
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
        }

        .focusguard-popup-footer {
            text-align: center;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
        }

        .focusguard-popup-footer p {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #ef4444;
            animation: focusguard-pulse 1.5s ease-in-out infinite;
        }

        @keyframes focusguard-pulse {
            0%, 100% { opacity: 0.8; }
            50% { opacity: 1; }
        }

        @media (max-width: 480px) {
            .focusguard-popup-modal {
                padding: 28px 20px;
                width: 95%;
            }

            .focusguard-popup-header h2 {
                font-size: 24px;
            }
        }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = 'focusguard-popup-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    console.log('✅ Popup styles injected');
}

/**
 * Attach event listeners to popup buttons
 */
function attachPopupListeners() {
    const popup = document.getElementById('focusguard-popup-container');
    if (!popup) return;

    const buttons = popup.querySelectorAll('.focusguard-popup-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            const response = this.dataset.response;
            console.log('👁️ User response:', response);

            // Send response to background
            chrome.runtime.sendMessage({
                action: 'DISTRACTION_POPUP_RESPONSE',
                response: response,
                timestamp: Date.now()
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('⚠️ Could not send response');
                }
            });

            // Hide popup
            setTimeout(() => hideDistractionPopup(), 300);
        });
    });

    console.log('✅ Popup event listeners attached');
}

/**
 * Listen for messages from background to show popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SHOW_DISTRACTION_POPUP') {
        console.log('📢 Showing distraction popup');
        showDistractionPopup();
        sendResponse({ success: true });
    }
    else if (request.action === 'HIDE_DISTRACTION_POPUP') {
        console.log('📢 Hiding distraction popup');
        hideDistractionPopup();
        sendResponse({ success: true });
    }
});

console.log('✅ FocusGuard content script ready for article detection');
