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
Create a `.env` file in the root directory and add your API keys:

```bash
# OpenAI (Question generation & Feedback)
VUE_APP_OPENAPI_TOKEN_KEY=your_openai_key

# AssemblyAI (Real-time transcription)
VUE_APP_ASSEMBLY_AI_TOKEN=your_assemblyai_token

# Microsoft Azure (Realistic Voice Synthesis)
VUE_APP_AZURE_SPEECH_KEY=your_azure_key
VUE_APP_AZURE_SPEECH_REGION=your_azure_region
```

### 3. Installation
```bash
# Install dependencies
npm install

# Start development server
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

