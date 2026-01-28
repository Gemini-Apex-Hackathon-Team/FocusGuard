chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        chrome.storage.sync.set({
            focusguard_settings: {
                analysisInterval: 3,
                enableGemini: true,
                enableSwitchSuggestions: true
            }
        });
    }
});
