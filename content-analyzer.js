// FYX Content Analyzer
// Extracts and understands what the user is learning

class ContentAnalyzer {
    constructor() {
        this.currentContent = null;
    }

    /**
     * Analyze current page content
     */
    async analyzePage() {
        const contentType = this.detectContentType();

        if (contentType === 'video') {
            return await this.analyzeVideo();
        } else {
            return await this.analyzeArticle();
        }
    }

    /**
     * Detect content type (article or video)
     */
    detectContentType() {
        const video = document.querySelector('video');
        if (video && video.duration > 0) {
            return 'video';
        }
        return 'article';
    }

    /**
     * Analyze article content
     */
    async analyzeArticle() {
        // Extract main content text
        const text = this.extractArticleText();
        const scrollPosition = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progressPercent = Math.round((scrollPosition / maxScroll) * 100);

        return {
            type: 'article',
            url: window.location.href,
            title: document.title,
            text: text,
            position: {
                scrollY: scrollPosition,
                progress: progressPercent
            },
            timestamp: Date.now()
        };
    }

    /**
     * Extract clean article text
     */
    extractArticleText() {
        // Try to find main content area
        const selectors = [
            'article',
            'main',
            '[role="main"]',
            '.content',
            '.article-content',
            '#content'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return this.cleanText(element.innerText);
            }
        }

        // Fallback to body
        return this.cleanText(document.body.innerText);
    }

    /**
     * Clean extracted text
     */
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
            .trim()
            .substring(0, 5000); // Limit to 5000 chars
    }

    /**
     * Analyze video content
     */
    async analyzeVideo() {
        const video = document.querySelector('video');

        if (!video) {
            return null;
        }

        const currentTime = video.currentTime;
        const duration = video.duration;
        const progressPercent = Math.round((currentTime / duration) * 100);

        // Try to get video title (YouTube, etc)
        let videoTitle = document.title;
        const ytTitle = document.querySelector('h1.title, .ytp-title-text, #title h1');
        if (ytTitle) {
            videoTitle = ytTitle.textContent.trim();
        }

        return {
            type: 'video',
            url: window.location.href,
            title: videoTitle,
            position: {
                currentTime: currentTime,
                duration: duration,
                progress: progressPercent
            },
            isPaused: video.paused,
            timestamp: Date.now()
        };
    }

    /**
     * Save current position
     */
    getCurrentPosition() {
        const contentType = this.detectContentType();

        if (contentType === 'video') {
            const video = document.querySelector('video');
            return {
                type: 'video',
                currentTime: video?.currentTime || 0
            };
        } else {
            return {
                type: 'article',
                scrollY: window.scrollY
            };
        }
    }

    /**
     * Restore position after break
     */
    restorePosition(position) {
        if (!position) return;

        if (position.type === 'video') {
            const video = document.querySelector('video');
            if (video) {
                video.currentTime = position.currentTime;
                console.log('[FYX] Restored video to', position.currentTime, 'seconds');
            }
        } else if (position.type === 'article') {
            window.scrollTo({
                top: position.scrollY,
                behavior: 'smooth'
            });
            console.log('[FYX] Restored scroll to', position.scrollY, 'px');
        }
    }
}

// Make available globally
window.ContentAnalyzer = ContentAnalyzer;
