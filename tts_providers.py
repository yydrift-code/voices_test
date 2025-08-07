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
    
    @lru_cache(maxsize=128)
    def _get_language_code(self, provider: str, language: str) -> str:
        """Cached language code lookup"""
        return self.language_mapping[provider].get(language, language)
    
    async def generate_speech(self, text: str, language: str = "en", provider: str = "openai") -> bytes:
        """Generate speech and return audio data as bytes"""
        if provider not in self.active_providers:
            raise ValueError(f"Provider {provider} not available")
        
        # Get provider-specific language code (cached)
        lang_code = self._get_language_code(provider, language)
        
        if provider == "openai":
            return await self._generate_openai_bytes(text, lang_code)
        elif provider == "google":
            return await self._generate_google_bytes(text, lang_code)
        
        raise ValueError(f"Unknown provider: {provider}")
    
    async def _generate_openai_bytes(self, text: str, language: str) -> bytes:
        """Generate speech using OpenAI TTS and return as bytes (optimized)"""
        try:
            # Use cached client
            response = self.openai_client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=text,
                response_format="wav"
            )
            
            return response.content
                
        except Exception as e:
            raise Exception(f"OpenAI TTS error: {e}")
    
    async def _generate_openai(self, text: str, language: str, output_path: Path):
        """Generate speech using OpenAI TTS"""
        try:
            # Use cached client
            response = self.openai_client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=text,
                response_format="wav"
            )
            
            with open(output_path, "wb") as f:
                f.write(response.content)
                
        except Exception as e:
            raise Exception(f"OpenAI TTS error: {e}")
    
    async def _generate_google_bytes(self, text: str, language: str) -> bytes:
        """Generate speech using Google Cloud TTS and return as bytes (optimized)"""
        try:
            # Use cached client
            client = self.google_client
            
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            # Create voice selection params (simplified for speed)
            voice = texttospeech.VoiceSelectionParams(
                language_code=language
            )
            
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16
            )
            
            response = client.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config
            )
            
            return response.audio_content
                
        except Exception as e:
            raise Exception(f"Google TTS error: {e}")
    
    async def _generate_google(self, text: str, language: str, output_path: Path):
        """Generate speech using Google Cloud TTS"""
        try:
            # Use cached client
            client = self.google_client
            
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            voice = texttospeech.VoiceSelectionParams(
                language_code=language
            )
            
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16
            )
            
            response = client.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config
            )
            
            with open(output_path, "wb") as out:
                out.write(response.audio_content)
                
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