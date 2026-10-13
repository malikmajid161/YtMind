# Milestone 2 — VERA visual evidence

Deliver local, timestamped capture and OCR with configurable throughput on capable hardware.

## Deliverables

- Explicit start/pause and manual capture; automatic lease expires if the panel disappears.
- Skip paused/hidden playback and ads; canvas capture only.
- Performance profile: up to 1600px frames and two OCR slots. Balanced: 960px and one slot.
- Small-image change/edge heuristic before OCR; configurable interval from 3 to 60 seconds.
- Bundled local Tesseract worker, WASM and English trained data; no runtime CDN.
- OCR text similarity deduplication, six-pending-frame backpressure, 100 stored frames per video, oldest-first eviction.
- Preview, confidence, status, retry and timestamp controls.

## Acceptance

Packaged OCR recognizes a controlled slide without network language downloads. Storage remains bounded; retries work; new videos do not inherit the old capture lease. Flat frames are rejected and manual capture bypasses heuristic filtering.

## Competitive target

Measure text character error rate, code exact-match accuracy, useful-frame recall and playback overhead. Compare visual evidence against transcript-only baselines. Diagram semantics and multilingual OCR remain separate improvements, not assumed capabilities.
