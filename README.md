# RenovaVision TTS Demo - AI Voice Agent Comparison Platform

A comprehensive demo platform for comparing different Text-to-Speech (TTS) and Speech-to-Text (STT) providers, featuring an interactive AI voice agent that acts as a RenovaVision presale specialist with full voice conversation capabilities.

## Features

- **Interactive AI Voice Agent**: Have natural voice conversations with an AI agent
- **Voice Input & Output**: Full voice conversation interface - speak to the agent and hear responses
- **Provider-Paired TTS/STT**: Each agent uses the same provider for both speech-to-text and text-to-speech
- **Multi-Provider Comparison**: Compare audio quality across multiple TTS/STT providers
- **Multilingual Support**: Support for Belarusian, Polish, Lithuanian, Latvian, and Estonian
- **Real-time Voice Generation**: Generate and play audio responses instantly
- **WebSocket Communication**: Real-time voice conversation interface
- **Modern Web Interface**: Beautiful, responsive UI with phone call-like experience

## Supported Providers (TTS + STT)

Each provider handles both text-to-speech and speech-to-text:

1. **OpenAI** - TTS: OpenAI TTS, STT: OpenAI Whisper
2. **Google Cloud** - TTS: Google Cloud TTS, STT: Google Speech-to-Text  
3. **pyttsx3** - TTS: Offline system voices, STT: Not available (TTS-only)

## Prerequisites

- Python 3.8 or higher
- pip or uv package manager
- API keys for TTS/STT providers (see Configuration section)
- Microphone access for voice input

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd voices_test
   ```

2. **Install dependencies**:
   ```bash
   # Using pip
   pip install -r requirements.txt
   
   # Or using uv (recommended)
   uv pip install -r requirements.txt
   ```

3. **Set up environment variables**:
   Create a `.env` file in the project root with your API keys:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
   ```

4. **Optional: Set up Google Cloud credentials** (for Google TTS/STT):
   - Download your Google Cloud service account key
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to your key file

## Configuration

### Required API Keys

- **OpenAI API Key**: Required for OpenAI TTS and Whisper STT
  - Get from: https://platform.openai.com/api-keys
- **Google Cloud**: Requires Google Cloud project and service account for TTS and STT

### Optional Setup

- **pyttsx3**: Works offline, no API key required (TTS-only)

## Usage

1. **Start the server**:
   ```bash
   python main.py
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:8000
   ```

3. **Start a voice conversation**:
   - Choose your preferred language and provider
   - Click "Start Call" to begin a voice conversation
   - Click the microphone button to start speaking
   - Click stop when finished speaking
   - Listen to the AI agent's voice response
   - Continue the conversation naturally

## Voice Conversation Features

### Phone Call Interface
- Start/End call buttons for each language/provider combination
- Real-time voice recording with visual feedback
- Automatic speech-to-text processing
- Instant text-to-speech responses
- Call status indicators

### Provider Information
- Clear display of which TTS and STT providers are being used
- Automatic provider pairing (same provider for both TTS and STT)
- Status indicators for each provider

### Voice Controls
- One-click voice recording
- Visual recording status
- Automatic audio playback of responses
- Replay functionality for responses

## Demo Features

### Voice Conversation
- Natural voice conversations with AI agents
- Switch between different TTS/STT providers
- Support for multiple languages
- Real-time voice generation and playback

### Provider Comparison
- Compare voice quality across different providers
- Test both speech recognition and speech synthesis
- View provider status and error messages 