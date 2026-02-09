// Website Blocker
// Blocks distracting websites based on whitelist/blacklist

const WHITELIST_KEY = 'blocker_whitelist';
const BLACKLIST_KEY = 'blocker_blacklist';
const BLOCKER_ENABLED_KEY = 'blocker_enabled';
const EMERGENCY_BYPASS_KEY = 'emergency_bypasses';
const BYPASS_DURATION = 5 * 60 * 1000; // 5 minutes

const DEFAULT_WHITELIST = [
    'youtube.com',
    'www.youtube.com',
    'coursera.org',
    'www.coursera.org',
    'udemy.com',
    'www.udemy.com',
    'medium.com',
    'www.medium.com',
    'dev.to',
    'github.com',
    'www.github.com',
    'wikipedia.org',
    'en.wikipedia.org',
    'stackoverflow.com',
    'www.stackoverflow.com',
    'docs.google.com',
    'google.com'
];

const DEFAULT_BLACKLIST = [
    'twitter.com',
    'www.twitter.com',
    'reddit.com',
    'www.reddit.com',
    'facebook.com',
    'www.facebook.com',
    'instagram.com',
    'www.instagram.com',
    'tiktok.com',
    'www.tiktok.com',
    'pinterest.com',
    'www.pinterest.com',
    'twitch.tv',
    'www.twitch.tv',
    'discord.com',
    'www.discord.com'
];

async function initializeBlocker() {
    const { blocker_whitelist, blocker_blacklist, blocker_enabled } = 
        await chrome.storage.sync.get([WHITELIST_KEY, BLACKLIST_KEY, BLOCKER_ENABLED_KEY]);
    
    // Set defaults if not exists
    if (!blocker_whitelist) {
        await chrome.storage.sync.set({ [WHITELIST_KEY]: DEFAULT_WHITELIST });
    }
    if (!blocker_blacklist) {
        await chrome.storage.sync.set({ [BLACKLIST_KEY]: DEFAULT_BLACKLIST });
    }
    if (blocker_enabled === undefined) {
        await chrome.storage.sync.set({ [BLOCKER_ENABLED_KEY]: true });
    }
    
    console.log('✅ Website blocker initialized');
}

async function isBlockerEnabled() {
    const { blocker_enabled } = await chrome.storage.sync.get(BLOCKER_ENABLED_KEY);
    return blocker_enabled !== false;
}

async function setBlockerEnabled(enabled) {
    await chrome.storage.sync.set({ [BLOCKER_ENABLED_KEY]: enabled });
    console.log('🔒 Blocker ' + (enabled ? 'enabled' : 'disabled'));
}

function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        console.error('Invalid URL:', url);
        return null;
    }
}

function isDomainInList(domain, list) {
    if (!domain) return false;
    
    // Check exact match and subdomain match
    return list.some(item => {
        return domain === item || domain.endsWith('.' + item);
    });
}

async function isBlockedSite(url) {
    const enabled = await isBlockerEnabled();
    if (!enabled) return false;
    
    const domain = extractDomain(url);
    if (!domain) return false;
    
    const { blocker_whitelist, blocker_blacklist } = 
        await chrome.storage.sync.get([WHITELIST_KEY, BLACKLIST_KEY]);
    
    const whitelist = blocker_whitelist || DEFAULT_WHITELIST;
    const blacklist = blocker_blacklist || DEFAULT_BLACKLIST;
    
    // Whitelist takes priority
    if (isDomainInList(domain, whitelist)) {
        return false;
    }
    
    // Check blacklist
    return isDomainInList(domain, blacklist);
}

async function getEmergencyBypassesRemaining() {
    const { emergency_bypasses } = await chrome.storage.local.get(EMERGENCY_BYPASS_KEY);
    
    if (!emergency_bypasses) {
        return 2; // Default: 2 bypasses per session
    }
    
    // Clean up expired bypasses
    const now = Date.now();
    const active = emergency_bypasses.filter(time => now - time < BYPASS_DURATION);
    
    return Math.max(0, 2 - active.length);
}

async function useEmergencyBypass() {
    const remaining = await getEmergencyBypassesRemaining();
    
    if (remaining <= 0) {
        console.warn('⚠️ No emergency bypasses remaining');
        return false;
    }
    
    const { emergency_bypasses } = await chrome.storage.local.get(EMERGENCY_BYPASS_KEY);
    const updated = (emergency_bypasses || []).concat([Date.now()]);
    
    await chrome.storage.local.set({ [EMERGENCY_BYPASS_KEY]: updated });
    console.log('⏰ Emergency bypass used. ' + (remaining - 1) + ' remaining.');
    
    return true;
}

async function addToWhitelist(domain) {
    const { blocker_whitelist } = await chrome.storage.sync.get(WHITELIST_KEY);
    const whitelist = blocker_whitelist || DEFAULT_WHITELIST;
    
    if (!whitelist.includes(domain)) {
        whitelist.push(domain);
        await chrome.storage.sync.set({ [WHITELIST_KEY]: whitelist });
        console.log('✅ Added ' + domain + ' to whitelist');
    }
}

async function addToBlacklist(domain) {
    const { blocker_blacklist } = await chrome.storage.sync.get(BLACKLIST_KEY);
    const blacklist = blocker_blacklist || DEFAULT_BLACKLIST;
    
    if (!blacklist.includes(domain)) {
        blacklist.push(domain);
        await chrome.storage.sync.set({ [BLACKLIST_KEY]: blacklist });
        console.log('✅ Added ' + domain + ' to blacklist');
    }
}

async function removeFromWhitelist(domain) {
    const { blocker_whitelist } = await chrome.storage.sync.get(WHITELIST_KEY);
    const whitelist = blocker_whitelist || DEFAULT_WHITELIST;
    
    const index = whitelist.indexOf(domain);
    if (index > -1) {
        whitelist.splice(index, 1);
        await chrome.storage.sync.set({ [WHITELIST_KEY]: whitelist });
        console.log('✅ Removed ' + domain + ' from whitelist');
    }
}

async function removeFromBlacklist(domain) {
    const { blocker_blacklist } = await chrome.storage.sync.get(BLACKLIST_KEY);
    const blacklist = blocker_blacklist || DEFAULT_BLACKLIST;
    
    const index = blacklist.indexOf(domain);
    if (index > -1) {
        blacklist.splice(index, 1);
        await chrome.storage.sync.set({ [BLACKLIST_KEY]: blacklist });
        console.log('✅ Removed ' + domain + ' from blacklist');
    }
}

async function getWhitelist() {
    const { blocker_whitelist } = await chrome.storage.sync.get(WHITELIST_KEY);
    return blocker_whitelist || DEFAULT_WHITELIST;
}

async function getBlacklist() {
    const { blocker_blacklist } = await chrome.storage.sync.get(BLACKLIST_KEY);
    return blocker_blacklist || DEFAULT_BLACKLIST;
}

function showBlockerOverlay(domain, onEmergencyBypass) {
    console.log('🚫 Showing blocker overlay for: ' + domain);
    
    const overlay = document.createElement('div');
    overlay.className = 'blocker-overlay';
    
    overlay.innerHTML = `
        <div class="blocker-content">
            <div class="blocker-icon">🛑</div>
            <h1>Taking a Break?</h1>
            <p class="blocker-domain">${domain} is a distraction site</p>
            
            <p class="blocker-message">
                FocusGuard detected you're drifting to ${domain}. 
                Stay focused on your learning!
            </p>
            
            <div class="blocker-stats">
                <div class="stat">
                    <span class="stat-value" id="blocker-focus">--</span>
                    <span class="stat-label">Focus Score</span>
                </div>
                <div class="stat">
                    <span class="stat-value" id="blocker-time">0:00</span>
                    <span class="stat-label">Session Time</span>
                </div>
            </div>
            
            <button id="blocker-emergency" class="blocker-button emergency">
                ⏱️ 5-Min Emergency Break
            </button>
            
            <button id="blocker-back" class="blocker-button secondary">
                ← Back to Learning
            </button>
            
            <p class="blocker-help">
                Need help? Take a scheduled break instead. 
                <a href="#" id="blocker-recommend">Get break suggestions</a>
            </p>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Event listeners
    document.getElementById('blocker-back').addEventListener('click', function() {
        overlay.remove();
        window.history.back();
    });
    
    document.getElementById('blocker-emergency').addEventListener('click', function() {
        useEmergencyBypass().then(success => {
            if (success) {
                overlay.remove();
                if (onEmergencyBypass) onEmergencyBypass();
            } else {
                alert('⚠️ No emergency bypasses remaining. Take a scheduled break instead!');
            }
        });
    });
    
    document.getElementById('blocker-recommend').addEventListener('click', function(e) {
        e.preventDefault();
        if (onEmergencyBypass) onEmergencyBypass();
    });
}

export {
    initializeBlocker,
    isBlockerEnabled,
    setBlockerEnabled,
    isBlockedSite,
    extractDomain,
    isDomainInList,
    getEmergencyBypassesRemaining,
    useEmergencyBypass,
    addToWhitelist,
    addToBlacklist,
    removeFromWhitelist,
    removeFromBlacklist,
    getWhitelist,
    getBlacklist,
    showBlockerOverlay,
    DEFAULT_WHITELIST,
    DEFAULT_BLACKLIST
};
