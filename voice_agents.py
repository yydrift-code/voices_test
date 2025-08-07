import os
import asyncio
import json
import time
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from pathlib import Path
from functools import lru_cache

import openai

class AgentType(Enum):
    """Types of voice agents"""
    PRESALE_MANAGER = "presale_manager"

class VoiceAgent:
    """Optimized voice agent with performance improvements"""
    
    def __init__(self, agent_type: AgentType, tts_manager, language: str = "en"):
        self.agent_type = agent_type
        self.tts_manager = tts_manager
        self.language = language
        
        # Cache OpenAI client
        self._openai_client = None
        
        # Optimized conversation history (keep only recent messages)
        self.conversation_history = []
        self.max_history = 6  # Keep only last 6 messages for speed
        
        # Language mapping (cached)
        self.language_mapping = {
            "be": "Belarusian", "pl": "Polish", "lt": "Lithuanian", 
            "lv": "Latvian", "et": "Estonian", "en": "English"
        }
        
        # Check OpenAI availability
        self.openai_available = bool(os.getenv("OPENAI_API_KEY"))
        
        # Cache system prompt
        self.system_prompt = self._get_system_prompt()
    
    @property
    def openai_client(self):
        """Lazy load OpenAI client"""
        if self._openai_client is None:
            self._openai_client = openai.OpenAI()
        return self._openai_client
    
    def _get_system_prompt(self) -> str:
        """Get optimized system prompt for faster responses"""
        language_name = self.language_mapping.get(self.language, "English")
        
        return f"""You are a helpful AI assistant for RenovaVision. Respond in {language_name} language.

Key talking points:
- RenovaVision specializes in conversational AI agents. They provide textual and voice agents, video avatars
- Our agents can speak multiple languages fluently
- We support various TTS providers (OpenAI, Google)
- Easy integration and customization options
- Cost-effective solutions for businesses of all sizes

Tone: Professional, enthusiastic, helpful, and knowledgeable
Style: Very concise and direct, focus on customer needs
Language: Always respond in {language_name}

Remember: You are having a voice conversation. Keep responses under 15 words maximum."""
    
    def get_agent_info(self) -> Dict:
        """Get information about the agent"""
        return {
            "type": self.agent_type.value,
            "name": "RenovaVision Presale Manager",
            "description": "AI voice solutions specialist for RenovaVision",
            "language": self.language_mapping.get(self.language, "English"),
            "llm": "GPT-4o-mini" if self.openai_available else "Fallback responses"
        }
    
    async def process_message(self, text: str, language: str = "en", provider: str = "openai") -> Dict:
        """Process a user message and generate an intelligent response with TTS (optimized)"""
        try:
            # Add message to conversation history (optimized)
            self.conversation_history.append({
                "user": text,
                "timestamp": datetime.now().isoformat(),
                "language": language
            })
            
            # Keep only recent history for speed
            if len(self.conversation_history) > self.max_history:
                self.conversation_history = self.conversation_history[-self.max_history:]
            
            # Track timing metrics
            timing_metrics = {}
            
            # Generate intelligent response using GPT-4o-mini (optimized for speed)
            llm_start_time = time.time()
            if self.openai_available:
                response_text = self._generate_llm_response(text, language)
            else:
                response_text = self._generate_fallback_response(text, language)
            llm_end_time = time.time()
            timing_metrics['llm_time'] = round((llm_end_time - llm_start_time) * 1000, 2)
            
            # Generate TTS audio (optimized for speed)
            tts_start_time = time.time()
            audio_data = await self.tts_manager.generate_speech(
                text=response_text,
                language=language,
                provider=provider
            )
            tts_end_time = time.time()
            timing_metrics['tts_time'] = round((tts_end_time - tts_start_time) * 1000, 2)
            
            # Convert audio to base64 for direct transmission (avoid file I/O)
            import base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            # Add response to conversation history
            self.conversation_history.append({
                "agent": response_text,
                "timestamp": datetime.now().isoformat(),
                "language": language,
                "provider": provider
            })
            
            return {
                "type": "agent_message",
                "text": response_text,
                "audio_data": audio_base64,  # Send audio directly
                "agent_type": self.agent_type.value,
                "agent_name": "RenovaVision Presale Manager",
                "timestamp": datetime.now().isoformat(),
                "language": language,
                "provider": provider,
                "timing_metrics": timing_metrics
            }
            
        except Exception as e:
            print(f"Error in process_message: {e}")
            return {
                "type": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _generate_llm_response(self, user_message: str, language: str) -> str:
        """Generate response using GPT-4o-mini (optimized)"""
        try:
            # Prepare conversation context (optimized - only last 4 messages)
            messages = [
                {"role": "system", "content": self.system_prompt},
            ]
            
            # Add recent conversation history (only last 4 exchanges for speed)
            recent_history = self.conversation_history[-4:]  # Last 4 messages
            for msg in recent_history:
                if "user" in msg:
                    messages.append({"role": "user", "content": msg["user"]})
                elif "agent" in msg:
                    messages.append({"role": "assistant", "content": msg["agent"]})
            
            # Add current user message
            messages.append({"role": "user", "content": user_message})
            
            # Call OpenAI API using cached client (optimized for speed)
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=30,  # Very short responses - max 10 words
                temperature=0.3,  # Lower temperature for more focused responses
                presence_penalty=0.0,  # Remove penalties for speed
                frequency_penalty=0.0   # Remove penalties for speed
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"LLM response generation failed: {e}")
            return self._generate_fallback_response(user_message, language)
    
    def _generate_fallback_response(self, user_message: str, language: str) -> str:
        """Generate fallback response when LLM is not available (optimized)"""
        language_name = self.language_mapping.get(language, "English")
        
        # Simple keyword-based responses in the target language
        user_message_lower = user_message.lower()
        
        if any(word in user_message_lower for word in ["hello", "hi", "hey", "start", "begin"]):
            if language == "be":
                return "Прывітанне! Што вас цікавіць?"
            elif language == "pl":
                return "Cześć! Co Cię interesuje?"
            elif language == "lt":
                return "Labas! Kas jus domina?"
            elif language == "lv":
                return "Sveiki! Kas jūs interesē?"
            elif language == "et":
                return "Tere! Mis teid huvitab?"
            else:
                return "Hello! What interests you?"
        
        elif any(word in user_message_lower for word in ["price", "cost", "pricing", "budget"]):
            if language == "be":
                return "Цэны залежаць ад выкарыстання."
            elif language == "pl":
                return "Ceny zależą od użycia."
            elif language == "lt":
                return "Kainos priklauso nuo naudojimo."
            elif language == "lv":
                return "Cenas atkarīgas no lietošanas."
            elif language == "et":
                return "Hinnad sõltuvad kasutamisest."
            else:
                return "Pricing depends on usage."
        
        elif any(word in user_message_lower for word in ["language", "multilingual", "belarusian", "polish", "lithuanian", "latvian", "estonian"]):
            if language == "be":
                return "Мы падтрымліваем 6 моў."
            elif language == "pl":
                return "Obsługujemy 6 języków."
            elif language == "lt":
                return "Palaikome 6 kalbas."
            elif language == "lv":
                return "Atbalstām 6 valodas."
            elif language == "et":
                return "Toetame 6 keelt."
            else:
                return "We support 6 languages."
        
        else:
            # Default response
            if language == "be":
                return "Як магу дапамагчы?"
            elif language == "pl":
                return "Jak mogę pomóc?"
            elif language == "lt":
                return "Kaip galiu padėti?"
            elif language == "lv":
                return "Kā es varu palīdzēt?"
            elif language == "et":
                return "Kuidas saan aidata?"
            else:
                return "How can I help?"
    
    def get_conversation_history(self) -> List[Dict]:
        """Get conversation history (optimized)"""
        return self.conversation_history.copy() 