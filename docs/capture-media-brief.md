# Home-page demo

Recorded September 28, 2026, from the current local interface with Convex and analytics disabled. The example is a private concept on Logan Street by Governors Park in Denver. It does not assert a surveyed street condition, publish an observation, or send anything to the city.

## Delivered assets

- `public/demo-videos/community-workflow.webm`: VP9 browser source.
- `public/demo-videos/community-workflow.mp4`: H.264 fallback with fast-start metadata.
- `public/demo-screenshots/community-workflow.jpg`: matching still from the recording.

The silent walkthrough is approximately 38 seconds. Native playback controls, no autoplay, no loop. Map attribution is linked below the player. The old Humboldt Park footage and its landing poster have been removed.

## What it shows

1. Select a block and choose Sketch a change.
2. Write an example concern and desired outcome.
3. Choose an approximate street layout and a two-way protected bike lane.
4. Compare before and after on the map, then show the editor dock.
5. Prepare and download the discussion brief.

The full capture includes placement adjustment and a descriptive location label. The published cut removes setup, waits, and a zoom beyond the basemap's available layer range. It preserves the action order and uses modest speed changes; no interface states or activity are synthesized.

## Capture provenance

The actual browser window was recorded with macOS screen capture while interacting through the visible UI. Source footage and the edit recipe remain locally in `tmp/community-demo-2026-09-28/` and are not deployment assets. The source recording is `source.mov`; `assemble.py` documents the crop, cuts, and timing. The final MP4 is re-encoded as one continuous H.264 stream for compatibility, with a VP9 alternative.

For the next recording, use a clean local demo, an explicitly labeled example, and current controls. Keep the raw capture outside `public/`, crop browser chrome only, and inspect playback and the matching poster before replacing these files. Do not reuse the retired script, whose selectors described the older interface.
