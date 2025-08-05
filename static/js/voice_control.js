class VoiceAgentControl {
    constructor() {
        this.websocket = null;
        this.activeAgent = null;
        this.agents = {};
        this.providers = [];
        this.languages = {};
        this.isConnected = false;
        
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
        this.checkMicrophonePermission();
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
            this.voiceStatus.textContent = 'Microphone access granted. Click "Start Call" to begin voice conversation.';
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.voiceStatus.textContent = 'Microphone access denied. Please allow microphone access to use voice features.';
            this.voiceStatus.style.color = '#dc3545';
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
        
        // Initialize microphone for push-to-talk
        await this.initializeMicrophone();
    }
    
    endCall() {
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
        this.voiceStatus.textContent = 'Press and hold the "Say" button to speak';
        
        // Show provider info
        const sttProvider = this.activeAgent.provider === 'pyttsx3' ? 'Not available (TTS-only)' : this.activeAgent.provider;
        this.providerInfo.innerHTML = `
            <strong>TTS Provider:</strong> ${this.activeAgent.provider} | 
            <strong>STT Provider:</strong> ${sttProvider}
        `;
        
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
        
        // Hide push-to-talk button
        this.buttonContainer.style.display = 'none';
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
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
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
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
                this.addMessage('agent', data.text);
                this.playAudio(data.audio_file);
                break;
            case 'error':
                this.showError(data.error);
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
        this.audioPlayer.src = audioUrl;
        this.audioControls.style.display = 'flex';
        
        try {
            await this.audioPlayer.play();
        } catch (error) {
            console.error('Error playing audio:', error);
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
            this.showError('Failed to initialize microphone. Please check microphone permissions.');
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
                    
                    // Send to agent via WebSocket
                    if (this.isConnected && this.activeAgent) {
                        const data = {
                            text: cleanText,
                            language: this.activeAgent.language,
                            provider: this.activeAgent.provider,
                            agent_type: 'presale_manager'
                        };
                        this.websocket.send(JSON.stringify(data));
                    }
                } else {
                    // No speech detected
                    console.log('No speech detected');
                }
                
                if (this.activeAgent) {
                    this.voiceStatus.textContent = 'Press and hold the "Say" button to speak';
                    this.voiceStatus.className = 'voice-status';
                }
            } else {
                this.showError('Failed to transcribe speech: ' + result.error);
                if (this.activeAgent) {
                    this.voiceStatus.textContent = 'Press and hold the "Say" button to speak';
                    this.voiceStatus.className = 'voice-status';
                }
            }
            
        } catch (error) {
            console.error('Error processing voice input:', error);
            this.showError('Failed to process voice input');
            if (this.activeAgent) {
                this.voiceStatus.textContent = 'Press and hold the "Say" button to speak';
                this.voiceStatus.className = 'voice-status';
            }
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
        errorDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insert at the top of the page
        const container = document.querySelector('.container-fluid');
        container.insertBefore(errorDiv, container.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Initialize the control panel when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VoiceAgentControl();
});