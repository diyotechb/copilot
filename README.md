# Interview Simulator Copilot

A modern, high-performance web application designed for real-time interview practice and transcription. It leverages advanced AI for voice synthesis, live speech-to-text, and automated feedback.

## ✨ Features

- **Real-time Transcription**: High-accuracy live transcription using AssemblyAI.
- **AI-Powered Interviewer**: Interactive sessions with Azure Text-to-Speech (TTS) for realistic voice delivery.
- **Live Feedback**: Automated evaluation and suggestions based on interview performance.
- **Session History**: Save, review, and manage past mock interviews and transcriptions.
- **Customizable Experience**: Choose between different voices, difficulty levels, and preview modes.
- **Manual Control**: Full control over scrolling and session flow for a natural interaction.

## 🛠 Tech Stack

- **Frontend**: Vue.js 2 with Element UI for a premium, responsive interface.
- **Speech**: Azure Cognitive Services (TTS) and AssemblyAI (Real-time STT).
- **AI**: OpenAI GPT-4o for intelligent question generation and feedback.
- **Storage**: IndexedDB (local history) and session-based persistence.

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v16+ recommended)
- npm or yarn

### 2. Environment Setup

The frontend no longer holds AI provider keys. Question generation, analysis,
TTS, and recorded-audio transcription are proxied through `copilot-backend`,
which is the only thing that talks to OpenAI and AssemblyAI.

Create a `.env` file in the root directory with the backend URL:

```bash
# WebSocket URL for the realtime transcription backend. The frontend derives
# the HTTP base URL from this (ws:// → http://, wss:// → https://) for the
# new /api/** REST calls.
VUE_APP_SERVER_URL=ws://localhost:8080

# Optional: override the HTTP base URL when it differs from the WS host
# (e.g. behind a separate CloudFront distribution).
# VUE_APP_COPILOT_BACKEND_URL=http://localhost:8080

# Diyo Service backend (auth, profiles).
VUE_APP_DIYO_SERVICE_BACKEND_ENDPOINT=https://your-diyo-service.example.com
```

You also need `copilot-backend` running. See [copilot-backend/README.md](../copilot-backend/README.md)
for backend setup — it needs `OPENAI_API_KEY` and `ASSEMBLY_AI_API_KEY` set
either as env vars or in a local-only `application-local.properties`.

### 3. Installation
```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:3001)
npm run serve
```

### 4. Build
```bash
# Build for production
npm run build
```

## 📂 Project Structure

- `src/views`: Core page components (Interview, Transcriptions, Dashboard).
- `src/components`: Reusable UI elements and functional modules (Recorders, UI gaps fixes).
- `src/services`: API interaction layers for AI and Speech services.
- `src/store`: Local state management and settings.

## 🤝 Contributing
Feel free to submit issues or pull requests to improve the simulator!

