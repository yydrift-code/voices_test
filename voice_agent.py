import json
import random
from typing import Dict, List, Optional
from datetime import datetime

class RenovaVisionAgent:
    """AI Voice Agent acting as a RenovaVision presale specialist"""
    
    def __init__(self, tts_manager):
        self.tts_manager = tts_manager
        self.conversation_history = []
        
        # Agent personality and knowledge
        self.agent_info = {
            "name": "RenovaVision AI Specialist",
            "company": "RenovaVision",
            "role": "AI Voice Solutions Presale Specialist",
            "expertise": "TTS providers, voice agents, multilingual solutions"
        }
        
        # TTS provider information for sales pitch
        self.provider_info = {

            "openai": {
                "name": "OpenAI TTS",
                "strengths": [
                    "Very natural speech synthesis",
                    "Multiple voice options",
                    "Fast generation",
                    "Reliable API",
                    "Good for general use cases"
                ],
                "pricing": "Pay-per-use, reasonable pricing",
                "best_for": "General applications, content creation, accessibility"
            },
            "google": {
                "name": "Google Cloud TTS",
                "strengths": [
                    "Wide language support",
                    "SSML support for advanced control",
                    "Neural voices available",
                    "Enterprise-grade reliability",
                    "Good integration with Google services"
                ],
                "pricing": "Pay-per-use, enterprise pricing",
                "best_for": "Enterprise applications, Google ecosystem integration"
            },
            

        }
        
        # Sample conversation responses
        self.responses = {
            "greeting": [
                "Hello! I'm your RenovaVision AI Voice Specialist. I can help you explore the best TTS solutions for your needs. What kind of voice application are you looking to build?",
                "Welcome to RenovaVision! I'm here to guide you through our AI voice solutions. Are you interested in multilingual support, voice cloning, or general TTS capabilities?",
                "Hi there! I'm excited to help you find the perfect TTS provider for your project. What's your primary use case for AI voice technology?"
            ],
            "provider_comparison": [
                "Let me show you a comparison of different TTS providers. Each has unique strengths - would you like to hear samples from different providers?",
                "I'd be happy to demonstrate the differences between TTS providers. We can compare quality, speed, and language support. Which aspect is most important to you?",
                "Great question! Let me generate some samples so you can hear the differences firsthand. What text would you like me to use for the comparison?"
            ],
            "multilingual": [
                "Excellent choice! We support multiple languages including Belarusian, Polish, Lithuanian, Latvian, and Estonian. Would you like to hear samples in any specific language?",
                "Our multilingual capabilities are one of our strongest features. I can demonstrate voice quality across different languages. Which language would you like to explore?",
                "Perfect! Multilingual support is crucial for global applications. Let me show you how our TTS providers handle different languages."
            ],
            "pricing": [
                "Pricing varies by provider and usage. We have solutions for every budget - from free open-source options to premium enterprise services. What's your expected usage volume?",
                "We have solutions for every budget - from free open-source options to premium enterprise services. What's your expected usage volume?",
                "Let me break down the pricing for you. We can start with cost-effective solutions and scale up as your needs grow."
            ],
            "technical_details": [
                "I can provide detailed technical specifications for each provider. Are you looking for API documentation, integration guides, or performance benchmarks?",
                "Technical implementation varies by provider. Some offer simple APIs while others provide advanced features like voice cloning. What's your technical expertise level?",
                "Let me walk you through the technical requirements for each solution. Do you need real-time generation or can you work with pre-generated audio?"
            ],
            "demo_request": [
                "Absolutely! Let me generate a sample for you right now. What text would you like to hear, and which language should I use?",
                "I'd love to demonstrate our capabilities! I can show you different voices and languages. Just tell me what you'd like to hear.",
                "Perfect timing for a demo! I can generate samples from multiple providers so you can compare quality and style."
            ],
            "closing": [
                "Thank you for exploring RenovaVision's AI voice solutions! Would you like me to send you detailed information about any specific provider?",
                "I hope this demo has been helpful! Feel free to ask any follow-up questions about implementation or pricing.",
                "It's been great showing you our TTS capabilities! Let me know if you need any additional information or technical support."
            ]
        }
    
    async def process_message(self, text: str, language: str = "en", provider: str = "openai") -> Dict:
        """Process user message and generate appropriate response"""
        
        # Add to conversation history
        self.conversation_history.append({
            "user": text,
            "timestamp": datetime.now().isoformat(),
            "language": language
        })
        
        # Analyze user intent
        intent = self._analyze_intent(text.lower())
        
        # Generate response
        response_text = self._generate_response(intent, text, language)
        
        # Generate TTS audio
        try:
            audio_data = await self.tts_manager.generate_speech(
                text=response_text,
                language=language,
                provider=provider
            )
            
            # Convert audio data to base64 for WebSocket transmission
            import base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        except Exception as e:
            audio_base64 = None
            print(f"TTS generation failed: {e}")
        
        # Create response
        response = {
            "type": "agent_message",
            "text": response_text,
            "provider": provider,
            "language": language,
            "audio_data": audio_base64,
            "timestamp": datetime.now().isoformat(),
            "intent": intent
        }
        
        # Add to conversation history
        self.conversation_history.append({
            "agent": response_text,
            "timestamp": datetime.now().isoformat(),
            "provider": provider,
            "language": language
        })
        
        return response
    
    def _analyze_intent(self, text: str) -> str:
        """Analyze user intent from text"""
        text_lower = text.lower()
        
        # Greeting patterns
        if any(word in text_lower for word in ["hello", "hi", "hey", "start", "begin"]):
            return "greeting"
        
        # Provider comparison
        if any(word in text_lower for word in ["compare", "difference", "vs", "versus", "which", "better"]):
            return "provider_comparison"
        
        # Multilingual
        if any(word in text_lower for word in ["language", "multilingual", "belarusian", "polish", "lithuanian", "latvian", "estonian"]):
            return "multilingual"
        
        # Pricing
        if any(word in text_lower for word in ["price", "cost", "pricing", "budget", "expensive", "cheap", "free"]):
            return "pricing"
        
        # Technical details
        if any(word in text_lower for word in ["technical", "api", "integration", "implementation", "code", "setup"]):
            return "technical_details"
        
        # Demo request
        if any(word in text_lower for word in ["demo", "sample", "hear", "show", "demonstrate", "example"]):
            return "demo_request"
        
        # Closing
        if any(word in text_lower for word in ["bye", "goodbye", "thanks", "thank you", "end", "finish"]):
            return "closing"
        
        # Default to general inquiry
        return "general_inquiry"
    
    def _generate_response(self, intent: str, original_text: str, language: str) -> str:
        """Generate appropriate response based on intent"""
        
        if intent == "greeting":
            return random.choice(self.responses["greeting"])
        
        elif intent == "provider_comparison":
            response = random.choice(self.responses["provider_comparison"])
            
            # Add specific provider information
            available_providers = self.tts_manager.get_available_providers()
            if available_providers:
                response += f"\n\nAvailable providers: {', '.join(available_providers)}"
            
            return response
        
        elif intent == "multilingual":
            response = random.choice(self.responses["multilingual"])
            response += f"\n\nSupported languages: {', '.join(self.tts_manager.get_supported_languages().values())}"
            return response
        
        elif intent == "pricing":
            response = random.choice(self.responses["pricing"])
            
            # Add pricing details for available providers
            available_providers = self.tts_manager.get_available_providers()
            for provider in available_providers[:2]:  # Show first 2 providers
                if provider in self.provider_info:
                    info = self.provider_info[provider]
                    response += f"\n\n{info['name']}: {info['pricing']}"
            
            return response
        
        elif intent == "technical_details":
            return random.choice(self.responses["technical_details"])
        
        elif intent == "demo_request":
            response = random.choice(self.responses["demo_request"])
            
            # Suggest demo text based on language
            demo_texts = {
                "be": "Прывітанне! Гэта дэманстрацыя беларускай мовы.",
                "pl": "Cześć! To jest demonstracja języka polskiego.",
                "lt": "Labas! Tai lietuvių kalbos demonstracija.",
                "lv": "Sveiki! Šī ir latviešu valodas demonstrācija.",
                "et": "Tere! See on eesti keele demonstratsioon.",
                "en": "Hello! This is a demonstration of our TTS capabilities."
            }
            
            demo_text = demo_texts.get(language, demo_texts["en"])
            response += f"\n\nI can demonstrate with: '{demo_text}'"
            
            return response
        
        elif intent == "closing":
            return random.choice(self.responses["closing"])
        
        else:
            # General inquiry - provide helpful information
            return (
                "I'm here to help you explore AI voice solutions! I can help you with:\n"
                "• Comparing different TTS providers\n"
                "• Multilingual voice capabilities\n"
                "• Pricing and technical details\n"
                "• Live demonstrations\n\n"
                "What would you like to know more about?"
            )
    
    def get_provider_details(self, provider: str) -> Optional[Dict]:
        """Get detailed information about a specific provider"""
        return self.provider_info.get(provider)
    
    def get_conversation_history(self) -> List[Dict]:
        """Get conversation history"""
        return self.conversation_history 