# Milestone 2 — VERA (Visual Frame Indexer Agent)

## Goal
Build the CV agent that silently watches the video, captures frames, and decides which ones contain meaningful visual content worth storing.

## What to Build

### Task 2.1 — Frame Capture Engine
- Every N seconds (configurable, default: 5 seconds), capture the current video frame using the Canvas API
- Store the raw frame as a base64 image temporarily in memory

### Task 2.2 — Frame Relevance Filter
VERA must decide: is this frame worth keeping?

A frame is worth keeping if it contains:
- Text (code, equations, bullet points, headings)
- A diagram or chart
- A whiteboard or slide

A frame is NOT worth keeping if it contains:
- A talking head only
- A blank screen
- Duplicate of the previous stored frame

Build this filter. Use a simple visual heuristic first (edge density, text region detection). Do not use a heavy model.

### Task 2.3 — OCR on Selected Frames
- For every frame that passes the filter, run Tesseract.js OCR on it
- Store the extracted text alongside the frame in IndexedDB under `frames` collection
- Store: `{ session_id, timestamp, image_base64, ocr_text, frame_index }`

### Task 2.4 — Deduplication
- Before storing a frame, compare its OCR text with the last stored frame's OCR text
- If similarity is above 85%, discard the new frame (it's a duplicate)
- Only store meaningfully different frames

### Task 2.5 — VERA Status Indicator
- Show a small indicator in the panel: "VERA: 12 frames indexed"
- Update this count in real time as frames are captured

## Acceptance Criteria
- Frames are captured during video playback
- Talking-head frames are discarded
- Text/diagram frames are kept and OCR'd
- Duplicate frames are not stored
- Frame count visible in panel
- All frame data stored in IndexedDB correctly

## Notes for Codex
- Use Canvas API to capture video frames — do not use any external screen capture
- Tesseract.js must run entirely in-browser
- Keep memory usage low — do not store more than 100 frames per session
- If frame limit reached, discard oldest frames first
