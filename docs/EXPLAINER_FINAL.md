# UrjaSetu 2D Cartoon Explainer - Final Delivery Report

### Delivered Compositions
- **9:16 Vertical Video (Primary)**: [`out/explainer_916.mp4`](file:///Users/aaradhya/Downloads/newesturjasetu/videos/urjasetu-explainer/out/explainer_916.mp4)
  - Specs: 1080x1920, 30 fps, 600 frames (20.000s), H.264 / AAC 48kHz, 3.4 MB.
- **16:9 Landscape Video**: [`out/explainer_169.mp4`](file:///Users/aaradhya/Downloads/newesturjasetu/videos/urjasetu-explainer/out/explainer_169.mp4)
  - Specs: 1920x1080, 30 fps, 600 frames (20.000s), H.264 / AAC 48kHz, 3.3 MB.

### Production & Compliance Summary
- **Visuals**: 100% vector SVG/React animated code. Zero raster images, zero stock footage, no `<Img>` tags.
- **Palette**: Brand Navy (`#14212B`, `#1B3340`), Teal (`#0F5C63`, `#2FB8B8`), Green (`#3FBF7F`), White (`#FAFAF7`), Orange (`#F5A524`), Heat Red (`#D64530`).
- **Character Rig**: Young Indian male in casual teal shirt and high-contrast trousers. Full rig with eye blinking, expressive eyebrow gestures, head tilt, walk cycle, and sample-accurate lip sync.
- **Story**: 5 storyboard scenes (Pune Heat Street -> Meet UrjaSetu Map -> Satellite & 3 Data Layers -> Urban Greening & Cooling Transformation -> Green Bridge & Hero Closing).
- **Subtitles**: Animated word-by-word captions in safe zone (`y=1400` in 9:16), active word highlighted `#F5A524`.
- **Audio**: Generated via macOS Rishi voice (`en_IN` male), mastered with loudnorm to -16 LUFS, padded to exact 20.000s.
- **Disclaimers**: "Illustrative" badge visible on maps and anchored on the final end card hold. No unauthorized claims or statistics.

### Re-render Commands
```bash
cd videos/urjasetu-explainer
npm run build:audio
npm run render:916
npm run render:169
```
