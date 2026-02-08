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

console.log('✅ FocusGuard content script ready for article detection');
