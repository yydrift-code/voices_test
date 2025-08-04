#!/usr/bin/env python3
"""
Test script for pyttsx3 functionality
"""

import pyttsx3
import tempfile
import os
import wave
import struct
import math
import io

def test_pyttsx3_basic():
    """Test basic pyttsx3 functionality"""
    print("=== Testing Basic pyttsx3 Functionality ===")
    
    try:
        # Initialize engine
        engine = pyttsx3.init()
        print("✓ Engine initialized successfully")
        
        # Get available voices
        voices = engine.getProperty('voices')
        print(f"✓ Found {len(voices)} voices:")
        for i, voice in enumerate(voices):
            print(f"  {i}: {voice.name} ({voice.id})")
        
        # Get current properties
        rate = engine.getProperty('rate')
        volume = engine.getProperty('volume')
        print(f"✓ Current rate: {rate}")
        print(f"✓ Current volume: {volume}")
        
        return engine, voices
        
    except Exception as e:
        print(f"✗ Error initializing pyttsx3: {e}")
        return None, []

def test_pyttsx3_speak():
    """Test pyttsx3 speak functionality"""
    print("\n=== Testing pyttsx3 Speak ===")
    
    engine, voices = test_pyttsx3_basic()
    if not engine:
        return False
    
    try:
        # Test speaking
        print("Testing speak functionality...")
        engine.say("Hello, this is a test of pyttsx3 speech synthesis.")
        engine.runAndWait()
        print("✓ Speak test completed")
        return True
        
    except Exception as e:
        print(f"✗ Error in speak test: {e}")
        return False

def test_pyttsx3_save_to_file():
    """Test pyttsx3 save_to_file functionality"""
    print("\n=== Testing pyttsx3 Save to File ===")
    
    engine, voices = test_pyttsx3_basic()
    if not engine:
        return False
    
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
        
        print(f"Using temporary file: {temp_path}")
        
        # Try to save audio
        text = "Hello, this is a test of pyttsx3 file saving."
        engine.save_to_file(text, temp_path)
        engine.runAndWait()
        
        # Check if file was created
        if os.path.exists(temp_path):
            file_size = os.path.getsize(temp_path)
            print(f"✓ File created: {temp_path}")
            print(f"✓ File size: {file_size} bytes")
            
            if file_size > 0:
                print("✓ File has content")
                
                # Try to read the file
                try:
                    with open(temp_path, 'rb') as f:
                        content = f.read()
                    print(f"✓ File read successfully: {len(content)} bytes")
                    
                    # Check if it's a valid WAV file
                    if content.startswith(b'RIFF'):
                        print("✓ File appears to be a valid WAV file")
                    else:
                        print("✗ File doesn't appear to be a valid WAV file")
                        
                except Exception as e:
                    print(f"✗ Error reading file: {e}")
            else:
                print("✗ File is empty")
        else:
            print("✗ File was not created")
        
        # Clean up
        if os.path.exists(temp_path):
            os.unlink(temp_path)
            print("✓ Temporary file cleaned up")
        
        return True
        
    except Exception as e:
        print(f"✗ Error in save_to_file test: {e}")
        # Clean up on error
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.unlink(temp_path)
        return False

def test_pyttsx3_voice_settings():
    """Test different voice settings"""
    print("\n=== Testing Voice Settings ===")
    
    engine, voices = test_pyttsx3_basic()
    if not engine:
        return False
    
    try:
        # Test different rates
        rates = [150, 200, 250]
        for rate in rates:
            try:
                engine.setProperty('rate', rate)
                print(f"✓ Set rate to {rate}")
                engine.say(f"Testing rate {rate}")
                engine.runAndWait()
            except Exception as e:
                print(f"✗ Error setting rate {rate}: {e}")
        
        # Test different voices
        if voices:
            for i, voice in enumerate(voices[:2]):  # Test first 2 voices
                try:
                    engine.setProperty('voice', voice.id)
                    print(f"✓ Set voice to {voice.name}")
                    engine.say(f"Testing voice {voice.name}")
                    engine.runAndWait()
                except Exception as e:
                    print(f"✗ Error setting voice {voice.name}: {e}")
        
        return True
        
    except Exception as e:
        print(f"✗ Error in voice settings test: {e}")
        return False

def create_test_wav():
    """Create a test WAV file manually"""
    print("\n=== Creating Test WAV File ===")
    
    try:
        # Create a simple beep sound
        sample_rate = 22050
        duration = 1.0  # 1 second
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
        
        audio_data = buffer.getvalue()
        print(f"✓ Created test WAV: {len(audio_data)} bytes")
        
        # Save to file for testing
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
            temp_file.write(audio_data)
        
        print(f"✓ Saved test WAV to: {temp_path}")
        return temp_path, audio_data
        
    except Exception as e:
        print(f"✗ Error creating test WAV: {e}")
        return None, None

def main():
    """Run all tests"""
    print("pyttsx3 Test Suite")
    print("=" * 50)
    
    # Test basic functionality
    basic_ok = test_pyttsx3_basic()
    
    # Test speak functionality
    speak_ok = test_pyttsx3_speak()
    
    # Test save to file
    save_ok = test_pyttsx3_save_to_file()
    
    # Test voice settings
    voice_ok = test_pyttsx3_voice_settings()
    
    # Create test WAV
    test_wav_path, test_wav_data = create_test_wav()
    
    # Summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    print(f"Basic initialization: {'✓' if basic_ok else '✗'}")
    print(f"Speak functionality: {'✓' if speak_ok else '✗'}")
    print(f"Save to file: {'✓' if save_ok else '✗'}")
    print(f"Voice settings: {'✓' if voice_ok else '✗'}")
    print(f"Test WAV creation: {'✓' if test_wav_data else '✗'}")
    
    if test_wav_path:
        print(f"\nTest WAV file created at: {test_wav_path}")
        print("You can play this file to verify WAV generation works.")

if __name__ == "__main__":
    main() 