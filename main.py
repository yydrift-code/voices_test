import os
import asyncio
import json
import tempfile
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
from voice_agent import RenovaVisionAgent

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="RenovaVision TTS Demo", description="Compare TTS providers for AI Voice Agents")

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Initialize TTS provider manager and agent after environment variables are loaded
tts_manager = None
agent = None

def initialize_services():
    global tts_manager, agent
    if tts_manager is None:
        tts_manager = TTSProviderManager()
        agent = RenovaVisionAgent(tts_manager)
    return tts_manager, agent

# Store active connections
active_connections: List[WebSocket] = []

class Message(BaseModel):
    text: str
    language: str = "en"
    provider: Optional[str] = None

@app.get("/", response_class=HTMLResponse)
async def get_home(request: Request):
    """Main demo page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/demo", response_class=HTMLResponse)
async def get_demo(request: Request):
    """TTS comparison demo page"""
    return templates.TemplateResponse("demo.html", {"request": request})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time conversation"""
    await websocket.accept()
    active_connections.append(websocket)
    
    # Initialize services
    tts_manager, agent = initialize_services()
    
    try:
        # Send welcome message
        welcome_msg = {
            "type": "agent_message",
            "text": "Hello! I'm your RenovaVision AI Voice Agent specialist. I can help you explore different TTS providers and their capabilities. What would you like to know about our voice solutions?",
            "provider": "openai",
            "timestamp": datetime.now().isoformat()
        }
        await websocket.send_text(json.dumps(welcome_msg))
        
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
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

@app.post("/api/tts")
async def generate_tts(message: Message):
    """Generate TTS audio for comparison"""
    # Initialize services
    tts_manager, agent = initialize_services()
    
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
    tts_manager, agent = initialize_services()
    
    return {
        "providers": tts_manager.get_available_providers(),
        "languages": tts_manager.get_supported_languages()
    }

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
    tts_manager, agent = initialize_services()
    
    try:
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