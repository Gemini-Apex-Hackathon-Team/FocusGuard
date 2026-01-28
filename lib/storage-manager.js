const STORAGE_KEYS = {
    API_KEY: 'gemini_api_key',
    SETTINGS: 'focusguard_settings',
    SUGGESTIONS: 'switch_suggestions'
};

const DEFAULT_SETTINGS = {
    analysisInterval: 3,
    enableGemini: true,
    enableSwitchSuggestions: true
};

const DEFAULT_SUGGESTIONS = [
    {
        id: 'break',
        title: 'Take a Short Break',
        description: 'Step away for 5 minutes to reset your focus',
        url: ''
    },
    {
        id: 'stretch',
        title: 'Quick Stretching',
        description: 'Do some desk stretches to refresh your body',
        url: 'https://www.youtube.com/results?search_query=5+minute+desk+stretches'
    },
    {
        id: 'breathing',
        title: 'Breathing Exercise',
        description: 'Try a quick breathing exercise to regain focus',
        url: 'https://www.youtube.com/results?search_query=2+minute+breathing+exercise'
    },
    {
        id: 'water',
        title: 'Hydration Break',
        description: 'Get a glass of water and hydrate',
        url: ''
    },
    {
        id: 'walk',
        title: 'Short Walk',
        description: 'Take a quick walk around to boost energy',
        url: ''
    }
];

async function getApiKey() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
    return result[STORAGE_KEYS.API_KEY] || null;
}

async function setApiKey(key) {
    await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: key });
}

async function removeApiKey() {
    await chrome.storage.local.remove(STORAGE_KEYS.API_KEY);
}

async function getSettings() {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
}

async function saveSettings(settings) {
    await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

async function getSuggestions() {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SUGGESTIONS);
    return result[STORAGE_KEYS.SUGGESTIONS] || DEFAULT_SUGGESTIONS;
}

async function saveSuggestions(suggestions) {
    await chrome.storage.sync.set({ [STORAGE_KEYS.SUGGESTIONS]: suggestions });
}

async function resetAllSettings() {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
}

export {
    getApiKey,
    setApiKey,
    removeApiKey,
    getSettings,
    saveSettings,
    getSuggestions,
    saveSuggestions,
    resetAllSettings,
    DEFAULT_SETTINGS,
    DEFAULT_SUGGESTIONS
};
