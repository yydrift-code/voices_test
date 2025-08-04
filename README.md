# RenovaVision TTS Demo - AI Voice Agent Comparison Platform

A comprehensive demo platform for comparing different Text-to-Speech (TTS) providers, featuring an interactive AI voice agent that acts as a RenovaVision presale specialist.

## Features

- **Interactive AI Voice Agent**: Chat with an AI agent that demonstrates different TTS capabilities
- **Multi-Provider TTS Comparison**: Compare audio quality across multiple TTS providers
- **Multilingual Support**: Support for Belarusian, Polish, Lithuanian, Latvian, and Estonian
- **Real-time Voice Generation**: Generate and play audio samples instantly
- **WebSocket Communication**: Real-time chat interface with voice responses
- **Modern Web Interface**: Beautiful, responsive UI with Bootstrap 5

## Supported TTS Providers

1. **ElevenLabs** - High-quality, natural-sounding voices with multilingual support
2. **OpenAI TTS** - Very natural speech synthesis with multiple voice options
3. **Google Cloud TTS** - Wide language support with SSML capabilities
4. **Coqui TTS** - Open-source solution with offline capabilities
5. **pyttsx3** - Completely offline TTS with system voice support

## Prerequisites

- Python 3.8 or higher
- pip or uv package manager
- API keys for TTS providers (see Configuration section)

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
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   ```

4. **Optional: Set up Google Cloud credentials** (for Google TTS):
   - Download your Google Cloud service account key
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to your key file

## Configuration

### Required API Keys

- **OpenAI API Key**: Required for OpenAI TTS
  - Get from: https://platform.openai.com/api-keys
- **ElevenLabs API Key**: Required for ElevenLabs TTS
  - Get from: https://elevenlabs.io/speech-synthesis

### Optional Setup

- **Google Cloud TTS**: Requires Google Cloud project and service account
- **Coqui TTS**: Automatically downloads models on first use
- **pyttsx3**: Works offline, no API key required

## Usage

1. **Start the server**:
   ```bash
   python main.py
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:8000
   ```

3. **Explore the demo**:
   - Visit the home page to learn about features
   - Go to `/demo` for the interactive chat interface
   - Try different languages and TTS providers
   - Compare audio quality across providers

## Demo Features

### Interactive Chat
- Chat with the AI agent in real-time
- Switch between different TTS providers
- Support for multiple languages
- Real-time voice generation and playback

### TTS Comparison
- Generate the same text with all available providers
- Compare audio quality side-by-side
- View provider status and error messages
- Download generated audio files

### Language Support
- **English** (en)
- **Belarusian** (be)
- **Polish** (pl)
- **Lithuanian** (lt)
- **Latvian** (lv)
- **Estonian** (et)

## API Endpoints

- `GET /` - Home page
- `GET /demo` - Interactive demo page
- `WebSocket /ws` - Real-time chat interface
- `POST /api/tts` - Generate TTS audio
- `GET /api/providers` - Get available providers
- `GET /api/audio/{filename}` - Serve audio files
- `POST /api/conversation` - Process conversation

## Project Structure

```
voices_test/
├── main.py                 # FastAPI application
├── tts_providers.py        # TTS provider manager
├── voice_agent.py          # AI voice agent logic
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables
├── README.md              # This file
├── templates/             # HTML templates
│   ├── index.html         # Home page
│   └── demo.html          # Demo page
└── static/                # Static files
    ├── css/               # Stylesheets
    │   ├── style.css      # Main styles
    │   └── demo.css       # Demo page styles
    ├── js/                # JavaScript
    │   └── demo.js        # Demo functionality
    └── audio/             # Generated audio files
```

## Troubleshooting

### Common Issues

1. **TTS Provider Not Working**:
   - Check API keys in `.env` file
   - Verify internet connection for cloud providers
   - Check provider-specific error messages

2. **Audio Not Playing**:
   - Ensure browser supports audio playback
   - Check browser console for errors
   - Verify audio files are generated correctly

3. **WebSocket Connection Issues**:
   - Check if server is running
   - Verify firewall settings
   - Check browser console for connection errors

### Provider-Specific Notes

- **ElevenLabs**: Requires valid API key, supports multilingual models
- **OpenAI**: Requires valid API key, good for English and some other languages
- **Google Cloud**: Requires service account setup, excellent language support
- **Coqui TTS**: Downloads models automatically, works offline
- **pyttsx3**: System-dependent, limited language support

## Development

### Adding New TTS Providers

1. Add provider initialization in `tts_providers.py`
2. Implement speech generation method
3. Add provider info to `voice_agent.py`
4. Update language mappings if needed

### Customizing the Agent

- Modify responses in `voice_agent.py`
- Add new conversation flows
- Customize provider information and pricing

## License

This project is for demonstration purposes. Please respect the terms of service for each TTS provider.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review provider documentation
- Open an issue on GitHub

---

**Note**: This is a demo platform for educational and demonstration purposes. The RenovaVision branding is fictional and used for demonstration only. 