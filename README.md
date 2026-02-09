# FocusGuard - AI-Powered Focus Enhancement Extension

FocusGuard (FYX) is a Chrome extension that uses facial recognition and AI to help you maintain focus during work and study sessions.

## Features

- **Real-time face detection** - Uses MediaPipe to monitor attention via your camera
- **Attention scoring** - Calculates a 0-100% focus level continuously
- **AI analysis** - Optional Gemini integration for deeper facial landmark analysis
- **Distraction intervention** - Full-screen popup when attention drops below threshold
- **Website blocking** - Blocks distracting sites during focus mode
- **Pomodoro timer** - Customizable focus sessions (default 25 minutes)
- **Session statistics** - Tracks focus performance over time

---

## Technical Architecture

### Core Files

| File | Purpose | Lines |
|------|---------|-------|
| `side-panel.js` | Main logic, UI, face detection, timer | 2,813 |
| `background.js` | Service worker, notifications, messaging | 276 |
| `content-script.js` | Website blocking, distraction popup display | 570 |
| `side-panel.html` | UI layout and structure | 520 |
| `side-panel.css` | Side panel styling | 1,784 |
| `manifest.json` | Extension configuration | 53 |

### Utility Modules (`lib/`)

| Module | Purpose |
|--------|---------|
| `mediapipe-loader.js` | MediaPipe initialization and face detection |
| `attention-analyzer.js` | Calculate attention from facial landmarks |
| `gemini-client.js` | Gemini API integration |
| `storage-manager.js` | Chrome storage helpers |
| `website-blocker.js` | Website blocking logic |
| `onboarding.js` | First-time user setup |
| `recommendations.js` | Focus suggestions |
| `quiz-generator.js` | Learning content quizzes |
| `learning-session.js` | Content extraction |

### Data Flow

```
Camera Input
    |
MediaPipe (Face Detection)
    |
Attention Analyzer (Score Calculation)
    |
Side Panel (Display + Timer)
    |
Gemini AI (Optional Analysis)
    |
Distraction Check (Score < 60%)
    |
Show Distraction Popup (on active tab)
    |
User Response (tracked)
    |
Update Statistics (Chrome storage)
```

### Message System

- **Side Panel <-> Background:** Focus state, user attention data
- **Side Panel <-> Content Script:** Distraction popup triggers
- **Background <-> Content Script:** Website blocking, response handling

---

## Installation

1. Clone or download this repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle top right)
4. Click "Load unpacked"
5. Select the FocusGuard folder
6. The FYX icon appears in your toolbar

## First Launch

1. Click the FYX icon to open the side panel
2. Complete onboarding (3 steps)
3. Click "Enable Focus Mode"
4. Allow camera access when prompted
5. Start your first focus session

---

## Configuration

| Setting | Default | Range |
|---------|---------|-------|
| Timer Duration | 25 minutes | 1-120 minutes |
| Analysis Interval | 3 seconds | 1-10 seconds |
| Gemini Interval | 5 minutes | 1-30 minutes |
| Block Websites | Disabled | Enable/Disable |
| Notifications | Enabled | Enable/Disable |

### Gemini API (Optional)

1. Get a free API key at https://ai.google.dev/
2. Open FYX Settings
3. Paste API key in the "Gemini API Key" field
4. Click "Test Connection"

---

## Website Blocking

**Blocked sites (default):**
twitter.com, tiktok.com, reddit.com, facebook.com, instagram.com, pinterest.com, twitch.tv, discord.com

**Allowed sites (whitelist):**
youtube.com, coursera.org, udemy.com, github.com, stackoverflow.com, wikipedia.org, medium.com, dev.to

Emergency 5-minute bypass available when needed.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension won't load | Remove and reload at `chrome://extensions/` |
| Camera is black | Allow camera at `chrome://settings/content/camera` |
| Popup won't show | Ensure attention < 60%, wait 30 seconds between popups |
| Blocker not working | Enable in Settings, ensure Focus Mode is active |
| Gemini errors | Check API key validity and quota |

---

## Performance

- **CPU Usage:** Minimal (throttled detection)
- **Memory:** ~50MB during active sessions
- **Popup Latency:** <100ms
- **Load Time:** <500ms

### Browser Support

- Chrome 90+
- Edge 90+
- Opera 76+
- Firefox (limited side panel support)

---

## Privacy

- All data stored locally in Chrome profile
- Camera only active during focus mode
- No cloud sync or external tracking
- Gemini API calls only if you provide a key
- Fully open source

---

## Links

- Chrome Extensions: `chrome://extensions/`
- Camera Settings: `chrome://settings/content/camera`
- Gemini API: https://ai.google.dev/
- MediaPipe: https://mediapipe.google.dev/

---

**Version:** 1.0.0
**Maintained by:** Gemini-Apex-Hackathon-Team
