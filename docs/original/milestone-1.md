# Milestone 1 — Foundation & Session Layer

## Goal
Set up the base architecture that all agents will use. This is the backbone of the entire project.

## What to Build

### Task 1.1 — Manifest V3 Setup
- Create a valid Chrome Extension manifest
- Declare permissions: activeTab, storage, scripting, tabs
- Register content script for YouTube pages only (`*://www.youtube.com/watch*`)
- Register background service worker

### Task 1.2 — YouTube Panel Injection
- Inject a floating side panel into YouTube watch pages
- Panel must open/close via a button in the YouTube toolbar
- Panel must survive YouTube's SPA navigation (when user switches videos without page reload)

### Task 1.3 — Session Manager
- When a new video loads, start a new session
- Session stores: video ID, video title, video URL, start timestamp
- Session data lives in IndexedDB
- Sessions expire after 24 hours — auto-delete on extension load if expired
- When a session expires, show a notification to the user: "YTMind session ended. Starting fresh."

### Task 1.4 — Groq API Integration
- Store Groq API key in Chrome local storage (user enters it in settings once)
- Create a shared utility function that all agents will use to call Groq
- Handle rate limit errors gracefully — show user a friendly message

### Task 1.5 — Caption/Transcript Capture
- Detect if YouTube captions are available on current video
- If available: capture full transcript and store in current session
- If not available: store a flag `captions_unavailable: true` — VERA will handle this case

### Task 1.6 — IndexedDB Schema
Set up the following collections in IndexedDB:
- `sessions` — one record per video session
- `frames` — selected frames stored by VERA
- `knowledge_nodes` — entities stored by KGMA
- `knowledge_edges` — relationships between nodes

## Acceptance Criteria
- Extension loads on YouTube without errors
- Panel opens and closes correctly
- A new session is created when a video loads
- Old sessions (24h+) are deleted on startup
- Groq API call works from the extension
- Transcript is captured when captions exist

## Do Not Build Yet
- Any agent logic
- Notes export
- Knowledge graph UI
