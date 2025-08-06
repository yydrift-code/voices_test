class VoiceAgentControl {
    constructor() {
        this.websocket = null;
        this.activeAgent = null;
        this.agents = {};
        this.providers = [];
        this.languages = {};
        this.isConnected = false;
        this.isConnectionIntentionallyClosed = false; // Flag to track intentional connection closing
        
        // Voice recording properties for push-to-talk
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
        this.isButtonPressed = false; // Track if Say button is pressed
        this.lastProcessingTime = 0; // Prevent rapid successive processing
        
        this.initializeElements();
        this.loadData();
        this.setupEventListeners();
        // Don't check microphone permission immediately - only when call starts
    }
    
    initializeElements() {
        this.tableBody = document.getElementById('agentTableBody');
        this.conversationPanel = document.getElementById('conversationPanel');
        this.conversationBody = document.getElementById('conversationBody');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.audioControls = document.getElementById('audioControls');
        this.activeAgentInfo = document.getElementById('activeAgentInfo');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.connectionText = document.getElementById('connectionText');
        this.replayButton = document.getElementById('replayButton');
        
        // Voice recording elements
        this.voiceStatus = document.getElementById('voiceStatus');
        this.callStatus = document.getElementById('callStatus');
        this.providerInfo = document.getElementById('providerInfo');
        
        // Create push-to-talk button
        this.createPushToTalkButton();
    }
    
    createPushToTalkButton() {
        // Create the Say button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'push-to-talk-container';
        buttonContainer.style.cssText = `
            display: none;
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        `;
        
        // Create the Say button
        this.sayButton = document.createElement('button');
        this.sayButton.id = 'sayButton';
        this.sayButton.className = 'btn btn-lg btn-primary push-to-talk-btn';
        this.sayButton.innerHTML = '<i class="fas fa-microphone"></i> Say';
        this.sayButton.style.cssText = `
            width: 120px;
            height: 120px;
            border-radius: 50%;
            border: none;
            font-size: 18px;
            font-weight: bold;
            transition: all 0.2s ease;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        `;
        
        // Add button to container
        buttonContainer.appendChild(this.sayButton);
        
        // Add container to conversation panel
        if (this.conversationPanel) {
            this.conversationPanel.appendChild(buttonContainer);
        }
        
        this.buttonContainer = buttonContainer;
    }
    
    async checkMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Stop the test stream
            this.voiceStatus.textContent = 'Microphone access granted. Ready for voice conversation.';
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.voiceStatus.textContent = 'Microphone access denied. Please allow microphone access to use voice features.';
            this.voiceStatus.style.color = '#dc3545';
            return false;
        }
    }
    
    async loadData() {
        try {
            // Load providers and languages
            const providersResponse = await fetch('/api/providers');
            const providersData = await providersResponse.json();
            this.providers = providersData.providers;
            this.languages = providersData.languages;
            
            // Load agents
            const agentsResponse = await fetch('/api/agents');
            const agentsData = await agentsResponse.json();
            this.agents = agentsData.agents;
            
            this.renderTable();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data');
        }
    }
    
    renderTable() {
        this.tableBody.innerHTML = '';
        
        Object.entries(this.languages).forEach(([code, name]) => {
            const row = document.createElement('tr');
            
            // Language cell
            const languageCell = document.createElement('td');
            languageCell.className = 'language-cell';
            languageCell.textContent = name;
            row.appendChild(languageCell);
            
            // Provider cells
            this.providers.forEach(provider => {
                const cell = document.createElement('td');
                const button = this.createAgentButton(code, provider, name);
                cell.appendChild(button);
                row.appendChild(cell);
            });
            
            this.tableBody.appendChild(row);
        });
    }
    
    createAgentButton(languageCode, provider, languageName) {
        const button = document.createElement('button');
        button.className = 'agent-button inactive';
        button.textContent = 'Start Call';
        button.dataset.language = languageCode;
        button.dataset.provider = provider;
        button.dataset.languageName = languageName;
        
        button.addEventListener('click', (e) => {
            // Prevent click if button is disabled
            if (button.classList.contains('disabled')) {
                e.preventDefault();
                return;
            }
            this.toggleAgent(languageCode, provider, languageName);
        });
        
        return button;
    }
    
    toggleAgent(languageCode, provider, languageName) {
        const button = document.querySelector(`[data-language="${languageCode}"][data-provider="${provider}"]`);
        
        if (this.activeAgent && 
            this.activeAgent.language === languageCode && 
            this.activeAgent.provider === provider) {
            // End current call (same button clicked)
            this.endCall();
        } else {
            // End any existing call first
            if (this.activeAgent) {
                this.endCall();
            }
            
            // Start new call
            this.startCall(languageCode, provider, languageName);
        }
    }
    
    async startCall(languageCode, provider, languageName) {
        // Update button states - only disable non-active buttons
        this.disableAllButtons();
        
        const activeButton = document.querySelector(`[data-language="${languageCode}"][data-provider="${provider}"]`);
        if (activeButton) {
            activeButton.className = 'agent-button active';
            activeButton.textContent = 'End Call';
        }
        
        // Set active agent
        this.activeAgent = {
            language: languageCode,
            provider: provider,
            languageName: languageName
        };
        
        // Show conversation panel
        this.showConversationPanel();
        
        // Connect WebSocket
        this.connectWebSocket();
        
        // Add welcome message
        this.addMessage('agent', `Hello! I'm your RenovaVision AI Voice Solutions presale manager. I can help you explore our voice AI agents in ${languageName}. Press and hold the "Say" button to speak!`);
        
        // Check microphone permission and initialize microphone for push-to-talk
        const micPermission = await this.checkMicrophonePermission();
        if (micPermission) {
            await this.initializeMicrophone();
        } else {
            // If microphone permission denied, still allow text chat but disable voice
            this.voiceStatus.textContent = 'Voice features disabled. You can still chat via text.';
            this.voiceStatus.style.color = '#ffc107';
        }
    }
    
    endCall() {
        // Set flag to indicate intentional connection closing
        this.isConnectionIntentionallyClosed = true;
        
        // Stop recording if active
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Stop and cleanup media stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Reset recording state
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isButtonPressed = false;
        this.lastProcessingTime = 0;
        
        // Reset button states
        this.enableAllButtons();
        
        // Clear active agent
        this.activeAgent = null;
        
        // Hide conversation panel
        this.hideConversationPanel();
        
        // Disconnect WebSocket
        this.disconnectWebSocket();
        
        // Clear conversation
        this.conversationBody.innerHTML = '';
    }
    
    disableAllButtons() {
        const buttons = document.querySelectorAll('.agent-button');
        buttons.forEach(button => {
            if (!button.classList.contains('active')) {
                button.classList.add('disabled');
            }
        });
    }
    
    enableAllButtons() {
        const buttons = document.querySelectorAll('.agent-button');
        buttons.forEach(button => {
            button.classList.remove('disabled', 'active');
            button.textContent = 'Start Call';
        });
    }
    
    showConversationPanel() {
        this.conversationPanel.style.display = 'block';
        this.activeAgentInfo.textContent = `${this.activeAgent.languageName} - ${this.activeAgent.provider}`;
        this.callStatus.style.display = 'flex';
        this.voiceStatus.textContent = 'Initializing microphone...';
        
        // Show provider info
        const sttProvider = this.activeAgent.provider;
        this.providerInfo.innerHTML = `
            <strong>TTS Provider:</strong> ${this.activeAgent.provider} | 
            <strong>STT Provider:</strong> ${sttProvider}
        `;
        
        // Show timing metrics
        const timingMetrics = document.getElementById('timingMetrics');
        if (timingMetrics) {
            timingMetrics.style.display = 'block';
        }
        
        // Show push-to-talk button
        this.buttonContainer.style.display = 'block';
    }
    
    hideConversationPanel() {
        this.conversationPanel.style.display = 'none';
        this.audioControls.style.display = 'none';
        this.callStatus.style.display = 'none';
        this.voiceStatus.textContent = 'Click "Start Call" to begin voice conversation';
        this.voiceStatus.className = 'voice-status';
        this.providerInfo.innerHTML = '';
        
        // Hide timing metrics
        const timingMetrics = document.getElementById('timingMetrics');
        if (timingMetrics) {
            timingMetrics.style.display = 'none';
        }
        
        // Reset timing values
        document.getElementById('tts-timing').textContent = '-';
        document.getElementById('llm-timing').textContent = '-';
        document.getElementById('stt-timing').textContent = '-';
        
        // Hide push-to-talk button
        this.buttonContainer.style.display = 'none';
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        // Reset flag when starting a new connection
        this.isConnectionIntentionallyClosed = false;
        
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
        };
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.websocket.onclose = () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            // Only show error message if the connection wasn't intentionally closed
            if (!this.isConnectionIntentionallyClosed) {
                this.showError('Connection lost. Please refresh the page.');
            }
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
            this.showError('Connection error. Please try again.');
        };
    }
    
    disconnectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
    }
    
    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.className = 'status-indicator status-active';
            this.connectionText.textContent = 'Connected';
        } else {
            this.connectionStatus.className = 'status-indicator status-inactive';
            this.connectionText.textContent = 'Disconnected';
        }
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'agent_response':
            case 'agent_message':
                this.addMessage('agent', data.text);
                
                // Handle audio - prefer base64 if available, fallback to file
                if (data.audio_base64) {
                    this.playAudioBase64(data.audio_base64);
                } else if (data.audio_file) {
                    this.playAudio(data.audio_file);
                }
                
                // Update timing metrics if available
                if (data.timing_metrics) {
                    this.updateTimingMetrics(data.timing_metrics);
                }
                break;
            case 'error':
                this.showError(data.error);
                this.resetVoiceStatus();
                break;
            case 'system_message':
                this.addMessage('system', data.text);
                break;
        }
    }
    
    addMessage(type, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = text;
        
        this.conversationBody.appendChild(messageDiv);
        this.conversationBody.scrollTop = this.conversationBody.scrollHeight;
    }
    
    async playAudio(audioFile) {
        if (!audioFile) return;
        
        const audioUrl = `/api/audio/${audioFile}`;
        
        // Preload audio for faster playback
        this.audioPlayer.preload = 'auto';
        this.audioPlayer.src = audioUrl;
        this.audioControls.style.display = 'flex';
        
        // Show status while loading
        this.voiceStatus.textContent = 'Loading audio...';
        this.voiceStatus.className = 'voice-status processing';
        
        try {
            // Wait for audio to be ready
            await new Promise((resolve, reject) => {
                this.audioPlayer.oncanplaythrough = resolve;
                this.audioPlayer.onerror = reject;
                // Timeout after 5 seconds
                setTimeout(() => reject(new Error('Audio loading timeout')), 5000);
            });
            
            // Play audio
            await this.audioPlayer.play();
            
            // Update status
            this.voiceStatus.textContent = 'Press and hold the "Say" button to speak';
            this.voiceStatus.className = 'voice-status';
            
        } catch (error) {
            console.error('Error playing audio:', error);
            this.showError('Failed to play audio: ' + error.message);
            this.resetVoiceStatus();
        }
    }
    
    async playAudioBase64(audioBase64) {
        if (!audioBase64) return;
        
        try {
            // Convert base64 to blob
            const binaryString = atob(audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'audio/wav' });
            
            // Create object URL for faster playback
            const audioUrl = URL.createObjectURL(blob);
            
            // Set audio source
            this.audioPlayer.preload = 'auto';
            this.audioPlayer.src = audioUrl;
            this.audioControls.style.display = 'flex';
            
            // Show status while loading
            this.voiceStatus.textContent = 'Loading audio...';
            this.voiceStatus.className = 'voice-status processing';
            
            // Wait for audio to be ready
            await new Promise((resolve, reject) => {
                this.audioPlayer.oncanplaythrough = resolve;
                this.audioPlayer.onerror = reject;
                // Timeout after 3 seconds (faster for base64)
                setTimeout(() => reject(new Error('Audio loading timeout')), 3000);
            });
            
            // Play audio
            await this.audioPlayer.play();
            
            // Update status
            this.voiceStatus.textContent = 'Press and hold the "Say" button to speak';
            this.voiceStatus.className = 'voice-status';
            
            // Clean up object URL after a delay
            setTimeout(() => {
                URL.revokeObjectURL(audioUrl);
            }, 1000);
            
        } catch (error) {
            console.error('Error playing base64 audio:', error);
            this.showError('Failed to play audio: ' + error.message);
            this.resetVoiceStatus();
        }
    }
    
    stopAgentSpeech() {
        // Pause the audio player if it's currently playing
        if (this.audioPlayer && !this.audioPlayer.paused) {
            this.audioPlayer.pause();
            console.log('Agent speech stopped by user');
        }
    }
    
    async initializeMicrophone() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });
            
            // Try to use WAV format if supported, otherwise fall back to default
            const mimeType = MediaRecorder.isTypeSupported('audio/wav') 
                ? 'audio/wav' 
                : MediaRecorder.isTypeSupported('audio/webm') 
                    ? 'audio/webm' 
                    : 'audio/mp4';
            
            this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                // Prevent rapid successive processing calls
                const now = Date.now();
                if (now - this.lastProcessingTime < 100) {
                    console.log('Skipping rapid successive processing call');
                    return;
                }
                this.lastProcessingTime = now;
                
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.audioChunks = []; // Clear chunks for next recording
                
                // Process the recorded audio immediately
                this.processVoiceInput(audioBlob);
            };
            
        } catch (error) {
            console.error('Error initializing microphone:', error);
            this.showError('Failed to initialize microphone: ' + error.message + '. Please check microphone permissions.');
        }
    }
    
    startRecording() {
        if (this.mediaRecorder && !this.isRecording && this.activeAgent) {
            this.mediaRecorder.start();
            this.isRecording = true;
            this.voiceStatus.textContent = 'Listening... Release button to send';
            this.voiceStatus.className = 'voice-status recording';
            
            // Update button appearance
            this.sayButton.style.backgroundColor = '#dc3545';
            this.sayButton.style.transform = 'scale(0.95)';
            this.sayButton.innerHTML = '<i class="fas fa-microphone-slash"></i> Listening';
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.voiceStatus.textContent = 'Processing...';
            this.voiceStatus.className = 'voice-status processing';
            
            // Update button appearance
            this.sayButton.style.backgroundColor = '';
            this.sayButton.style.transform = '';
            this.sayButton.innerHTML = '<i class="fas fa-microphone"></i> Say';
        }
    }
    
    processVoiceInput(audioBlob) {
        // Check if call is still active
        if (!this.activeAgent) {
            console.log('Call ended, skipping voice processing');
            return;
        }
        
        // Check if audio blob has content
        if (audioBlob.size === 0) {
            console.log('Empty audio blob, skipping processing');
            if (this.activeAgent) {
                this.voiceStatus.textContent = 'Press and hold the "Say" button to speak';
            }
            return;
        }
        
        // Check minimum audio duration for OpenAI STT (minimum 0.1 seconds)
        // For a typical WAV file at 44.1kHz, 16-bit, mono: 0.1s ≈ 8,820 bytes
        const minSize = 10000; // Conservative minimum size for ~0.1s audio
        if (audioBlob.size < minSize) {
            console.log('Audio too short for OpenAI STT (minimum 0.1s), skipping processing');
            if (this.activeAgent) {
                this.voiceStatus.textContent = 'Press and hold the "Say" button to speak';
            }
            return;
        }
        
        // Process the audio asynchronously
        this.processAudioAsync(audioBlob);
    }
    
    async processAudioAsync(audioBlob) {
        try {
            // Show processing status immediately
            this.voiceStatus.textContent = 'Processing speech...';
            this.voiceStatus.className = 'voice-status processing';
            
            // Convert blob to base64
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Audio = this._arrayBufferToBase64(arrayBuffer);
            
            // Send to backend for speech-to-text processing
            const response = await fetch('/api/speech-to-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audio_data: base64Audio,
                    language: this.activeAgent.language,
                    provider: this.activeAgent.provider
                })
            });
            
            const result = await response.json();
            
            // Check again if call is still active after processing
            if (!this.activeAgent) {
                console.log('Call ended during processing, skipping response');
                return;
            }
            
            if (result.success) {
                const transcribedText = result.text;
                
                // Clean the transcribed text
                const cleanText = transcribedText ? transcribedText.trim() : '';
                
                // Check if speech was actually detected - only proceed if we have meaningful text
                const hasSpeech = cleanText.length > 1;
                
                if (hasSpeech) {
                    // Only add message and send to agent if speech was detected
                    this.addMessage('user', cleanText);
                    
                    // Update STT timing metric if available
                    if (result.stt_time) {
                        this.updateSTTTiming(result.stt_time);
                    }
                    
                    // Show agent is thinking
                    this.voiceStatus.textContent = 'Agent is thinking...';
                    this.voiceStatus.className = 'voice-status thinking';
                    
                    // Send to agent via WebSocket
                    if (this.isConnected && this.activeAgent) {
                        const data = {
                            text: cleanText,
                            language: this.activeAgent.language,
                            provider: this.activeAgent.provider,
                            agent_type: 'presale_manager'
                        };
                        this.websocket.send(JSON.stringify(data));
                        
                        // Set timeout for agent response
                        setTimeout(() => {
                            if (this.voiceStatus.textContent === 'Agent is thinking...') {
                                this.showError('Agent response timeout. Please try again.');
                                this.resetVoiceStatus();
                            }
                        }, 30000); // 30 second timeout
                    } else {
                        this.showError('Not connected to agent. Please try again.');
                        this.resetVoiceStatus();
                    }
                } else {
                    // No speech detected
                    console.log('No speech detected');
                    if (this.activeAgent) {
                        this.voiceStatus.textContent = 'Press and hold the "Say" button to speak';
                        this.voiceStatus.className = 'voice-status';
                    }
                }
            } else {
                this.showError('Failed to transcribe speech: ' + result.error);
                this.resetVoiceStatus();
            }
            
        } catch (error) {
            console.error('Error processing voice input:', error);
            this.showError('Failed to process voice input: ' + error.message);
            this.resetVoiceStatus();
        }
    }
    
    _arrayBufferToBase64(buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
    
    updateTimingMetrics(timingMetrics) {
        // Update TTS and LLM timing metrics
        if (timingMetrics.tts_time) {
            this.updateTTSTiming(timingMetrics.tts_time);
        }
        if (timingMetrics.llm_time) {
            this.updateLLMTiming(timingMetrics.llm_time);
        }
    }
    
    updateTTSTiming(ttsTime) {
        const ttsElement = document.getElementById('tts-timing');
        if (ttsElement) {
            ttsElement.textContent = `${ttsTime}ms`;
        }
    }
    
    updateLLMTiming(llmTime) {
        const llmElement = document.getElementById('llm-timing');
        if (llmElement) {
            llmElement.textContent = `${llmTime}ms`;
        }
    }
    
    updateSTTTiming(sttTime) {
        const sttElement = document.getElementById('stt-timing');
        if (sttElement) {
            sttElement.textContent = `${sttTime}ms`;
        }
    }
    
    resetTimingMetrics() {
        const ttsElement = document.getElementById('tts-timing');
        const llmElement = document.getElementById('llm-timing');
        const sttElement = document.getElementById('stt-timing');
        
        if (ttsElement) ttsElement.textContent = '-';
        if (llmElement) llmElement.textContent = '-';
        if (sttElement) sttElement.textContent = '-';
    }
    
    resetVoiceStatus() {
        if (this.activeAgent) {
            this.voiceStatus.textContent = 'Press and hold the "Say" button to speak';
            this.voiceStatus.className = 'voice-status';
        }
    }
    
    setupEventListeners() {
        // Audio controls
        this.replayButton.addEventListener('click', () => {
            this.audioPlayer.currentTime = 0;
            this.audioPlayer.play();
        });
        
        // Audio player events
        this.audioPlayer.addEventListener('ended', () => {
            // Auto-hide controls after playback
            setTimeout(() => {
                this.audioControls.style.display = 'none';
            }, 2000);
        });
        
        // Push-to-talk button events
        this.sayButton.addEventListener('mousedown', () => {
            if (this.activeAgent && this.isConnected) {
                this.isButtonPressed = true;
                // Stop agent's speech immediately when user starts speaking
                this.stopAgentSpeech();
                this.startRecording();
            }
        });
        
        this.sayButton.addEventListener('mouseup', () => {
            if (this.activeAgent && this.isConnected && this.isButtonPressed) {
                this.isButtonPressed = false;
                this.stopRecording();
            }
        });
        
        this.sayButton.addEventListener('mouseleave', () => {
            if (this.activeAgent && this.isConnected && this.isButtonPressed) {
                this.isButtonPressed = false;
                this.stopRecording();
            }
        });
        
        // Touch events for mobile devices
        this.sayButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.activeAgent && this.isConnected) {
                this.isButtonPressed = true;
                // Stop agent's speech immediately when user starts speaking
                this.stopAgentSpeech();
                this.startRecording();
            }
        });
        
        this.sayButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.activeAgent && this.isConnected && this.isButtonPressed) {
                this.isButtonPressed = false;
                this.stopRecording();
            }
        });
    }
    
    showError(message) {
        // Create a temporary error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger alert-dismissible fade show';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Error:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Add to body
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 8000);
    }
}

// Initialize the control panel when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.voiceAgentControl = new VoiceAgentControl();
});