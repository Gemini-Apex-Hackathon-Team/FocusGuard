import { getApiKey, setApiKey, getSettings, saveSettings, getSuggestions, saveSuggestions, resetAllSettings, DEFAULT_SUGGESTIONS } from './lib/storage-manager.js';
import { testConnection } from './lib/gemini-client.js';

const elements = {
    backButton: document.getElementById('backButton'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    toggleApiKey: document.getElementById('toggleApiKey'),
    saveApiKey: document.getElementById('saveApiKey'),
    testApiKey: document.getElementById('testApiKey'),
    apiKeyStatus: document.getElementById('apiKeyStatus'),
    analysisInterval: document.getElementById('analysisInterval'),
    enableGemini: document.getElementById('enableGemini'),
    enableSwitchSuggestions: document.getElementById('enableSwitchSuggestions'),
    suggestionList: document.getElementById('suggestionList'),
    newSuggestionTitle: document.getElementById('newSuggestionTitle'),
    newSuggestionUrl: document.getElementById('newSuggestionUrl'),
    newSuggestionDesc: document.getElementById('newSuggestionDesc'),
    addSuggestion: document.getElementById('addSuggestion'),
    resetSettings: document.getElementById('resetSettings')
};

let currentSuggestions = [];

async function initialize() {
    const apiKey = await getApiKey();
    if (apiKey) {
        elements.apiKeyInput.value = apiKey;
    }

    const settings = await getSettings();
    elements.analysisInterval.value = settings.analysisInterval;
    elements.enableGemini.checked = settings.enableGemini;
    elements.enableSwitchSuggestions.checked = settings.enableSwitchSuggestions;

    currentSuggestions = await getSuggestions();
    renderSuggestionList();

    setupEventListeners();
}

function setupEventListeners() {
    elements.backButton.addEventListener('click', goBack);
    elements.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
    elements.saveApiKey.addEventListener('click', saveApiKeyHandler);
    elements.testApiKey.addEventListener('click', testApiKeyHandler);
    elements.analysisInterval.addEventListener('change', saveSettingsHandler);
    elements.enableGemini.addEventListener('change', saveSettingsHandler);
    elements.enableSwitchSuggestions.addEventListener('change', saveSettingsHandler);
    elements.addSuggestion.addEventListener('click', addSuggestionHandler);
    elements.resetSettings.addEventListener('click', resetSettingsHandler);
}

function goBack() {
    window.close();
}

function toggleApiKeyVisibility() {
    if (elements.apiKeyInput.type === 'password') {
        elements.apiKeyInput.type = 'text';
        elements.toggleApiKey.textContent = 'Hide';
    } else {
        elements.apiKeyInput.type = 'password';
        elements.toggleApiKey.textContent = 'Show';
    }
}

async function saveApiKeyHandler() {
    const key = elements.apiKeyInput.value.trim();

    if (!key) {
        showApiKeyStatus('Please enter an API key', 'error');
        return;
    }

    await setApiKey(key);
    showApiKeyStatus('API key saved', 'success');
}

async function testApiKeyHandler() {
    const key = elements.apiKeyInput.value.trim();

    if (!key) {
        showApiKeyStatus('Please enter an API key first', 'error');
        return;
    }

    showApiKeyStatus('Testing connection...', 'info');

    try {
        await testConnection(key);
        showApiKeyStatus('Connection successful', 'success');
    } catch (error) {
        showApiKeyStatus('Connection failed: ' + error.message, 'error');
    }
}

function showApiKeyStatus(message, type) {
    elements.apiKeyStatus.textContent = message;
    elements.apiKeyStatus.className = 'status-message ' + type;
    elements.apiKeyStatus.classList.remove('hidden');
}

async function saveSettingsHandler() {
    const settings = {
        analysisInterval: parseInt(elements.analysisInterval.value),
        enableGemini: elements.enableGemini.checked,
        enableSwitchSuggestions: elements.enableSwitchSuggestions.checked
    };

    await saveSettings(settings);
}

function renderSuggestionList() {
    elements.suggestionList.innerHTML = '';

    currentSuggestions.forEach(function(suggestion, index) {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = '<span class="suggestion-item-title">' + suggestion.title + '</span>' +
            '<button class="suggestion-item-remove" data-index="' + index + '">Remove</button>';
        elements.suggestionList.appendChild(div);
    });

    document.querySelectorAll('.suggestion-item-remove').forEach(function(button) {
        button.addEventListener('click', removeSuggestionHandler);
    });
}

async function addSuggestionHandler() {
    const title = elements.newSuggestionTitle.value.trim();
    const url = elements.newSuggestionUrl.value.trim();
    const description = elements.newSuggestionDesc.value.trim();

    if (!title) {
        return;
    }

    const newSuggestion = {
        id: 'custom_' + Date.now(),
        title: title,
        url: url || '',
        description: description || ''
    };

    currentSuggestions.push(newSuggestion);
    await saveSuggestions(currentSuggestions);

    elements.newSuggestionTitle.value = '';
    elements.newSuggestionUrl.value = '';
    elements.newSuggestionDesc.value = '';

    renderSuggestionList();
}

async function removeSuggestionHandler(event) {
    const index = parseInt(event.target.dataset.index);
    currentSuggestions.splice(index, 1);
    await saveSuggestions(currentSuggestions);
    renderSuggestionList();
}

async function resetSettingsHandler() {
    const confirmed = confirm('This will reset all settings and remove your API key. Continue?');

    if (confirmed) {
        await resetAllSettings();
        window.location.reload();
    }
}

initialize();
