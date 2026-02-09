# FYX Installation Instructions

## Installation Methods

### Method 1: Chrome Extension (Recommended for Users)

1. **Download FYX**
   - Download this entire folder
   - Or clone: `git clone <repository-url>`

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Or: Menu (⋮) → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the `fyx-extension` folder
   - FYX should appear in your extensions!

5. **Pin to Toolbar** (Optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Find FYX in the list
   - Click the pin icon to keep it visible

6. **Set Gemini Key Once**
   - Open `local-config.js`
   - Replace `PASTE_NEW_GEMINI_KEY_HERE` with your key

7. **Complete Setup**
   - FYX will auto-open the onboarding page
   - Follow the 5-step setup process
   - No user API key prompt is shown

### Method 2: Standalone App Demo (Hackathon Friendly)

1. Open a terminal in this folder
2. Run a local server:
   ```bash
   python3 -m http.server 8080
   ```
3. Open `http://localhost:8080/app.html`
4. Set key in `local-config.js` and enter only session goal in UI
5. Allow webcam access and start session

### Method 3: From Source (For Developers)

```bash
# Clone the repository
git clone <repository-url>
cd fyx-extension

# No build step needed - it's pure JavaScript!

# Load in Chrome as described in Method 1
```

## Getting Your Gemini API Key

FYX requires a Gemini API key to function. Here's how to get one:

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" or "Get API Key"
4. Copy the generated key (starts with `AIza...`)
5. Keep it secure - you'll enter it during FYX onboarding

**Free Tier Limits:**
- 60 requests per minute
- 1,500 requests per day
- More than enough for personal use!

## Verifying Installation

After installing, verify everything works:

1. ✅ FYX icon appears in Chrome toolbar
2. ✅ Clicking icon opens the popup control panel
3. ✅ Onboarding page opens automatically
4. ✅ After setup, browsing any page shows the attention indicator

## First-Time Usage

**Recommended First Steps:**

1. Complete the onboarding questionnaire honestly
2. Start with default settings (don't customize yet)
3. Browse normally for 10 minutes to let FYX learn
4. Try your first focus session
5. Review your stats in the popup
6. Adjust settings based on your experience

**What to Expect:**

- **First 5 minutes**: FYX is learning your patterns
- **After 10 minutes**: You might get your first intervention
- **After 15 minutes**: First quiz may appear (if enabled)
- **After 25 minutes**: Suggested break if you started a session

## Updating FYX

When a new version is released:

1. Download the new version
2. Go to `chrome://extensions/`
3. Find FYX and click "Remove"
4. Load the new unpacked extension
5. Your settings and data are preserved!

**Note**: Update checking is automatic once FYX is on the Chrome Web Store.

## Uninstallation

To remove FYX:

1. Go to `chrome://extensions/`
2. Find FYX in the list
3. Click "Remove"
4. Confirm removal

**Note**: This will delete all local data including:
- Attention score history
- Daily statistics
- Custom settings
- Blocked sites list

## Troubleshooting Installation

### "Load unpacked" button is grayed out
→ Enable Developer Mode first (toggle in top-right)

### Extension won't load
→ Make sure you selected the `fyx-extension` folder (not a subfolder)

### Icons not showing
→ Icons are optional for testing. See `icons/ICONS_README.md` for details

### Onboarding doesn't auto-open
→ Manually navigate to: `chrome-extension://<extension-id>/onboarding.html`
→ Find extension ID in `chrome://extensions/` under FYX

### "Invalid manifest" error
→ Ensure you downloaded the complete folder
→ Check that `manifest.json` is in the root directory

## System Requirements

- **Browser**: Chrome 88+ or any Chromium-based browser (Edge, Brave, Opera)
- **OS**: Windows, macOS, Linux, ChromeOS
- **Internet**: Required for Gemini API calls
- **Storage**: <5MB for extension + local data

## Getting Support

- **Setup Issues**: See SETUP.md for detailed guide
- **Technical Problems**: Check README.md troubleshooting section
- **Bug Reports**: Open an issue on GitHub
- **Feature Requests**: Use GitHub Discussions

---

**Ready to install? Let's get started! 🚀**
