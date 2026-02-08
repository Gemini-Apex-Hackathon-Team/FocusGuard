// Content Detector
// Detects type of content user is studying

const CONTENT_TYPES = {
    video: 'video',
    article: 'article',
    code: 'code',
    interactive: 'interactive',
    document: 'document',
    unknown: 'unknown'
};

function detectContentTypeFromUrl(url) {
    if (!url) return CONTENT_TYPES.unknown;
    
    const urlLower = url.toLowerCase();
    
    // Video detection
    if (urlLower.includes('youtube.com') || 
        urlLower.includes('vimeo.com') ||
        urlLower.includes('coursera.org') ||
        urlLower.includes('udemy.com') ||
        urlLower.includes('youtu.be')) {
        return CONTENT_TYPES.video;
    }
    
    // Code detection
    if (urlLower.includes('github.com') ||
        urlLower.includes('stackoverflow.com') ||
        urlLower.includes('codepen.io') ||
        urlLower.includes('replit.com')) {
        return CONTENT_TYPES.code;
    }
    
    // Document detection
    if (urlLower.includes('docs.google.com') ||
        urlLower.includes('.pdf') ||
        urlLower.includes('notion.so')) {
        return CONTENT_TYPES.document;
    }
    
    // Interactive detection
    if (urlLower.includes('interactive') ||
        urlLower.includes('quiz') ||
        urlLower.includes('exercise')) {
        return CONTENT_TYPES.interactive;
    }
    
    // Default to article for medium, dev.to, wikipedia, etc.
    if (urlLower.includes('medium.com') ||
        urlLower.includes('dev.to') ||
        urlLower.includes('wikipedia.org') ||
        urlLower.includes('blog')) {
        return CONTENT_TYPES.article;
    }
    
    return CONTENT_TYPES.article; // Default assumption
}

function analyzePageContent(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Count elements
    const videos = doc.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
    const codeBlocks = doc.querySelectorAll('code, pre, .code-block').length;
    const paragraphs = doc.querySelectorAll('p').length;
    const images = doc.querySelectorAll('img').length;
    const forms = doc.querySelectorAll('form, input, button[type="submit"]').length;
    
    // Determine type based on content analysis
    if (videos > 0 && paragraphs < 5) {
        return CONTENT_TYPES.video;
    }
    
    if (codeBlocks > 0) {
        return CONTENT_TYPES.code;
    }
    
    if (forms > 0 && codeBlocks === 0) {
        return CONTENT_TYPES.interactive;
    }
    
    if (paragraphs > 5) {
        return CONTENT_TYPES.article;
    }
    
    return CONTENT_TYPES.unknown;
}

function getContentTitle(url, html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        // Try multiple title sources
        const h1 = doc.querySelector('h1');
        if (h1) return h1.textContent.trim();
        
        const titleTag = doc.querySelector('title');
        if (titleTag) return titleTag.textContent.trim();
        
        const metaTitle = doc.querySelector('meta[property="og:title"]');
        if (metaTitle) return metaTitle.getAttribute('content');
        
        // Extract domain as fallback
        const domain = new URL(url).hostname.replace('www.', '');
        return domain;
    } catch (e) {
        return new URL(url).hostname;
    }
}

function getContentSummary(html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        // Try multiple summary sources
        const metaDescription = doc.querySelector('meta[name="description"]');
        if (metaDescription) {
            return metaDescription.getAttribute('content');
        }
        
        const ogDescription = doc.querySelector('meta[property="og:description"]');
        if (ogDescription) {
            return ogDescription.getAttribute('content');
        }
        
        // Extract first paragraph
        const firstParagraph = doc.querySelector('p');
        if (firstParagraph) {
            return firstParagraph.textContent.trim().substring(0, 200);
        }
        
        return '';
    } catch (e) {
        return '';
    }
}

function estimateReadingTime(content) {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    
    if (minutes < 1) return '< 1 min';
    if (minutes === 1) return '1 min';
    return minutes + ' min';
}

function getScrollPosition(documentElement) {
    const totalHeight = documentElement.scrollHeight - documentElement.clientHeight;
    if (totalHeight === 0) return 0;
    
    return Math.round((documentElement.scrollTop / totalHeight) * 100);
}

function getContentMetadata(url, html) {
    const type = detectContentTypeFromUrl(url);
    const title = getContentTitle(url, html);
    const summary = getContentSummary(html);
    
    return {
        url: url,
        type: type,
        title: title,
        summary: summary,
        timestamp: Date.now(),
        domain: new URL(url).hostname
    };
}

function getVideoTimestamp() {
    // This will be called from content script on video pages
    try {
        // YouTube
        const youtubePlayer = document.querySelector('video');
        if (youtubePlayer) {
            return {
                currentTime: Math.floor(youtubePlayer.currentTime),
                duration: Math.floor(youtubePlayer.duration),
                title: document.querySelector('h1.title')?.textContent || 'Unknown'
            };
        }
        
        // Vimeo and other HTML5 video
        const videoElements = document.querySelectorAll('video');
        if (videoElements.length > 0) {
            const video = videoElements[0];
            return {
                currentTime: Math.floor(video.currentTime),
                duration: Math.floor(video.duration),
                title: document.title
            };
        }
        
        return null;
    } catch (e) {
        console.error('Error getting video timestamp:', e);
        return null;
    }
}

function formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }
    
    return minutes + ':' + String(secs).padStart(2, '0');
}

function createContentSnapshot(url, html) {
    return {
        url: url,
        metadata: getContentMetadata(url, html),
        contentType: detectContentTypeFromUrl(url),
        scrollPosition: 0,
        videoTimestamp: null,
        capturedAt: Date.now()
    };
}

export {
    CONTENT_TYPES,
    detectContentTypeFromUrl,
    analyzePageContent,
    getContentTitle,
    getContentSummary,
    estimateReadingTime,
    getScrollPosition,
    getContentMetadata,
    getVideoTimestamp,
    formatTimestamp,
    createContentSnapshot
};
