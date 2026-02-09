# FYX - Focus Extension with Gemini AI

> **Working with your brain, not against it**

FYX is an intelligent focus tracker that runs in two modes:
- Chrome extension mode for in-browser monitoring/interventions
- Standalone app mode (`app.html`) for webcam + Gemini agent coaching demos

It helps combat attention fragmentation and context switching using the Gemini API with real-time attention monitoring and AI-powered interventions.

![FYX Logo](icons/icon128.png)

## 🧠 The Problem

Modern digital environments constantly pull our attention away, training our brains to favor what is stimulating, fast, and comfortable over what is meaningful or demanding. This leads to:

- **Context switching**: Rapidly shifting between tasks, tabs, and thoughts
- **Attention fragmentation**: Unable to maintain sustained focus
- **Reduced comprehension**: Consuming content without actually learning
- **Cognitive fatigue**: Mental exhaustion from constant task-switching

## ✨ The Solution

FYX addresses these issues by:

1. **Real-time Attention Tracking**: Monitors engagement through scroll patterns, mouse activity, tab visibility, and context switches
2. **AI-Powered Interventions**: Uses Gemini API to provide personalized, empathetic suggestions when focus drops
3. **Content Comprehension Quizzes**: Verifies you're actually learning from videos and articles
4. **Smart Break Management**: Suggests breaks at optimal times based on your attention patterns
5. **Focus Sessions**: Pomodoro-style work sessions with enforced breaks

## 🚀 Features

### Core Features

- ✅ **Attention Score Monitoring** - Real-time focus tracking (0-100 scale)
- ✅ **AI Interventions** - Gemini-powered suggestions when focus drops
- ✅ **Draggable Popups** - Intervention/quiz popups can be moved and position is remembered
- ✅ **Content Quizzes** - Auto-generated comprehension questions
- ✅ **Smart Breaks** - AI-suggested break timing and activities
- ✅ **Agent Break Tab** - Opens a bright challenge tab when distraction signals are high
- ✅ **Focus Sessions** - Customizable Pomodoro timers
- ✅ **Website Blocking** - Block distracting sites during focus sessions
- ✅ **Progress Tracking** - Daily statistics and trends
- ✅ **Standalone App Mode** - Works as a regular web app for hackathon demos
- ✅ **Privacy-First** - All processing happens locally, no data sent except to Gemini API

### AI Capabilities (Powered by Gemini)

- Personalized focus interventions based on your attention patterns
- Context-aware break suggestions
- Auto-generated comprehension quizzes from any webpage or video
- Empathetic check-ins when you're struggling

## 📦 Installation

### Prerequisites

1. **Chrome Browser** (or Chromium-based browser)
2. **Gemini API Key** - [Get one free here](https://makersuite.google.com/app/apikey)

### Steps

1. **Download the Extension**
   ```bash
   git clone https://github.com/yourusername/fyx-extension.git
   cd fyx-extension
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `fyx-extension` folder

3. **Complete Onboarding**
   - FYX will automatically open the onboarding flow
   - Answer the attention span assessment
   - API key is preconfigured in `local-config.js`
   - You're ready to go!

Before loading the extension, set your key once:

```javascript
// local-config.js
self.FYX_LOCAL_CONFIG = {
  GEMINI_API_KEY: 'YOUR_GEMINI_KEY'
};
```

## 🖥️ Standalone App Mode

Run FYX as an app (outside extension popup):

1. Start a local static server in this folder:
   ```bash
   python3 -m http.server 8080
   ```
2. Open `http://localhost:8080/app.html`
3. Enter your Gemini API key and session goal
4. Allow camera access and click **Start Session**

## 🔧 Configuration

### Initial Setup

During onboarding, you'll configure:

- **Attention Level** (1-10): How you rate your current focus ability
- **API Key**: Your Gemini API key for AI features

### Settings

Access settings by clicking the FYX icon in your toolbar:

- **Content Quizzes**: Enable/disable comprehension quizzes
- **AI Interventions**: Enable/disable focus suggestions
- **Break Reminders**: Enable/disable smart breaks
- **Quiz Frequency**: How often to show quizzes (10-30 min intervals)

### Advanced Settings

Click "Advanced Settings" in the popup to configure:

- Blocked websites list
- Custom focus session durations
- Break activity preferences
- Notification preferences

## 💡 How to Use

### Daily Workflow

1. **Start Your Day**
   - Click the FYX icon to check your focus score
   - Review yesterday's statistics

2. **Begin a Focus Session**
   - Click "Start Focus Session" in the popup
   - Choose your duration (default: 25 minutes)
   - FYX will monitor your attention and intervene if needed

3. **During Work**
   - The floating attention indicator shows your current score
   - If focus drops, you'll get gentle AI suggestions
   - Quizzes will appear periodically to verify comprehension

4. **Take Breaks**
   - When prompted, take suggested breaks
   - Try the recommended activities
   - Return refreshed and refocused

### Understanding Your Attention Score

| Score | Status | What It Means |
|-------|--------|---------------|
| 80-100 | Excellent | Highly focused and engaged |
| 60-79 | Good | Maintaining solid focus |
| 40-59 | Moderate | Attention is wavering |
| 0-39 | Low | Time for intervention |

### Intervention Examples

When your attention drops, Gemini might suggest:

> "You've been at this for a while. Take 2 minutes to stretch and look away from the screen. Your focus will thank you!"

> "Noticed you're switching tabs frequently. Try closing unnecessary tabs and focusing on just one task for the next 10 minutes."

## 🔐 Privacy & Security

FYX takes your privacy seriously:

- ✅ **Local Processing**: All attention tracking happens on your device
- ✅ **No Screenshots**: We never capture or store images
- ✅ **Minimal Data**: Only engagement metrics are tracked
- ✅ **API Key Storage**: Your Gemini key is stored locally in Chrome
- ✅ **No Analytics**: We don't track your usage patterns

### What Gets Sent to Gemini API

Only the following is sent when needed:

- Page content excerpts (for quiz generation)
- Current attention score (for intervention suggestions)
- Context about your focus session

## 🛠️ Development

### Project Structure

```
fyx-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (attention logic, API calls)
├── content.js            # Page engagement tracking
├── content.css           # Overlay styles
├── popup.html            # Extension popup UI
├── popup.css             # Popup styles
├── popup.js              # Popup logic
├── onboarding.html       # First-time setup
├── onboarding.js         # Onboarding logic
└── icons/                # Extension icons
```

### Key Components

**Background Service Worker** (`background.js`)
- Manages attention score calculations
- Handles Gemini API calls
- Coordinates interventions and quizzes
- Tracks statistics

**Content Script** (`content.js`)
- Monitors page engagement (scrolls, clicks, visibility)
- Shows intervention overlays
- Displays quizzes and break screens
- Updates attention indicator

**Popup** (`popup.html/js`)
- Control panel for quick actions
- Displays current attention score
- Shows daily statistics
- Settings management

### API Integration

FYX uses Gemini (`gemini-2.5-flash` by default) for:

```javascript
// Example intervention call
const response = await fetch(GEMINI_API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      parts: [{ text: interventionPrompt }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 150
    }
  })
});
```

### Customization

You can customize FYX by modifying:

- **Attention Algorithm** (`background.js` - `calculateAttentionScore()`)
- **Intervention Prompts** (`background.js` - `generateInterventionPrompt()`)
- **UI Styles** (`content.css`, `popup.css`)
- **Quiz Logic** (`background.js` - `generateQuiz()`)

## 🐛 Troubleshooting

### Common Issues

**"API key invalid"**
- Verify your Gemini API key is correct
- Check it starts with "AIza"
- Get a new key at [Google AI Studio](https://makersuite.google.com/app/apikey)

**"Attention score stuck at 100"**
- Extension might not be tracking properly
- Try refreshing the page
- Check Chrome extensions page for errors

**"Quizzes not appearing"**
- Verify "Content Quizzes" is enabled in settings
- Check the quiz frequency setting
- Some pages may not have enough content for quizzes

**"Interventions feel too frequent"**
- Adjust your attention level in settings
- Interventions are tuned to your initial assessment

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Test thoroughly before submitting
- Update README if adding new features
- Respect user privacy in all changes

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with [Gemini API](https://ai.google.dev/)
- Inspired by research on attention and cognitive psychology
- Thanks to all contributors and testers

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/fyx-extension/issues)

## 🧩 Third-Party Integrations

- Gemini API (Google AI Studio key required)
- Browser Shape Detection API (`FaceDetector`) for extension/app camera tracking
- Browser Shape Detection API (`FaceDetector`) in standalone app mode (Chrome-based browsers)
- **Documentation**: [Wiki](https://github.com/yourusername/fyx-extension/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/fyx-extension/discussions)

---

**Built with 🧠 by the FYX Team**

*Working with your brain, not against it.*
