# FYX Setup Guide

## Quick Start (5 Minutes)

### Step 1: Get Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key (starts with `AIza...`)
5. Put it in `local-config.js` as `GEMINI_API_KEY`

**Note**: Gemini API is free for personal use with generous limits!

### Step 2: Install FYX Extension

**Option A: Load as Unpacked Extension (Development)**
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `fyx-extension` folder
6. FYX icon should appear in your toolbar! 🧠

**Option B: Install from Chrome Web Store** *(Coming Soon)*
- FYX will be available on the Chrome Web Store soon!

### Step 3: Complete Onboarding

FYX will automatically open when installed. Follow these steps:

1. **Welcome Screen**
   - Read about FYX features
   - Click "Get Started"

2. **Attention Assessment**
   - Rate your attention span honestly (1-10)
   - This helps customize your experience
   - Click "Next"

3. **No End-User API Key Prompt**
   - Key is loaded from `local-config.js`
   - Users proceed directly through onboarding

4. **You're Done!**
   - Click "Start Using FYX"
   - The extension is now active!

### Step 4: Try Your First Focus Session

1. Click the FYX icon in your Chrome toolbar
2. Click "Start Focus Session"
3. Browse normally - FYX will monitor your attention
4. Watch the floating attention indicator (bottom-right)
5. When your focus drops, you'll get helpful AI suggestions!

### Optional: Run as Standalone App

1. Run:
   ```bash
   python3 -m http.server 8080
   ```
2. Open `http://localhost:8080/app.html`
3. Enter session goal only (key is read from `local-config.js`)
4. Start webcam session to test face-movement tracking + Gemini agent coaching

---

## Understanding the Interface

### Popup Control Panel

Click the FYX icon to access:

- **Attention Score**: Real-time focus measurement (0-100)
- **Start Focus Session**: Begin a timed work period
- **Take a Break**: Request a break now
- **Today's Stats**: Sessions, focus time, breaks taken
- **Quick Settings**: Toggle features on/off

### On-Page Elements

While browsing, you'll see:

1. **Attention Indicator** (bottom-right circle)
   - Green (70-100): Excellent focus
   - Yellow (40-69): Moderate focus
   - Red (0-39): Low focus - intervention coming

2. **Intervention Overlays**
   - Appear when focus drops
   - Provide personalized suggestions
   - Can be dismissed or acted on

3. **Quiz Overlays**
   - Pop up every 15 minutes (configurable)
   - Test comprehension of current content
   - Correct answers boost your score!

4. **Break Screens**
   - Lock screen during breaks
   - Suggest activities (stretching, breathing, etc.)
   - Countdown timer

---

## Customizing Your Experience

### Recommended Settings for Different Users

**For Students (Easily Distracted)**
- Attention Level: 3-5
- Quiz Frequency: 10 minutes
- Enable all features
- Add social media to blocked sites

**For Remote Workers (Moderate Focus)**
- Attention Level: 5-7
- Quiz Frequency: 15 minutes
- Enable interventions and breaks
- Disable quizzes if distracting

**For Deep Workers (Strong Focus)**
- Attention Level: 7-10
- Quiz Frequency: 20-30 minutes
- Minimal interventions
- Focus on statistics tracking

### Blocking Distracting Sites

1. Click FYX icon → "Advanced Settings"
2. Go to "Blocked Sites" section
3. Add domains you want to block:
   - `youtube.com` (blocks all YouTube)
   - `reddit.com`
   - `twitter.com`
   - etc.
4. During focus sessions, these sites will show a motivation screen

### Adjusting Quiz Frequency

If quizzes feel too frequent or infrequent:

1. Click FYX icon
2. Find "Quiz Frequency" dropdown
3. Choose: 10, 15, 20, or 30 minutes
4. Changes apply immediately

---

## Tips for Success

### 🎯 Best Practices

1. **Start Small**: Begin with 25-minute focus sessions
2. **Be Honest**: Answer the attention assessment truthfully
3. **Take Breaks**: Don't skip the break screens - your brain needs them
4. **Review Stats**: Check daily progress to stay motivated
5. **Adjust Settings**: Fine-tune based on what works for you

### 🚫 Common Mistakes

1. **Skipping Onboarding**: The attention assessment personalizes your experience
2. **Ignoring Interventions**: They're there to help - give them a try!
3. **Disabling All Features**: Start with defaults, then customize
4. **Not Taking Breaks**: Breaks improve long-term focus
5. **Comparing Scores**: Your score is personal - focus on your own progress

### 💡 Advanced Usage

**For Maximum Productivity:**
1. Block all social media before starting
2. Use 45-minute focus sessions for deep work
3. Enable quizzes on educational content
4. Review weekly trends in dashboard *(coming soon)*

**For Learning:**
1. Enable quizzes every 10 minutes
2. Use on educational videos and articles
3. Review quiz performance to identify weak areas
4. Take breaks to consolidate learning

---

## Troubleshooting

### "Can't find API key field during setup"
→ Make sure you're on Step 3 of onboarding. Click "Next" on steps 1 and 2.

### "Extension not tracking my attention"
→ Try:
1. Refresh the page you're on
2. Check if the FYX icon is visible in toolbar
3. Go to `chrome://extensions/` and ensure FYX is enabled

### "Too many/too few interventions"
→ Adjust your attention level:
1. Open FYX popup
2. Click "Advanced Settings"
3. Change "Attention Level" setting
4. Higher = fewer interventions

### "Quizzes on wrong content"
→ Some pages are difficult to parse. You can:
1. Disable quizzes for specific sites
2. Adjust quiz frequency
3. Manually dismiss irrelevant quizzes

### "Break screens not appearing"
→ Check that:
1. "Break Reminders" is enabled in settings
2. You're in an active focus session
3. Your attention score has dropped below 50

---

## Privacy & Security FAQs

**Q: What data does FYX collect?**
A: Only local engagement metrics (scrolls, clicks, tab switches). No personal data.

**Q: Is my API key secure?**
A: Yes! It's stored locally in Chrome and never sent anywhere except to Gemini API.

**Q: Does FYX use my webcam?**
A: No. Despite mentioning face tracking in planning, this version doesn't use your camera.

**Q: What gets sent to Gemini API?**
A: Only page content excerpts for quizzes and your attention score for suggestions.

**Q: Can my employer see my FYX data?**
A: No. All data stays on your device.

---

## Getting Help

- **Documentation**: See README.md for full details
- **Issues**: Report bugs on GitHub Issues
- **Feature Requests**: Use GitHub Discussions
- **Email**: support@fyx-extension.com *(coming soon)*

---

## Next Steps

Now that you're set up:

1. ✅ Complete your first focus session
2. ✅ Try answering a quiz
3. ✅ Review your daily stats
4. ✅ Customize your blocked sites list
5. ✅ Share FYX with friends who struggle with focus!

**Happy focusing! 🧠✨**
