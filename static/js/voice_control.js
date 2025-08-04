class VoiceAgentControl {
    constructor() {
        this.websocket = null;
        this.activeAgent = null;
        this.agents = {};
        this.providers = [];
        this.languages = {};
        this.isConnected = false;
        
        // Voice recording properties
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
        this.recordingInterval = null;
        
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
        this.addMessage('agent', `Hello! I'm your ${languageName} voice agent using ${provider}. How can I help you today?`);
        
        // Start automatic voice recording
        await this.startAutomaticRecording();
    }
    
    endCall() {
        // Stop recording if active
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Clear recording interval
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
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
        this.voiceStatus.textContent = 'Starting voice conversation...';
        
        // Show provider info
        const sttProvider = this.activeAgent.provider === 'pyttsx3' ? 'Not available (TTS-only)' : this.activeAgent.provider;
        this.providerInfo.innerHTML = `
            <strong>TTS Provider:</strong> ${this.activeAgent.provider} | 
            <strong>STT Provider:</strong> ${sttProvider}
        `;
    }
    
    hideConversationPanel() {
        this.conversationPanel.style.display = 'none';
        this.audioControls.style.display = 'none';
        this.callStatus.style.display = 'none';
        this.voiceStatus.textContent = 'Click "Start Call" to begin voice conversation';
        this.voiceStatus.className = 'voice-status';
        this.providerInfo.innerHTML = '';
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
    
    async startAutomaticRecording() {
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
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.audioChunks = []; // Clear chunks for next recording
                await this.processVoiceInput(audioBlob);
                
                // Restart recording after processing (but only if still in active call)
                if (this.activeAgent && this.isConnected && !this.isRecording) {
                    setTimeout(() => {
                        if (this.activeAgent && this.isConnected) {
                            this.startRecording();
                        }
                    }, 2000); // Wait 2 seconds before restarting
                }
            };
            
            // Start initial recording
            this.startRecording();
            
            // Set up periodic recording (every 15 seconds) - only if not already recording
            this.recordingInterval = setInterval(() => {
                if (this.activeAgent && this.isConnected && !this.isRecording) {
                    this.startRecording();
                }
            }, 15000);
            
        } catch (error) {
            console.error('Error starting automatic recording:', error);
            this.showError('Failed to start voice recording. Please check microphone permissions.');
        }
    }
    
    startRecording() {
        if (this.mediaRecorder && !this.isRecording && this.activeAgent) {
            this.mediaRecorder.start();
            this.isRecording = true;
            this.voiceStatus.textContent = 'Listening... Speak now';
            this.voiceStatus.className = 'voice-status recording';
            
            // Stop recording after 5 seconds
            setTimeout(() => {
                if (this.isRecording && this.activeAgent) {
                    this.stopRecording();
                }
            }, 5000);
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.voiceStatus.textContent = 'Processing your voice...';
            this.voiceStatus.className = 'voice-status';
        }
    }
    
    async processVoiceInput(audioBlob) {
        try {
            // Check if call is still active
            if (!this.activeAgent) {
                console.log('Call ended, skipping voice processing');
                return;
            }
            
            // Check if audio blob has content
            if (audioBlob.size === 0) {
                console.log('Empty audio blob, skipping processing');
                if (this.activeAgent) {
                    this.voiceStatus.textContent = 'Listening for next input...';
                }
                return;
            }
            
            // Convert blob to base64
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            
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
                this.addMessage('user', transcribedText);
                
                // Send to agent via WebSocket
                if (this.isConnected && this.activeAgent) {
                    const data = {
                        text: transcribedText,
                        language: this.activeAgent.language,
                        provider: this.activeAgent.provider,
                        agent_type: 'customer_service'
                    };
                    this.websocket.send(JSON.stringify(data));
                }
                
                if (this.activeAgent) {
                    this.voiceStatus.textContent = 'Listening for next input...';
                }
            } else {
                this.showError('Failed to transcribe speech: ' + result.error);
                if (this.activeAgent) {
                    this.voiceStatus.textContent = 'Listening for next input...';
                }
            }
            
        } catch (error) {
            console.error('Error processing voice input:', error);
            this.showError('Failed to process voice input');
            if (this.activeAgent) {
                this.voiceStatus.textContent = 'Listening for next input...';
            }
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