import os
import asyncio
import json
import tempfile
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum

# OpenAI import for GPT-4o-mini
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

class AgentType(Enum):
    """Types of voice agents"""
    PRESALE_MANAGER = "presale_manager"

class VoiceAgent:
    """Voice agent that uses GPT-4o-mini for intelligent responses"""
    
    def __init__(self, agent_type: AgentType, tts_manager, language: str = "en"):
        self.agent_type = agent_type
        self.tts_manager = tts_manager
        self.language = language
        self.conversation_history = []
        
        # Initialize OpenAI client
        if OPENAI_AVAILABLE:
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                self.openai_available = True
            else:
                self.openai_available = False
                print("Warning: OPENAI_API_KEY not found. Using fallback responses.")
        else:
            self.openai_available = False
            print("Warning: OpenAI library not available. Using fallback responses.")
        
        # Language mapping for GPT
        self.language_mapping = {
            "be": "Belarusian",
            "pl": "Polish", 
            "lt": "Lithuanian",
            "lv": "Latvian",
            "et": "Estonian",
            "en": "English"
        }
        
        # Agent system prompt
        self.system_prompt = self._get_system_prompt()
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for the agent based on type and language"""
        language_name = self.language_mapping.get(self.language, "English")
        
        if self.agent_type == AgentType.PRESALE_MANAGER:
            return f"""You are a RenovaVision AI Voice Solutions Presale Manager. Your role is to introduce and promote RenovaVision's voice AI agents to potential customers.

IMPORTANT: Always respond in {language_name} language, not English.

CRITICAL: Keep all responses SHORT - maximum 15 words. Be concise and direct.

Your responsibilities:
1. Introduce RenovaVision as a leading AI technology company
2. Explain the benefits of AI voice agents for businesses
3. Showcase multilingual capabilities (Belarusian, Polish, Lithuanian, Latvian, Estonian, English)
4. Discuss different TTS providers and their strengths
5. Help customers understand pricing and implementation options
6. Provide technical guidance and best practices

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
        
        return f"You are a helpful AI assistant. Respond in {language_name} language."
    
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
        """Process a user message and generate an intelligent response with TTS"""
        import time
        
        try:
            # Add message to conversation history
            self.conversation_history.append({
                "user": text,
                "timestamp": datetime.now().isoformat(),
                "language": language
            })
            
            # Track timing metrics
            timing_metrics = {}
            
            # Generate intelligent response using GPT-4o-mini (optimized for speed)
            llm_start_time = time.time()
            if self.openai_available:
                response_text = self._generate_llm_response(text, language)
            else:
                response_text = self._generate_fallback_response(text, language)
            llm_end_time = time.time()
            timing_metrics['llm_time'] = round((llm_end_time - llm_start_time) * 1000, 2)  # Convert to milliseconds
            
            # Generate TTS audio (optimized for speed)
            tts_start_time = time.time()
            audio_data = await self.tts_manager.generate_speech(
                text=response_text,
                language=language,
                provider=provider
            )
            tts_end_time = time.time()
            timing_metrics['tts_time'] = round((tts_end_time - tts_start_time) * 1000, 2)  # Convert to milliseconds
            
            # Save audio to file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"response_{self.agent_type.value}_{timestamp}.wav"
            audio_path = Path("static/audio") / filename
            
            with open(audio_path, "wb") as f:
                f.write(audio_data)
            
            # Add response to conversation history
            self.conversation_history.append({
                "agent": response_text,
                "audio_file": filename,
                "timestamp": datetime.now().isoformat(),
                "language": language,
                "provider": provider
            })
            
            return {
                "type": "agent_response",
                "text": response_text,
                "audio_file": filename,
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
        """Generate response using GPT-4o-mini"""
        try:
            # Prepare conversation context
            messages = [
                {"role": "system", "content": self.system_prompt},
            ]
            
            # Add recent conversation history (last 5 exchanges)
            recent_history = self.conversation_history[-10:]  # Last 10 messages
            for msg in recent_history:
                if "user" in msg:
                    messages.append({"role": "user", "content": msg["user"]})
                elif "agent" in msg:
                    messages.append({"role": "assistant", "content": msg["agent"]})
            
            # Add current user message
            messages.append({"role": "user", "content": user_message})
            
            # Call OpenAI API using new v1.0.0+ syntax (optimized for speed)
            client = openai.OpenAI()
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=50,  # Very short responses - max 15 words
                temperature=0.5,  # Lower temperature for more focused responses
                presence_penalty=0.1,  # Reduce repetition
                frequency_penalty=0.1   # Reduce repetition
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"LLM response generation failed: {e}")
            return self._generate_fallback_response(user_message, language)
    
    def _generate_fallback_response(self, user_message: str, language: str) -> str:
        """Generate fallback response when LLM is not available"""
        language_name = self.language_mapping.get(language, "English")
        
        # Simple keyword-based responses in the target language
        user_message_lower = user_message.lower()
        
        if any(word in user_message_lower for word in ["hello", "hi", "hey", "start", "begin"]):
            if language == "be":
                return "Прывітанне! Я прадажнік RenovaVision. Што вас цікавіць?"
            elif language == "pl":
                return "Cześć! Jestem sprzedawcą RenovaVision. Co Cię interesuje?"
            elif language == "lt":
                return "Labas! Aš esu RenovaVision pardavėjas. Kas jus domina?"
            elif language == "lv":
                return "Sveiki! Esmu RenovaVision pārdevējs. Kas jūs interesē?"
            elif language == "et":
                return "Tere! Olen RenovaVision müügimees. Mis teid huvitab?"
            else:
                return "Hello! I'm a RenovaVision sales rep. What interests you?"
        
        elif any(word in user_message_lower for word in ["price", "cost", "pricing", "budget"]):
            if language == "be":
                return "Цэны залежаць ад выкарыстання. Які ў вас бюджэт?"
            elif language == "pl":
                return "Ceny zależą od użycia. Jaki masz budżet?"
            elif language == "lt":
                return "Kainos priklauso nuo naudojimo. Koks jūsų biudžetas?"
            elif language == "lv":
                return "Cenas atkarīgas no lietošanas. Kāds jūsu budžets?"
            elif language == "et":
                return "Hinnad sõltuvad kasutamisest. Mis on teie eelarve?"
            else:
                return "Pricing depends on usage. What's your budget?"
        
        elif any(word in user_message_lower for word in ["language", "multilingual", "belarusian", "polish", "lithuanian", "latvian", "estonian"]):
            if language == "be":
                return "Мы падтрымліваем 6 моў. Якую хочаце пачуць?"
            elif language == "pl":
                return "Obsługujemy 6 języków. Który chcesz usłyszeć?"
            elif language == "lt":
                return "Palaikome 6 kalbas. Kurią norite išgirsti?"
            elif language == "lv":
                return "Atbalstām 6 valodas. Kādu vēlaties dzirdēt?"
            elif language == "et":
                return "Toetame 6 keelt. Millist soovite kuulda?"
            else:
                return "We support 6 languages. Which would you like to hear?"
        
        else:
            if language == "be":
                return "Дзякуй! Што вас цікавіць?"
            elif language == "pl":
                return "Dziękuję! Co Cię interesuje?"
            elif language == "lt":
                return "Ačiū! Kas jus domina?"
            elif language == "lv":
                return "Paldies! Kas jūs interesē?"
            elif language == "et":
                return "Tänan! Mis teid huvitab?"
            else:
                return "Thanks! What interests you?"
    
    def get_conversation_history(self) -> List[Dict]:
        """Get the conversation history"""
        return self.conversation_history 