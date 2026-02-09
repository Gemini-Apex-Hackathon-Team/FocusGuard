# Icons Needed

For the extension to work properly, you need to add the following icon files to the `/icons` directory:

## Required Files

1. **icon16.png** - 16x16 pixels - Toolbar icon
2. **icon48.png** - 48x48 pixels - Extension management page
3. **icon128.png** - 128x128 pixels - Chrome Web Store

## Design Guidelines

- Use the brain emoji 🧠 as the base
- Colors: Blue (#3b82f6) and Purple (#8b5cf6) gradient
- Simple, recognizable design at small sizes
- Transparent background

## Quick Solution

You can use emoji-to-icon converters or create simple icons with:

1. **Online Tool**: [favicon.io](https://favicon.io/emoji-favicons/brain/)
   - Select the brain emoji
   - Download all sizes
   - Rename to match requirements

2. **Design Tool** (Figma/Canva):
   - Create 128x128 canvas
   - Add brain emoji or icon
   - Apply gradient overlay
   - Export as PNG at 16px, 48px, and 128px

3. **Placeholder** (for testing):
   - Any PNG files with correct dimensions will work
   - Extension will load without icons but won't look polished

## Implementation

Once you have the icons:
```bash
cp icon16.png /fyx-extension/icons/
cp icon48.png /fyx-extension/icons/
cp icon128.png /fyx-extension/icons/
```

Then reload the extension in Chrome.
