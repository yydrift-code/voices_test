import os
import asyncio
import json
import tempfile
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum

class AgentType(Enum):
    """Types of voice agents"""
    CUSTOMER_SERVICE = "customer_service"
    SALES = "sales"
    TECHNICAL_SUPPORT = "technical_support"
    EDUCATIONAL = "educational"
    ENTERTAINMENT = "entertainment"

class VoiceAgent:
    """Voice agent that can process messages and generate responses"""
    
    def __init__(self, agent_type: AgentType, tts_manager, language: str = "en"):
        self.agent_type = agent_type
        self.tts_manager = tts_manager
        self.language = language
        self.conversation_history = []
        
        # Agent personalities and responses
        self.personalities = {
            AgentType.CUSTOMER_SERVICE: {
                "name": "Customer Service Agent",
                "description": "Helpful and professional customer service representative",
                "greeting": "Hello! I'm your customer service agent. How can I help you today?",
                "responses": {
                    "greeting": "Hello! I'm here to help you with any questions or concerns you may have.",
                    "complaint": "I understand your concern. Let me help you resolve this issue.",
                    "question": "I'd be happy to answer your question. Let me provide you with the information you need.",
                    "goodbye": "Thank you for contacting us. Have a great day!"
                }
            },
            AgentType.SALES: {
                "name": "Sales Agent",
                "description": "Enthusiastic and persuasive sales representative",
                "greeting": "Hi there! I'm excited to tell you about our amazing products and services!",
                "responses": {
                    "greeting": "Welcome! I'm here to show you how our products can benefit you.",
                    "product_interest": "That's a great choice! Let me tell you more about the features and benefits.",
                    "pricing": "I'd be happy to discuss our competitive pricing and special offers.",
                    "objection": "I understand your concern. Let me address that and show you the value.",
                    "closing": "Would you like to proceed with this excellent opportunity?"
                }
            },
            AgentType.TECHNICAL_SUPPORT: {
                "name": "Technical Support Agent",
                "description": "Knowledgeable and patient technical support specialist",
                "greeting": "Hello! I'm your technical support agent. What technical issue can I help you with?",
                "responses": {
                    "greeting": "Hello! I'm here to help you resolve any technical issues.",
                    "problem_description": "I understand the issue you're experiencing. Let me guide you through the solution.",
                    "step_by_step": "Let me walk you through this step by step to resolve the problem.",
                    "escalation": "If this doesn't resolve your issue, I can escalate it to our advanced support team.",
                    "confirmation": "Great! Let's confirm that the issue has been resolved."
                }
            },
            AgentType.EDUCATIONAL: {
                "name": "Educational Assistant",
                "description": "Patient and encouraging educational guide",
                "greeting": "Hello! I'm your educational assistant. What would you like to learn about today?",
                "responses": {
                    "greeting": "Welcome to your learning session! I'm here to help you understand and grow.",
                    "explanation": "Let me explain this concept in a way that's easy to understand.",
                    "encouragement": "You're doing great! Learning takes time and practice.",
                    "question": "That's an excellent question! Let me provide you with a detailed answer.",
                    "summary": "Let me summarize what we've covered to reinforce your learning."
                }
            },
            AgentType.ENTERTAINMENT: {
                "name": "Entertainment Assistant",
                "description": "Fun and engaging entertainment companion",
                "greeting": "Hey there! I'm your entertainment assistant. Ready to have some fun?",
                "responses": {
                    "greeting": "Welcome to the fun zone! I'm here to entertain and amuse you.",
                    "joke": "Here's a joke for you: Why don't scientists trust atoms? Because they make up everything!",
                    "story": "Let me tell you a short story to brighten your day.",
                    "game": "How about we play a quick word game or trivia?",
                    "positive": "You're awesome! Let's keep the good vibes going!"
                }
            }
        }
    
    def get_agent_info(self) -> Dict:
        """Get information about the agent"""
        personality = self.personalities.get(self.agent_type, {})
        return {
            "type": self.agent_type.value,
            "name": personality.get("name", "Unknown Agent"),
            "description": personality.get("description", "A helpful voice agent"),
            "greeting": personality.get("greeting", "Hello! How can I help you?")
        }
    
    def _analyze_message(self, text: str) -> str:
        """Analyze the message to determine the appropriate response type"""
        text_lower = text.lower()
        
        # Simple keyword-based analysis
        if any(word in text_lower for word in ["hello", "hi", "hey", "good morning", "good afternoon"]):
            return "greeting"
        elif any(word in text_lower for word in ["goodbye", "bye", "see you", "thank you", "thanks"]):
            return "goodbye"
        elif any(word in text_lower for word in ["problem", "issue", "broken", "error", "not working"]):
            return "problem_description"
        elif any(word in text_lower for word in ["product", "service", "feature", "benefit"]):
            return "product_interest"
        elif any(word in text_lower for word in ["price", "cost", "expensive", "cheap"]):
            return "pricing"
        elif any(word in text_lower for word in ["joke", "funny", "humor"]):
            return "joke"
        elif any(word in text_lower for word in ["story", "tale", "narrative"]):
            return "story"
        elif any(word in text_lower for word in ["game", "play", "trivia"]):
            return "game"
        elif any(word in text_lower for word in ["explain", "how", "what", "why", "when", "where"]):
            return "explanation"
        else:
            return "general"
    
    def _generate_response(self, message_type: str, user_message: str) -> str:
        """Generate a contextual response based on the message type"""
        personality = self.personalities.get(self.agent_type, {})
        responses = personality.get("responses", {})
        
        # Get base response
        base_response = responses.get(message_type, "I understand. Let me help you with that.")
        
        # Add some contextual elements
        if message_type == "greeting":
            return base_response
        elif message_type == "goodbye":
            return base_response
        elif message_type == "joke":
            return "Here's a joke for you: Why don't scientists trust atoms? Because they make up everything! 😄"
        elif message_type == "story":
            return "Once upon a time, there was a helpful AI assistant who loved making people smile. The end! ✨"
        elif message_type == "game":
            return "Let's play! I'm thinking of a number between 1 and 10. Can you guess it?"
        else:
            # Add some variety to responses
            variations = [
                base_response,
                f"{base_response} I'm here to assist you further.",
                f"{base_response} Is there anything else you'd like to know?"
            ]
            import random
            return random.choice(variations)
    
    async def process_message(self, text: str, language: str = "en", provider: str = "openai") -> Dict:
        """Process a user message and generate a response with TTS"""
        try:
            # Add message to conversation history
            self.conversation_history.append({
                "user": text,
                "timestamp": datetime.now().isoformat()
            })
            
            # Analyze the message
            message_type = self._analyze_message(text)
            
            # Generate response
            response_text = self._generate_response(message_type, text)
            
            # Generate TTS audio
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
                "timestamp": datetime.now().isoformat()
            })
            
            return {
                "type": "agent_response",
                "text": response_text,
                "audio_file": filename,
                "agent_type": self.agent_type.value,
                "agent_name": self.personalities[self.agent_type]["name"],
                "timestamp": datetime.now().isoformat(),
                "message_type": message_type
            }
            
        except Exception as e:
            return {
                "type": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def get_conversation_history(self) -> List[Dict]:
        """Get the conversation history"""
        return self.conversation_history 