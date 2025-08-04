#!/usr/bin/env python3
"""
Debug script to analyze pyttsx3 output file format
"""

import pyttsx3
import tempfile
import os
import wave
import struct

def analyze_pyttsx3_file():
    """Analyze the file format created by pyttsx3"""
    print("=== Analyzing pyttsx3 File Format ===")
    
    try:
        # Create a fresh engine
        engine = pyttsx3.init()
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
        
        print(f"Using temporary file: {temp_path}")
        
        # Generate audio
        text = "Hello, this is a test of pyttsx3 file format."
        engine.save_to_file(text, temp_path)
        engine.runAndWait()
        
        # Check if file was created
        if os.path.exists(temp_path):
            file_size = os.path.getsize(temp_path)
            print(f"✓ File created: {temp_path}")
            print(f"✓ File size: {file_size} bytes")
            
            # Read the file
            with open(temp_path, 'rb') as f:
                content = f.read()
            
            print(f"✓ File read: {len(content)} bytes")
            
            # Analyze the first 100 bytes
            print("\nFirst 100 bytes (hex):")
            hex_content = content[:100].hex()
            for i in range(0, len(hex_content), 32):
                print(hex_content[i:i+32])
            
            # Check for common audio formats
            print("\nFormat analysis:")
            
            if content.startswith(b'RIFF'):
                print("✓ Appears to be WAV format")
            elif content.startswith(b'ID3') or content.startswith(b'\xff\xfb'):
                print("✓ Appears to be MP3 format")
            elif content.startswith(b'OggS'):
                print("✓ Appears to be OGG format")
            elif content.startswith(b'fLaC'):
                print("✓ Appears to be FLAC format")
            elif content.startswith(b'CAF '):
                print("✓ Appears to be CAF format (Core Audio)")
            else:
                print("✗ Unknown format")
                print(f"First 8 bytes: {content[:8]}")
            
            # Try to read as different formats
            print("\nTrying to read as different formats:")
            
            # Try WAV
            try:
                with wave.open(temp_path, 'rb') as wav_file:
                    print(f"✓ WAV: {wav_file.getnchannels()} channels, {wav_file.getframerate()} Hz, {wav_file.getsampwidth()} bytes/sample")
            except Exception as e:
                print(f"✗ Not a valid WAV file: {e}")
            
            # Try to convert using pydub
            try:
                from pydub import AudioSegment
                audio = AudioSegment.from_file(temp_path)
                print(f"✓ Pydub can read it: {len(audio)}ms, {audio.channels} channels, {audio.frame_rate} Hz")
                
                # Try to export as WAV
                wav_buffer = io.BytesIO()
                audio.export(wav_buffer, format="wav")
                wav_data = wav_buffer.getvalue()
                print(f"✓ Converted to WAV: {len(wav_data)} bytes")
                
                if wav_data.startswith(b'RIFF'):
                    print("✓ Converted WAV is valid!")
                    return wav_data
                else:
                    print("✗ Converted WAV is still invalid")
                    
            except Exception as e:
                print(f"✗ Pydub can't read it: {e}")
            
            # Clean up
            os.unlink(temp_path)
            print(f"✓ Temporary file cleaned up")
            
        else:
            print("✗ File was not created")
        
        return None
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return None

if __name__ == "__main__":
    import io
    result = analyze_pyttsx3_file()
    
    if result:
        print(f"\n✓ Successfully converted pyttsx3 output to valid WAV: {len(result)} bytes")
    else:
        print(f"\n✗ Could not convert pyttsx3 output to valid WAV") 