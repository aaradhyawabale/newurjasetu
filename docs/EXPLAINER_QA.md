# UrjaSetu 2D Explainer Video QA Log

## Overview
- Project: UrjaSetu 20s 2D Vector Cartoon Explainer
- Primary Composition: `Explainer916` (1080x1920, 30 fps, 600 frames, 20.000s)
- Landscape Composition: `Explainer169` (1920x1080, 30 fps, 600 frames, 20.000s)
- Output Location: `videos/urjasetu-explainer/out/`

## Exit Checks Checklist
- [x] **E1**: Exact duration 20.000s (600 frames at 30 fps) on both compositions
- [x] **E2**: True dimensions (1080x1920 for 9:16, 1920x1080 for 16:9)
- [x] **E3**: Audio present, synced, no clipping, speech clear (mastered to -16 LUFS with loudnorm)
- [x] **E4**: Word-by-word subtitles within safe zone (y=1400 on 9:16), current word highlighted `#F5A524`
- [x] **E5**: Rigged SVG character with expressions, blinking, walk cycle, lip sync, and connected anatomy
- [x] **E6**: All 5 storyboard scenes present with smooth 10-frame cross-fades
- [x] **E7**: "Illustrative" tag present on map and end card; zero raster images, zero unapproved claims

## Iteration History
### Iteration 1 - Initial Assembly & Audio Pipeline
- Generated 5 voice lines using macOS `say -v Rishi` (en_IN male voice).
- Built 20.000s master WAV track with exact sample padding and `timing.json` word timestamps + mouth shapes.
- Initial render of `Explainer916`.
- Findings:
  1. Character trousers blended with dark navy background (`#14212B`).
  2. Subtitles pill overlapped character knees in 9:16 layout.
  3. AI Planning chip was inverted prior to entrance due to unclamped interpolation.
  4. Badges in Scene 4 overlapped character head.

### Iteration 2 - Rigging & Visual Polishing
- Redesigned Character rig: slate denim trousers (`#334E68` / `#243B53`), shirt sleeves, grounded shoes, natural hero thumbs-up gesture.
- Relocated subtitles to y=1400 (safe zone) with clean fade-out for end card hold.
- Fixed AI Planning chip scale clamp (`extrapolateLeft: 'clamp'`).
- Repositioned Scene 4 badges clear of character.
- Grounded character feet firmly on Pune sidewalk (S1) and bridge deck (S5).
- Re-rendered both `Explainer916` and `Explainer169`. All exit checks E1-E7 verified.
