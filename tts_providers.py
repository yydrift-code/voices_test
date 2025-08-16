import os
import asyncio
import tempfile
from pathlib import Path
from typing import Dict, List, Optional
import json
import time
from functools import lru_cache

# TTS Provider imports
import openai
from google.cloud import texttospeech

class TTSProviderManager:
    """Manages different TTS providers for comparison with performance optimizations"""
    
    def __init__(self):
        # Cache clients to avoid recreation
        self._openai_client = None
        self._google_client = None
        
        self.providers = {
            "openai": self._init_openai,
            "google": self._init_google
        }
        
        self.supported_languages = {
            # "be": "Belarusian",
            "pl": "Polish", 
            "lt": "Lithuanian",
            "lv": "Latvian",
            "et": "Estonian",
            "en": "English"
        }
        
        # Language mapping for different providers (cached)
        self.language_mapping = {
            "openai": {
                # "be": "be", 
                "pl": "pl", "lt": "lt", "lv": "lv", "et": "et", "en": "en"
            },
            "google": {
                # "be": "en-US", 
                "pl": "pl-PL", "lt": "lt-LT", "lv": "lv-LV", "et": "et-EE", "en": "en-US"
            }
        }
        
        # Voice options for different providers
        self.voice_options = {
            "openai": [
                {"id": "alloy", "name": "Alloy", "description": "Neutral, clear voice (multilingual)"},
                {"id": "echo", "name": "Echo", "description": "Male voice (multilingual)"},
                {"id": "fable", "name": "Fable", "description": "British accent (multilingual)"},
                {"id": "onyx", "name": "Onyx", "description": "Deep male voice (multilingual)"},
                {"id": "nova", "name": "Nova", "description": "Female voice (multilingual)"},
                {"id": "shimmer", "name": "Shimmer", "description": "Soft female voice (multilingual)"}
            ],
            "google": [
                {"id": "default", "name": "Default", "description": "Standard voice for the language"},
                {"id": "wavenet", "name": "WaveNet", "description": "High-quality neural voice (if available)"},
                {"id": "neural", "name": "Neural2", "description": "Latest neural voice (if available)"},
                {"id": "chirp", "name": "Chirp", "description": "Advanced neural voice (if available)"}
            ]
        }
        
        # Initialize providers
        self._init_providers()
        
        # Create audio directory
        Path("static/audio").mkdir(parents=True, exist_ok=True)
    
    @property
    def openai_client(self):
        """Lazy load OpenAI client"""
        if self._openai_client is None:
            self._openai_client = openai.OpenAI()
        return self._openai_client
    
    @property
    def google_client(self):
        """Lazy load Google client"""
        if self._google_client is None:
            self._google_client = texttospeech.TextToSpeechClient()
        return self._google_client
    
    def _init_providers(self):
        """Initialize all available TTS providers"""
        self.active_providers = {}
        
        for provider_name, init_func in self.providers.items():
            try:
                self.active_providers[provider_name] = init_func()
                print(f"✓ Initialized {provider_name} TTS provider")
            except Exception as e:
                print(f"✗ Failed to initialize {provider_name}: {e}")
    
    def _init_openai(self):
        """Initialize OpenAI TTS"""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment")
        
        return {"api_key": api_key}
    
    def _init_google(self):
        """Initialize Google Cloud TTS"""
        # Note: Requires Google Cloud credentials
        try:
            client = texttospeech.TextToSpeechClient()
            return {"client": client}
        except Exception as e:
            raise ValueError(f"Google Cloud TTS not configured: {e}")
    
    def get_available_providers(self) -> List[str]:
        """Get list of available TTS providers"""
        return list(self.active_providers.keys())
    
    def get_supported_languages(self) -> Dict[str, str]:
        """Get supported languages"""
        return self.supported_languages
    
    def get_available_voices(self, provider: str) -> List[Dict[str, str]]:
        """Get available voices for a provider"""
        return self.voice_options.get(provider, [])
    
    @lru_cache(maxsize=128)
    def _get_language_code(self, provider: str, language: str) -> str:
        """Cached language code lookup"""
        return self.language_mapping[provider].get(language, language)
    
    async def generate_speech(self, text: str, language: str = "en", provider: str = "openai", voice: str = None) -> bytes:
        """Generate speech and return audio data as bytes"""
        if provider not in self.active_providers:
            raise ValueError(f"Provider {provider} not available")
        
        # Get provider-specific language code (cached)
        lang_code = self._get_language_code(provider, language)
        
        if provider == "openai":
            return await self._generate_openai_bytes(text, lang_code, voice)
        elif provider == "google":
            return await self._generate_google_bytes(text, lang_code, voice)
        
        raise ValueError(f"Unknown provider: {provider}")
    
    async def _generate_openai_bytes(self, text: str, language: str, voice: str = None) -> bytes:
        """Generate speech using OpenAI TTS and return as bytes (optimized)"""
        try:
            # Use provided voice or default to alloy
            selected_voice = voice if voice else "alloy"
            
            # Use cached client
            response = self.openai_client.audio.speech.create(
                model="tts-1",
                voice=selected_voice,
                input=text,
                response_format="wav"
            )
            
            return response.content
                
        except Exception as e:
            raise Exception(f"OpenAI TTS error: {e}")
    
    async def _generate_openai(self, text: str, language: str, output_path: Path, voice: str = None):
        """Generate speech using OpenAI TTS"""
        try:
            # Use provided voice or default to alloy
            selected_voice = voice if voice else "alloy"
            
            # Use cached client
            response = self.openai_client.audio.speech.create(
                model="tts-1",
                voice=selected_voice,
                input=text,
                response_format="wav"
            )
            
            with open(output_path, "wb") as f:
                f.write(response.content)
                
        except Exception as e:
            raise Exception(f"OpenAI TTS error: {e}")
    
    async def _generate_google_bytes(self, text: str, language: str, voice_id: str = None) -> bytes:
        """Generate speech using Google Cloud TTS and return as bytes (optimized)"""
        try:
            # Use cached client
            client = self.google_client
            
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            # Create voice selection params
            voice_params = {"language_code": language}
            
            # Select the best available voice based on voice_id and language
            if voice_id == "chirp":
                # Try Chirp3-HD voices first (most advanced)
                voice_params["name"] = f"{language}-Chirp3-HD-Achernar"
            elif voice_id == "neural":
                # Try Neural2 voices
                voice_params["name"] = f"{language}-Neural2-A"
            elif voice_id == "wavenet":
                # Try WaveNet voices
                voice_params["name"] = f"{language}-Wavenet-A"
            elif voice_id == "default" or voice_id is None:
                # Use Standard voices or let Google choose
                if language in ["lt-LT", "lv-LV", "et-EE"]:
                    # Baltic languages have limited voice options
                    voice_params["name"] = f"{language}-Standard-B" if language == "lt-LT" else f"{language}-Standard-B"
                else:
                    # Let Google choose the best available voice
                    pass
            
            voice = texttospeech.VoiceSelectionParams(**voice_params)
            
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16
            )
            
            try:
                response = client.synthesize_speech(
                    input=synthesis_input, voice=voice, audio_config=audio_config
                )
            except Exception as voice_error:
                # Fallback to default voice if specific voice fails
                print(f"Voice {voice_params.get('name', 'default')} failed, falling back to default: {voice_error}")
                voice_fallback = texttospeech.VoiceSelectionParams(language_code=language)
                response = client.synthesize_speech(
                    input=synthesis_input, voice=voice_fallback, audio_config=audio_config
                )
            
            return response.audio_content
                
        except Exception as e:
            raise Exception(f"Google TTS error: {e}")
    
    async def _generate_google(self, text: str, language: str, output_path: Path, voice_id: str = None):
        """Generate speech using Google Cloud TTS"""
        try:
            # Use the same logic as the bytes method
            audio_data = await self._generate_google_bytes(text, language, voice_id)
            
            with open(output_path, "wb") as out:
                out.write(audio_data)
                
        except Exception as e:
            raise Exception(f"Google TTS error: {e}")
    
    def _create_simple_wav_bytes(self, text: str) -> bytes:
        """Create a simple WAV audio data as bytes"""
        import wave
        import struct
        import math
        import io
        
        # Create a simple beep sound
        sample_rate = 22050
        duration = min(len(text) * 0.1, 3.0)  # Duration based on text length, max 3 seconds
        frequency = 440.0  # A4 note
        
        # Generate sine wave
        samples = []
        for i in range(int(sample_rate * duration)):
            t = i / sample_rate
            sample = 0.3 * math.sin(2 * math.pi * frequency * t)
            samples.append(int(sample * 32767))
        
        # Create WAV data in memory
        buffer = io.BytesIO()
        with wave.open(buffer, 'w') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 2 bytes per sample
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(struct.pack('h' * len(samples), *samples))
        
        return buffer.getvalue()
    
    def _create_simple_wav(self, output_path: str, text: str):
        """Create a simple WAV file with a beep sound"""
        import wave
        import struct
        import math
        
        # Create a simple beep sound
        sample_rate = 22050
        duration = min(len(text) * 0.1, 3.0)  # Duration based on text length, max 3 seconds
        frequency = 440.0  # A4 note
        
        # Generate sine wave
        samples = []
        for i in range(int(sample_rate * duration)):
            t = i / sample_rate
            sample = 0.3 * math.sin(2 * math.pi * frequency * t)
            samples.append(int(sample * 32767))
        
        # Write WAV file
        with wave.open(output_path, 'w') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 2 bytes per sample
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(struct.pack('h' * len(samples), *samples))
    
    async def compare_providers(self, text: str, language: str = "en") -> Dict[str, str]:
        """Compare all available providers for the same text"""
        results = {}
        
        for provider in self.get_available_providers():
            try:
                audio_path = await self.generate_speech(text, language, provider)
                results[provider] = audio_path
            except Exception as e:
                results[provider] = f"Error: {str(e)}"
        
        return results 