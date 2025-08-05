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

Your responsibilities:
1. Introduce RenovaVision as a leading AI voice technology company
2. Explain the benefits of AI voice agents for businesses
3. Showcase multilingual capabilities (Belarusian, Polish, Lithuanian, Latvian, Estonian, English)
4. Discuss different TTS providers and their strengths
5. Help customers understand pricing and implementation options
6. Provide technical guidance and best practices

Key talking points:
- RenovaVision specializes in AI voice agents for customer service, sales, and support
- Our agents can speak multiple languages fluently
- We support various TTS providers (OpenAI, Google, pyttsx3)
- Easy integration and customization options
- Cost-effective solutions for businesses of all sizes

Tone: Professional, enthusiastic, helpful, and knowledgeable
Style: Conversational but informative, focus on customer needs
Language: Always respond in {language_name}

Remember: You are having a voice conversation, so keep responses concise and natural for speech."""
        
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
        try:
            # Add message to conversation history
            self.conversation_history.append({
                "user": text,
                "timestamp": datetime.now().isoformat(),
                "language": language
            })
            
            # Generate intelligent response using GPT-4o-mini (optimized for speed)
            if self.openai_available:
                response_text = self._generate_llm_response(text, language)
            else:
                response_text = self._generate_fallback_response(text, language)
            
            # Generate TTS audio (optimized for speed)
            audio_data = await self.tts_manager.generate_speech(
                text=response_text,
                language=language,
                provider=provider
            )
            
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
                "provider": provider
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
                max_tokens=150,  # Reduced for faster response
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
                return "Прывітанне! Я прадажнік RenovaVision AI Voice Solutions. Я дапамагу вам даведацца пра нашы галасавыя AI агенты. Што вас цікавіць?"
            elif language == "pl":
                return "Cześć! Jestem sprzedawcą RenovaVision AI Voice Solutions. Pomogę Ci poznać nasze głosowe agenty AI. Co Cię interesuje?"
            elif language == "lt":
                return "Labas! Aš esu RenovaVision AI Voice Solutions pardavėjas. Padėsiu jums susipažinti su mūsų balso AI agentais. Kas jus domina?"
            elif language == "lv":
                return "Sveiki! Esmu RenovaVision AI Voice Solutions pārdevējs. Palīdzēšu jums iepazīties ar mūsu balss AI aģentiem. Kas jūs interesē?"
            elif language == "et":
                return "Tere! Olen RenovaVision AI Voice Solutions müügimees. Aitan teil tutvuda meie hääl AI agentidega. Mis teid huvitab?"
            else:
                return "Hello! I'm a RenovaVision AI Voice Solutions sales representative. I'll help you learn about our voice AI agents. What interests you?"
        
        elif any(word in user_message_lower for word in ["price", "cost", "pricing", "budget"]):
            if language == "be":
                return "Нашы цэны залежаць ад вашага выкарыстання і патрабаванняў. Мы прапануем гнуткія планы для розных памераў бізнесу. Які ў вас бюджэт?"
            elif language == "pl":
                return "Nasze ceny zależą od Twojego użycia i wymagań. Oferujemy elastyczne plany dla firm różnej wielkości. Jaki masz budżet?"
            elif language == "lt":
                return "Mūsų kainos priklauso nuo jūsų naudojimo ir reikalavimų. Siūlome lanksčius planus skirtingo dydžio įmonėms. Koks jūsų biudžetas?"
            elif language == "lv":
                return "Mūsu cenas ir atkarīgas no jūsu lietošanas un prasībām. Piedāvājam elastīgus plānus dažāda izmēra uzņēmumiem. Kāds ir jūsu budžets?"
            elif language == "et":
                return "Meie hinnad sõltuvad teie kasutamisest ja nõuetest. Pakume paindlikke plaane erineva suurusega ettevõtetele. Mis on teie eelarve?"
            else:
                return "Our pricing depends on your usage and requirements. We offer flexible plans for businesses of all sizes. What's your budget?"
        
        elif any(word in user_message_lower for word in ["language", "multilingual", "belarusian", "polish", "lithuanian", "latvian", "estonian"]):
            if language == "be":
                return "Нашы AI агенты могуць гаварыць на беларускай, польскай, літоўскай, латышскай, эстонскай і англійскай мовах. Якую мову вы хочаце пачуць?"
            elif language == "pl":
                return "Nasi agenci AI mogą mówić po białorusku, polsku, litewsku, łotewsku, estońsku i angielsku. Jaki język chcesz usłyszeć?"
            elif language == "lt":
                return "Mūsų AI agentai gali kalbėti baltarusių, lenkų, lietuvių, latvių, estų ir anglų kalbomis. Kokią kalbą norite išgirsti?"
            elif language == "lv":
                return "Mūsu AI aģenti var runāt baltkrievu, poļu, lietuviešu, latviešu, igauņu un angļu valodās. Kādu valodu vēlaties dzirdēt?"
            elif language == "et":
                return "Meie AI agendid saavad rääkida valgevene, poola, leedu, läti, eesti ja inglise keeles. Millist keelt soovite kuulda?"
            else:
                return "Our AI agents can speak Belarusian, Polish, Lithuanian, Latvian, Estonian, and English. Which language would you like to hear?"
        
        else:
            if language == "be":
                return "Дзякуй за ваш цікавасць да RenovaVision! Я магу дапамагчы вам з інфармацыяй пра нашы галасавыя AI рашэнні. Што вас цікавіць найбольш?"
            elif language == "pl":
                return "Dziękuję za zainteresowanie RenovaVision! Mogę pomóc Ci z informacjami o naszych głosowych rozwiązaniach AI. Co Cię najbardziej interesuje?"
            elif language == "lt":
                return "Ačiū už susidomėjimą RenovaVision! Galiu padėti jums su informacija apie mūsų balso AI sprendimus. Kas jus labiausiai domina?"
            elif language == "lv":
                return "Paldies par interesi par RenovaVision! Es varu palīdzēt jums ar informāciju par mūsu balss AI risinājumiem. Kas jūs visvairāk interesē?"
            elif language == "et":
                return "Tänan huvi RenovaVision vastu! Saan aidata teid meie hääl AI lahenduste kohta. Mis teid kõige rohkem huvitab?"
            else:
                return "Thank you for your interest in RenovaVision! I can help you with information about our voice AI solutions. What interests you most?"
    
    def get_conversation_history(self) -> List[Dict]:
        """Get the conversation history"""
        return self.conversation_history 