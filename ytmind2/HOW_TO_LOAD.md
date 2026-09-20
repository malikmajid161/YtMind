# YTMind 2.0 — Installation Guide

## Step 1: Get a Free Groq API Key
1. Go to https://console.groq.com
2. Sign up (free)
3. Create an API Key
4. Copy it

## Step 2: Load the Extension in Chrome
1. Open Chrome → go to `chrome://extensions`
2. Turn ON **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `ytmind2` folder (this folder)
5. YTMind 2.0 icon appears in your toolbar

## Step 3: Set Up
1. Click the YTMind 2.0 icon
2. Paste your Groq API key
3. Choose language (Auto / English / Urdu / Roman Urdu)
4. Click **Save & Open YTMind**

## Step 4: Use It
1. Open any YouTube video
2. Click the 🧠 floating button (bottom-right)
3. Ask questions, or use quick buttons:
   - 📝 Summarize
   - 🎯 Key Points
   - ❓ Quiz Me
   - 🗺️ Arguments
   - 🎙 Audio→Text (for videos without captions)

## Features (7 Modules)
| Module | What It Does |
|---|---|
| ACTA | Detects video genre (kalam/lecture/tutorial/documentary/debate) and adapts answers |
| MALT | Transcribes Urdu/low-resource audio via Whisper when captions fail |
| SAGE | Shows a verification badge — is the answer grounded in the video? |
| VERA | (planned) Reads slides/diagrams from video frames |
| KGMA | Remembers concepts across videos — "what have I learned?" |
| GAIA | Generates quizzes from any video |
| ARIA | Maps arguments in debates/documentaries |

## Troubleshooting
- **"Add your Groq API key"** → open the popup and paste your key
- **No captions** → click Audio→Text, play the video, allow tab audio
- **Rate limit** → wait a minute (Groq free tier limit)
- **Extension not showing** → refresh the YouTube page (F5)
