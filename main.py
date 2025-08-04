import os
import asyncio
import json
import tempfile
import base64
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Form, UploadFile, File
from fastapi.responses import HTMLResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import aiofiles

from tts_providers import TTSProviderManager
from voice_agents import VoiceAgent, AgentType

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="RenovaVision TTS Demo", description="Compare TTS providers for AI Voice Agents")

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Initialize TTS provider manager after environment variables are loaded
tts_manager = None

def initialize_services():
    global tts_manager
    if tts_manager is None:
        tts_manager = TTSProviderManager()
    return tts_manager

# Store active connections
active_connections: List[WebSocket] = []

class Message(BaseModel):
    text: str
    language: str = "en"
    provider: Optional[str] = None
    agent_type: Optional[str] = None

class SpeechToTextRequest(BaseModel):
    audio_data: str  # Base64 encoded audio
    language: str = "en"
    provider: str = "openai"

@app.get("/", response_class=HTMLResponse)
async def get_home(request: Request):
    """Main voice agent control page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time conversation"""
    await websocket.accept()
    active_connections.append(websocket)
    
    # Initialize services
    tts_manager = initialize_services()
    
    try:
        # Send welcome message
        welcome_msg = {
            "type": "system_message",
            "text": "Welcome to the Voice Agent Demo! Choose an agent type and start chatting.",
            "timestamp": datetime.now().isoformat()
        }
        await websocket.send_text(json.dumps(welcome_msg))
        
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Create agent based on type
            agent_type_str = message_data.get("agent_type", "presale_manager")
            try:
                agent_type = AgentType(agent_type_str)
            except ValueError:
                agent_type = AgentType.PRESALE_MANAGER
            
            agent = VoiceAgent(agent_type, tts_manager, message_data.get("language", "en"))
            
            # Process with agent
            response = await agent.process_message(
                message_data.get("text", ""),
                message_data.get("language", "en"),
                message_data.get("provider", "openai")
            )
            
            # Send response back
            await websocket.send_text(json.dumps(response))
            
    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)

@app.post("/api/speech-to-text")
async def speech_to_text(request: SpeechToTextRequest):
    """Convert speech to text using the same provider as TTS"""
    try:
        # Decode base64 audio data
        audio_data = base64.b64decode(request.audio_data)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_file_path = temp_file.name
        
        try:
            # Use the same provider for STT as TTS
            transcribed_text = await transcribe_with_provider(temp_file_path, request.language, request.provider)
            
            return {
                "success": True,
                "text": transcribed_text,
                "language": request.language,
                "provider": request.provider
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

async def transcribe_with_provider(audio_file_path: str, language: str, provider: str) -> str:
    """Transcribe audio using the specified provider"""
    try:
        if provider == "openai":
            return await transcribe_with_openai(audio_file_path, language)
        elif provider == "google":
            return await transcribe_with_google(audio_file_path, language)
        elif provider == "pyttsx3":
            return await transcribe_with_pyttsx3(audio_file_path, language)
        else:
            raise ValueError(f"Unsupported provider for STT: {provider}")
            
    except Exception as e:
        print(f"STT error with {provider}: {e}")
        return f"Transcription failed with {provider}. Please try again."

async def transcribe_with_openai(audio_file_path: str, language: str) -> str:
    """Transcribe audio using OpenAI Whisper"""
    try:
        import openai
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise Exception("OpenAI API key not found")
        
        # Read the audio file
        with open(audio_file_path, 'rb') as f:
            audio_data = f.read()
        
        # Use OpenAI Whisper for transcription with new API
        client = openai.OpenAI()
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=("audio.wav", audio_data, "audio/wav"),
            language=language
        )
        
        # Check if response is empty or contains no meaningful text
        transcribed_text = response.text.strip() if response.text else ""
        return transcribed_text if transcribed_text else ""
        
    except Exception as e:
        print(f"OpenAI STT error: {e}")
        return "Hello, this is a placeholder transcription. OpenAI Whisper is not fully configured."

async def transcribe_with_google(audio_file_path: str, language: str) -> str:
    """Transcribe audio using Google Speech-to-Text"""
    try:
        from google.cloud import speech
        
        # Initialize Google Speech client
        client = speech.SpeechClient()
        
        # Read the audio file
        with open(audio_file_path, 'rb') as f:
            audio_data = f.read()
        
        # Configure the recognition - let Google auto-detect the format
        audio = speech.RecognitionAudio(content=audio_data)
        config = speech.RecognitionConfig(
            # Don't specify encoding and sample rate - let Google auto-detect
            language_code=language,
            enable_automatic_punctuation=True,
            enable_word_time_offsets=False,
            enable_word_confidence=False,
        )
        
        # Perform the transcription
        response = client.recognize(config=config, audio=audio)
        
        # Extract the transcribed text
        transcribed_text = ""
        for result in response.results:
            transcribed_text += result.alternatives[0].transcript
        
        return transcribed_text if transcribed_text else ""
        
    except Exception as e:
        print(f"Google STT error: {e}")
        return "Hello, this is a placeholder transcription. Google Speech-to-Text is not fully configured."

async def transcribe_with_pyttsx3(audio_file_path: str, language: str) -> str:
    """Transcribe audio using pyttsx3 (placeholder - pyttsx3 doesn't support STT)"""
    # pyttsx3 is text-to-speech only, doesn't support speech-to-text
    # This is a placeholder for demonstration
    return "Hello, this is a placeholder transcription. pyttsx3 is TTS-only and doesn't support speech-to-text."

@app.post("/api/tts")
async def generate_tts(message: Message):
    """Generate TTS audio for comparison"""
    # Initialize services
    tts_manager = initialize_services()
    
    try:
        if message.provider:
            # Generate with specific provider
            audio_data = await tts_manager.generate_speech(
                text=message.text,
                language=message.language,
                provider=message.provider
            )
            
            # Return audio data directly
            return Response(
                content=audio_data,
                media_type="audio/wav",
                headers={"Content-Disposition": "inline"}
            )
        else:
            # Generate with all providers for comparison
            results = {}
            for provider in tts_manager.get_available_providers():
                try:
                    audio_data = await tts_manager.generate_speech(
                        text=message.text,
                        language=message.language,
                        provider=provider
                    )
                    # Convert to base64 for JSON response
                    import base64
                    audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                    results[provider] = audio_base64
                except Exception as e:
                    results[provider] = f"Error: {str(e)}"
            
            return {"success": True, "results": results}
            
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/providers")
async def get_providers():
    """Get list of available TTS providers"""
    # Initialize services
    tts_manager = initialize_services()
    
    return {
        "providers": tts_manager.get_available_providers(),
        "languages": tts_manager.get_supported_languages()
    }

@app.get("/api/agents")
async def get_agents():
    """Get list of available agent types"""
    agents = []
    for agent_type in AgentType:
        # Create a temporary agent to get info
        tts_manager = initialize_services()
        temp_agent = VoiceAgent(agent_type, tts_manager)
        agent_info = temp_agent.get_agent_info()
        agents.append(agent_info)
    
    return {"agents": agents}

@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    """Serve generated audio files"""
    audio_path = Path("static/audio") / filename
    if audio_path.exists():
        return FileResponse(audio_path, media_type="audio/wav")
    return {"error": "Audio file not found"}

@app.post("/api/conversation")
async def conversation_endpoint(message: Message):
    """Process conversation with the agent"""
    # Initialize services
    tts_manager = initialize_services()
    
    try:
        # Create agent based on type
        agent_type_str = message.agent_type or "presale_manager"
        try:
            agent_type = AgentType(agent_type_str)
        except ValueError:
            agent_type = AgentType.PRESALE_MANAGER
        
        agent = VoiceAgent(agent_type, tts_manager, message.language)
        
        response = await agent.process_message(
            message.text,
            message.language,
            message.provider or "openai"
        )
        return response
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False) 