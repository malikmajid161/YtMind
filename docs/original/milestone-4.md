# Milestone 4 — KGMA (Knowledge Graph Memory Agent)

## Goal
Build persistent cross-session memory. After each video, KGMA extracts key entities and connects them to a growing knowledge graph stored in IndexedDB. Users can browse this graph and query across all their watched videos.

---

## What to Build

### Task 4.1 — Entity Extraction
- Trigger automatically when a video session ends (user navigates away or video finishes)
- Send transcript + VERA OCR text to Groq
- Ask Groq to extract: named entities, key concepts, technologies, tools, and relationships between them
- Output format must be structured JSON:
```json
{
  "nodes": [
    { "id": "node_1", "label": "React Hooks", "type": "concept" },
    { "id": "node_2", "label": "useState", "type": "tool" }
  ],
  "edges": [
    { "source": "node_1", "target": "node_2", "relation": "includes" }
  ]
}
```

### Task 4.2 — Merge into Existing Graph
- Before storing new nodes, check IndexedDB for existing nodes with the same label
- If node already exists: update it, do not duplicate
- If new node: add it
- Always add new edges between existing and new nodes where a relationship exists
- Tag each node with: which video session it came from, timestamp

### Task 4.3 — Knowledge Graph UI
- Add a "Knowledge Graph" tab in the panel
- Render the graph visually using D3.js or Cytoscape.js
- Each node is clickable — clicking it shows: what it is, which videos mentioned it, and related nodes
- Include a search bar to find a specific node by name

### Task 4.4 — Cross-Video Query
- Add a "Research Mode" in the panel
- User types a topic (e.g., "React performance")
- KGMA searches all stored session data (transcripts + frames) for that topic
- Sends combined relevant context to Groq
- Returns a unified summary across all videos

### Task 4.5 — Graph Export
- "Export Graph" button — downloads the full graph as a JSON file
- "Export Report" button — generates a markdown research report from all graph data on the current topic

## Acceptance Criteria
- After each video, nodes and edges are extracted and stored
- Watching 3 videos on the same topic builds a connected graph
- Graph renders correctly in the panel
- Clicking a node shows its details and source videos
- Cross-video research query returns a meaningful combined answer
- Graph and report can be downloaded

## Notes for Codex
- All storage is IndexedDB only — no server, no cloud
- Graph data must persist across browser sessions
- Node deduplication is critical — do not create duplicate nodes for same concept
