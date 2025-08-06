#!/usr/bin/env python3
"""
Performance test script to measure TTS and LLM response times
"""

import asyncio
import time
import os
from dotenv import load_dotenv
from tts_providers import TTSProviderManager
from voice_agents import VoiceAgent, AgentType

# Load environment variables
load_dotenv()

async def test_tts_performance():
    """Test TTS performance with different providers"""
    print("🔍 Testing TTS Performance...")
    
    # Initialize TTS manager
    tts_manager = TTSProviderManager()
    
    test_text = "Hello, this is a performance test."
    providers = tts_manager.get_available_providers()
    
    results = {}
    
    for provider in providers:
        print(f"\n📊 Testing {provider}...")
        
        # Warm up (first call is usually slower)
        try:
            await tts_manager.generate_speech(test_text, "en", provider)
        except Exception as e:
            print(f"❌ {provider} warmup failed: {e}")
            continue
        
        # Test multiple calls
        times = []
        for i in range(3):
            start_time = time.time()
            try:
                audio_data = await tts_manager.generate_speech(test_text, "en", provider)
                end_time = time.time()
                duration = (end_time - start_time) * 1000  # Convert to milliseconds
                times.append(duration)
                print(f"  Call {i+1}: {duration:.1f}ms ({len(audio_data)} bytes)")
            except Exception as e:
                print(f"  ❌ Call {i+1} failed: {e}")
        
        if times:
            avg_time = sum(times) / len(times)
            results[provider] = {
                "avg_time": avg_time,
                "min_time": min(times),
                "max_time": max(times),
                "audio_size": len(audio_data) if 'audio_data' in locals() else 0
            }
            print(f"  ✅ Average: {avg_time:.1f}ms")
    
    return results

async def test_agent_performance():
    """Test agent response performance"""
    print("\n🤖 Testing Agent Performance...")
    
    # Initialize services
    tts_manager = TTSProviderManager()
    agent = VoiceAgent(AgentType.PRESALE_MANAGER, tts_manager, "en")
    
    test_messages = [
        "Hello",
        "What's the pricing?",
        "Tell me about languages",
        "How does it work?"
    ]
    
    results = []
    
    for i, message in enumerate(test_messages):
        print(f"\n📝 Test {i+1}: '{message}'")
        
        start_time = time.time()
        try:
            response = await agent.process_message(message, "en", "openai")
            end_time = time.time()
            
            total_time = (end_time - start_time) * 1000
            llm_time = response.get("timing_metrics", {}).get("llm_time", 0)
            tts_time = response.get("timing_metrics", {}).get("tts_time", 0)
            
            results.append({
                "message": message,
                "response": response.get("text", ""),
                "total_time": total_time,
                "llm_time": llm_time,
                "tts_time": tts_time,
                "audio_size": len(response.get("audio_base64", "")) if response.get("audio_base64") else 0
            })
            
            print(f"  ✅ Total: {total_time:.1f}ms (LLM: {llm_time:.1f}ms, TTS: {tts_time:.1f}ms)")
            print(f"  📝 Response: '{response.get('text', '')}'")
            
        except Exception as e:
            print(f"  ❌ Failed: {e}")
    
    return results

async def main():
    """Run all performance tests"""
    print("🚀 Starting Performance Tests...")
    print("=" * 50)
    
    # Test TTS performance
    tts_results = await test_tts_performance()
    
    # Test agent performance
    agent_results = await test_agent_performance()
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 PERFORMANCE SUMMARY")
    print("=" * 50)
    
    print("\n🎵 TTS Performance:")
    for provider, metrics in tts_results.items():
        print(f"  {provider.upper()}:")
        print(f"    Average: {metrics['avg_time']:.1f}ms")
        print(f"    Range: {metrics['min_time']:.1f}ms - {metrics['max_time']:.1f}ms")
        print(f"    Audio size: {metrics['audio_size']} bytes")
    
    print("\n🤖 Agent Performance:")
    if agent_results:
        total_times = [r["total_time"] for r in agent_results]
        llm_times = [r["llm_time"] for r in agent_results]
        tts_times = [r["tts_time"] for r in agent_results]
        
        print(f"  Average total time: {sum(total_times)/len(total_times):.1f}ms")
        print(f"  Average LLM time: {sum(llm_times)/len(llm_times):.1f}ms")
        print(f"  Average TTS time: {sum(tts_times)/len(tts_times):.1f}ms")
        print(f"  Fastest response: {min(total_times):.1f}ms")
        print(f"  Slowest response: {max(total_times):.1f}ms")
    
    print("\n✅ Performance tests completed!")

if __name__ == "__main__":
    asyncio.run(main()) 