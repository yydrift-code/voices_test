import os
import asyncio
import tempfile
from pathlib import Path
from typing import Dict, List, Optional
import json
import time

# TTS Provider imports
import openai
from google.cloud import texttospeech
import pyttsx3

class TTSProviderManager:
    """Manages different TTS providers for comparison"""
    
    def __init__(self):
        self.providers = {
            "openai": self._init_openai,
            "google": self._init_google,
            "pyttsx3": self._init_pyttsx3
        }
        
        self.supported_languages = {
            "be": "Belarusian",
            "pl": "Polish", 
            "lt": "Lithuanian",
            "lv": "Latvian",
            "et": "Estonian",
            "en": "English"
        }
        
        # Language mapping for different providers
        self.language_mapping = {
            "openai": {
                "be": "be", "pl": "pl", "lt": "lt", "lv": "lv", "et": "et", "en": "en"
            },
            "google": {
                "be": "en-US", "pl": "pl-PL", "lt": "lt-LT", "lv": "lv-LV", "et": "et-EE", "en": "en-US"
            },
            "pyttsx3": {
                "be": "be", "pl": "pl", "lt": "lt", "lv": "lv", "et": "et", "en": "en"
            },
            "coqui": {
                "be": "be", "pl": "pl", "lt": "lt", "lv": "lv", "et": "et", "en": "en"
            },
            "elevenlabs": {
                "be": "be", "pl": "pl", "lt": "lt", "lv": "lv", "et": "et", "en": "en"
            }
        }
        
        # Initialize providers
        self._init_providers()
        
        # Create audio directory
        Path("static/audio").mkdir(parents=True, exist_ok=True)
    
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
    
    def _init_pyttsx3(self):
        """Initialize pyttsx3 (offline TTS)"""
        try:
            engine = pyttsx3.init()
            return {"engine": engine}
        except Exception as e:
            raise ValueError(f"pyttsx3 not available: {e}")
    
    # def _init_coqui(self):
    #     """Initialize Coqui TTS"""
    #     try:
    #         # Use a multilingual model
    #         tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2")
    #         return {"tts": tts}
    #     except Exception as e:
    #         raise ValueError(f"Coqui TTS not available: {e}")
    

    
    def get_available_providers(self) -> List[str]:
        """Get list of available TTS providers"""
        return list(self.active_providers.keys())
    
    def get_supported_languages(self) -> Dict[str, str]:
        """Get supported languages"""
        return self.supported_languages
    
    async def generate_speech(self, text: str, language: str = "en", provider: str = "openai") -> bytes:
        """Generate speech and return audio data as bytes"""
        if provider not in self.active_providers:
            raise ValueError(f"Provider {provider} not available")
        
        # Get provider-specific language code
        lang_code = self.language_mapping[provider].get(language, language)
        
        if provider == "openai":
            return await self._generate_openai_bytes(text, lang_code)
        elif provider == "google":
            return await self._generate_google_bytes(text, lang_code)
        elif provider == "pyttsx3":
            return await self._generate_pyttsx3_bytes(text, lang_code)
        
        raise ValueError(f"Unknown provider: {provider}")
    
    async def _generate_openai_bytes(self, text: str, language: str) -> bytes:
        """Generate speech using OpenAI TTS and return as bytes"""
        try:
            client = openai.OpenAI()
            response = client.audio.speech.create(
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
            client = openai.OpenAI()
            response = client.audio.speech.create(
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
        """Generate speech using Google Cloud TTS and return as bytes"""
        try:
            client = self.active_providers["google"]["client"]
            
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            # Try to get available voices for the language
            try:
                voices_response = client.list_voices(language_code=language)
                available_voices = voices_response.voices
                
                # Select the first available voice
                if available_voices:
                    voice_name = available_voices[0].name
                else:
                    # No voices found for this language, use language code only
                    voice_name = None
            except Exception:
                # If list_voices fails, use language code only
                voice_name = None
            
            # Create voice selection params
            if voice_name:
                voice = texttospeech.VoiceSelectionParams(
                    language_code=language,
                    name=voice_name
                    # Don't specify gender to avoid conflicts
                )
            else:
                # Use language code only, let Google choose the voice
                voice = texttospeech.VoiceSelectionParams(
                    language_code=language
                    # Don't specify gender to avoid conflicts
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
            client = self.active_providers["google"]["client"]
            
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            # Try to get available voices for the language
            try:
                voices_response = client.list_voices(language_code=language)
                available_voices = voices_response.voices
                
                # Select the first available voice
                if available_voices:
                    voice_name = available_voices[0].name
                else:
                    # No voices found for this language, use language code only
                    voice_name = None
            except Exception:
                # If list_voices fails, use language code only
                voice_name = None
            
            # Create voice selection params
            if voice_name:
                voice = texttospeech.VoiceSelectionParams(
                    language_code=language,
                    name=voice_name
                    # Don't specify gender to avoid conflicts
                )
            else:
                # Use language code only, let Google choose the voice
                voice = texttospeech.VoiceSelectionParams(
                    language_code=language
                    # Don't specify gender to avoid conflicts
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
    
    async def _generate_pyttsx3_bytes(self, text: str, language: str) -> bytes:
        """Generate speech using pyttsx3 and return as bytes"""
        try:
            # Create a fresh engine for each request (like in the test script)
            engine = pyttsx3.init()
            
            # Set language if supported
            try:
                engine.setProperty('voice', language)
            except:
                pass  # Use default voice if language not supported
            
            # Try to save to a temporary file and read it back
            import tempfile
            import os
            
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
            
            try:
                # Save audio to temporary file
                engine.save_to_file(text, temp_path)
                engine.runAndWait()
                
                # Check if file was created and has content
                if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                    # Read the file
                    with open(temp_path, 'rb') as f:
                        audio_data = f.read()
                    
                    # Clean up temp file
                    os.unlink(temp_path)
                    
                    # Check if it's a valid WAV file or AIFF file
                    if audio_data.startswith(b'RIFF'):
                        # Valid WAV file
                        return audio_data
                    elif audio_data.startswith(b'FORM'):
                        # AIFF file (common on macOS with pyttsx3)
                        print(f"pyttsx3 created AIFF file ({len(audio_data)} bytes), converting to WAV")
                        try:
                            # Convert AIFF to WAV using pure Python
                            wav_data = self._convert_aiff_to_wav(audio_data)
                            print(f"✓ Successfully converted AIFF to WAV: {len(wav_data)} bytes")
                            return wav_data
                                
                        except Exception as conv_error:
                            print(f"✗ AIFF to WAV conversion failed: {conv_error}")
                            raise Exception(f"AIFF to WAV conversion failed: {conv_error}")
                    else:
                        # Unknown format
                        print(f"pyttsx3 created unknown format file ({len(audio_data)} bytes)")
                        raise Exception(f"Unknown audio format: {audio_data[:8]}")
                else:
                    # File creation failed
                    os.unlink(temp_path)
                    raise Exception("pyttsx3 failed to create audio file")
                    
            except Exception as save_error:
                # Clean up temp file if it exists
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                raise save_error
            
        except Exception as e:
            raise Exception(f"pyttsx3 error: {e}")
    
    async def _generate_pyttsx3(self, text: str, language: str, output_path: Path):
        """Generate speech using pyttsx3"""
        try:
            # Since pyttsx3 file saving is unreliable on macOS, create a simple audio file
            # and use pyttsx3 only for playback demonstration
            self._create_simple_wav(str(output_path), text)
            
            # Optionally, you can also play the audio using pyttsx3
            # engine = self.active_providers["pyttsx3"]["engine"]
            # engine.say(text)
            # engine.runAndWait()
            
        except Exception as e:
            raise Exception(f"pyttsx3 error: {e}")
    
    def _convert_aiff_to_wav(self, aiff_data: bytes) -> bytes:
        """Convert AIFF audio data to WAV format using pure Python"""
        import struct
        import io
        import wave
        
        # Parse AIFF header
        if not aiff_data.startswith(b'FORM'):
            raise Exception("Not a valid AIFF file")
        
        # Find the SSND chunk (sound data)
        offset = 12  # Skip FORM header
        while offset < len(aiff_data) - 8:
            chunk_id = aiff_data[offset:offset+4]
            chunk_size = struct.unpack('>I', aiff_data[offset+4:offset+8])[0]
            
            if chunk_id == b'SSND':
                # Found sound data chunk
                # Skip 8 bytes (offset + block size)
                audio_start = offset + 16
                audio_end = offset + 8 + chunk_size
                audio_data = aiff_data[audio_start:audio_end]
                
                # Create WAV file
                buffer = io.BytesIO()
                with wave.open(buffer, 'w') as wav_file:
                    wav_file.setnchannels(1)  # Mono
                    wav_file.setsampwidth(2)  # 16-bit
                    wav_file.setframerate(22050)  # 22.05 kHz
                    wav_file.writeframes(audio_data)
                
                return buffer.getvalue()
            
            offset += 8 + chunk_size
        
        raise Exception("No sound data found in AIFF file")
    
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
    
    # async def _generate_coqui(self, text: str, language: str, output_path: Path):
    #     """Generate speech using Coqui TTS"""
    #     try:
    #         tts = self.active_providers["coqui"]["tts"]
    #         
    #         # Generate speech
    #         tts.tts_to_file(
    #             text=text,
    #             file_path=str(output_path),
    #             language=language
    #     )
    #         
    #     except Exception as e:
    #         raise Exception(f"Coqui TTS error: {e}")
    

    
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