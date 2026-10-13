# Milestone 3 — ARIA (Action Extractor) + Notes Agent

## Goal
Build two output agents: ARIA extracts actionable steps from the video, and Notes Agent produces structured study notes. Both use the session data (transcript + VERA frames) built in Milestones 1 and 2.

---

## ARIA — Action Item Extractor

### Task 3.1 — Trigger
- Add an "Extract Actions" button in the panel
- Also auto-trigger if video title contains words like: tutorial, guide, how to, setup, install, learn

### Task 3.2 — Input Assembly
ARIA must gather:
- Full transcript (if available from session)
- OCR text from all VERA frames in current session
- Combine both into a single context block

### Task 3.3 — Agent Prompt & Output
Send the combined context to Groq. ARIA's job is to extract:
- Step-by-step actions the viewer must perform
- Commands to run (if any)
- Files to download or install (if mentioned)
- Warnings or prerequisites

Output format must be a numbered list. Each item: one clear action sentence.

### Task 3.4 — Display & Export
- Show ARIA output inside the panel under "Actions" tab
- Add a "Copy" button and a "Download .txt" button

---

## Notes Agent

### Task 3.5 — Trigger
- Add a "Generate Notes" button in the panel
- Auto-trigger when video ends (optional, user can enable in settings)

### Task 3.6 — Input Assembly
Gather from current session:
- Video title and URL
- Full transcript
- ARIA action items (if already extracted)
- OCR text from key VERA frames

### Task 3.7 — Agent Prompt & Output
Send to Groq. Notes Agent must produce structured markdown with these sections:
- `## Summary` — 3-5 sentence overview
- `## Key Concepts` — bullet list of important terms/ideas
- `## Code Snippets` — any code found in VERA frames
- `## Action Items` — from ARIA (if available)
- `## Questions to Explore` — 3 follow-up questions the viewer should research

### Task 3.8 — Export
- Show notes in panel with markdown rendering
- "Download .md" button — downloads raw markdown file
- "Download PDF" button — generates PDF using jsPDF

## Acceptance Criteria
- ARIA correctly extracts steps from a tutorial video
- Notes are generated in proper markdown structure
- Code found in frames appears in notes
- Both markdown and PDF download work
- Panel displays rendered markdown (not raw text)
