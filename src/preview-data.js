// Explicit design-preview fixtures. Never loaded as live user learning data.
import { defaults, TTL } from "./core.js";
const id = "preview-video";
const evidence = [
  {
    id: `${id}:0`,
    videoId: id,
    title: "A practical introduction to React Hooks",
    text: "State is a component’s memory. useState keeps a value between renders, and its setter schedules an update.",
    startTime: 85,
    kind: "caption",
  },
  {
    id: `${id}:1`,
    videoId: id,
    title: "A practical introduction to React Hooks",
    text: "Hooks must be called at the top level. Do not call them inside loops or conditions. Custom hooks let components share reusable stateful logic.",
    startTime: 246,
    kind: "caption",
  },
  {
    id: `${id}:2`,
    videoId: id,
    title: "A practical introduction to React Hooks",
    text: "An effect synchronizes a component with an external system. Clean up subscriptions when the component unmounts.",
    startTime: 412,
    kind: "caption",
  },
];
const output = {
  id: "preview-notes",
  mode: "notes",
  answer:
    "## The big picture\nHooks let you bring state and reusable logic into function components. Think of them as small building blocks for how a component remembers and responds. [E1]\n\n## Ideas worth keeping\n- **State is memory.** A value persists between renders; its setter schedules an update. [E1]\n- **Order matters.** Call hooks at the top level, outside conditions and loops. [E2]\n- **Effects connect things.** Synchronize with external systems, and clean up subscriptions. [E3]\n\n## Try it for yourself\n1. Identify the state your component needs. [E1]\n2. Keep hook calls at the top level. [E2]\n3. Check that subscriptions have a cleanup. [E3]\n\n## Keep exploring\nHow could a custom hook simplify your next component?",
  evidence,
  verification: {
    status: "supported",
    reason: "Sample result for design preview only.",
    claims: [
      {
        text: "Hooks must be called at the top level.",
        verdict: "supported",
        refs: [2],
      },
    ],
  },
  createdAt: Date.now(),
};
export const demoState = {
  settings: defaults,
  sessions: [
    {
      id,
      title: evidence[0].title,
      url: "https://www.youtube.com/",
      createdAt: Date.now(),
      expiresAt: Date.now() + TTL,
      pinned: false,
      captionStatus: "ready",
      transcript: evidence.map((e) => ({
        text: e.text,
        startTime: e.startTime,
      })),
      outputs: [output],
    },
  ],
  nodes: [
    { id: "react", label: "React", type: "technology", sources: [evidence[0]] },
    { id: "hooks", label: "Hooks", type: "concept", sources: [evidence[1]] },
    { id: "state", label: "State", type: "concept", sources: [evidence[0]] },
    {
      id: "effects",
      label: "Effects",
      type: "concept",
      sources: [evidence[2]],
    },
  ],
  edges: [
    {
      id: "1",
      source: "react",
      target: "hooks",
      relation: "includes",
      sources: [evidence[1]],
    },
    {
      id: "2",
      source: "hooks",
      target: "state",
      relation: "manages",
      sources: [evidence[0]],
    },
    {
      id: "3",
      source: "hooks",
      target: "effects",
      relation: "includes",
      sources: [evidence[2]],
    },
  ],
};
export const demoFrames = [];
