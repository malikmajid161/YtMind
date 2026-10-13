# Milestone 5 — SAGE (Hallucination Checker) + Final Polish

## Goal
Add SAGE as a quality-control layer over all LLM outputs. Then polish the full extension into a presentable, research-ready product.

---

## SAGE — Dual-Agent Hallucination Checker

### Task 5.1 — What SAGE Does
Every time YTMind gives an answer (Q&A, notes, action items), SAGE independently verifies it.

SAGE uses two agents:
- **Agent A** — produces the original answer (this is what already exists from Milestones 1-4)
- **Agent B** — receives only the source material (transcript + OCR frames), NOT Agent A's answer, and independently answers the same question
- **Comparator** — compares both answers and assigns a confidence tag

### Task 5.2 — Confidence Tags
After comparison, every answer gets one of three tags:
- ✅ **Verified** — both agents agree
- ⚠️ **Uncertain** — agents partially agree, some differences
- ❌ **Conflicting** — agents disagree significantly

### Task 5.3 — Display
- Show the confidence tag next to every answer in the panel
- If "Conflicting": show a warning and display both versions side by side so user can judge

### Task 5.4 — SAGE on Notes & Actions
- After Notes Agent generates notes, run SAGE on each key point
- After ARIA extracts actions, run SAGE on each step
- Flag any step or note that cannot be verified from source material

---

## Final Polish Tasks

### Task 5.5 — Settings Page
Build an extension options/settings page with:
- Groq API key input field
- Frame capture interval (default: 5 seconds)
- Auto-generate notes on video end (on/off toggle)
- Session duration display
- "Clear all data" button (wipes IndexedDB)

### Task 5.6 — Onboarding Flow
- First time user opens the extension: show a 3-step onboarding
- Step 1: Enter Groq API key
- Step 2: Brief explanation of what YTMind does
- Step 3: Open a YouTube video to start

### Task 5.7 — Panel Tabs
Organize the panel into clean tabs:
- **Chat** — RAG Q&A (from v1)
- **Actions** — ARIA output
- **Notes** — Notes Agent output
- **Graph** — KGMA knowledge graph
- **VERA** — frame count + preview of captured frames

### Task 5.8 — Error Handling
- If Groq API fails: show clear error message with retry button
- If no transcript and no VERA frames: show "No content available for this video yet"
- If IndexedDB is full: warn user and suggest clearing old sessions

### Task 5.9 — Performance Check
- Extension must not slow down YouTube playback
- VERA frame capture must not block the main thread
- All Groq calls must be async and non-blocking

## Acceptance Criteria
- SAGE tags appear on all answers, notes, and action items
- Conflicting answers are shown side by side
- Settings page works correctly
- All 5 panel tabs function correctly
- Onboarding completes successfully on fresh install
- No performance degradation on YouTube

---

## Full System — Agent Interaction Map

```
YouTube Video
      │
      ├──► Caption Capture ──────────────────────────┐
      │                                               │
      └──► VERA (Frame Indexer) ── OCR ──────────────┤
                                                      │
                                              Session Storage
                                            (IndexedDB)
                                                      │
              ┌───────────────┬──────────────┬────────┘
              │               │              │
           ARIA            Notes Agent     KGMA
      (Action Items)      (Study Notes)  (Knowledge Graph)
              │               │              │
              └───────────────┴──────────────┘
                                │
                             SAGE
                      (Hallucination Check)
                                │
                          Panel Output
                       (User sees result)
```
