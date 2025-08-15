class VoiceAgentControl {
    constructor() {
        this.websocket = null;
        this.activeAgent = null;
        this.agents = {};
        this.providers = [];
        this.languages = {};
        this.isConnected = false;
        this.isConnectionIntentionallyClosed = false;
        
        // Voice recording properties for push-to-talk
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
        this.isButtonPressed = false;
        this.lastProcessingTime = 0;
        this.currentSttTime = null;
        
        this.initializeElements();
        this.loadData();
        this.setupEventListeners();
    }
    
    initializeElements() {
        this.languageGrid = document.getElementById('languageGrid');
        this.callInterface = document.getElementById('callInterface');
        this.chatArea = document.getElementById('chatArea');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.callTitle = document.getElementById('callTitle');
        this.callSubtitle = document.getElementById('callSubtitle');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.pushToTalkBtn = document.getElementById('pushToTalkBtn');
        this.endCallBtn = document.getElementById('endCallBtn');
        this.replayBtn = document.getElementById('replayBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.timingMetrics = document.getElementById('timingMetrics');
        
        // Create push-to-talk button
        this.createPushToTalkButton();
    }
    
    createPushToTalkButton() {
        // The push-to-talk button is already in the HTML
        // Just set up the event listeners
        this.setupPushToTalkEvents();
    }
    
    setupPushToTalkEvents() {
        if (!this.pushToTalkBtn) return;
        
        this.pushToTalkBtn.addEventListener('mousedown', () => this.startRecording());
        this.pushToTalkBtn.addEventListener('mouseup', () => this.stopRecording());
        this.pushToTalkBtn.addEventListener('mouseleave', () => this.stopRecording());
        
        // Touch events for mobile
        this.pushToTalkBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording();
        });
        this.pushToTalkBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });
    }
    
    async checkMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            if (this.voiceStatus) {
                this.voiceStatus.textContent = 'Microphone access granted. Ready for voice conversation.';
            }
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            if (this.voiceStatus) {
                this.voiceStatus.textContent = 'Microphone access denied. Please allow microphone access to use voice features.';
                this.voiceStatus.style.color = '#ed4245';
            }
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
            
            this.renderLanguageCards();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data');
        }
    }
    
    renderLanguageCards() {
        if (!this.languageGrid) {
            console.error('Language grid element not found');
            return;
        }
        
        this.languageGrid.innerHTML = '';
        
        Object.entries(this.languages).forEach(([code, name]) => {
            const card = this.createLanguageCard(code, name);
            this.languageGrid.appendChild(card);
        });
    }
    
    createLanguageCard(languageCode, languageName) {
        const card = document.createElement('div');
        card.className = 'language-card';
        
        const flagEmoji = this.getLanguageFlag(languageCode);
        
        card.innerHTML = `
            <div class="language-header">
                <div class="language-flag">${flagEmoji}</div>
                <div class="language-info">
                    <h3>${languageName}</h3>
                    <p>AI Voice Agent</p>
                </div>
            </div>
            <div class="provider-buttons">
                ${this.providers.map(provider => `
                    <button class="provider-btn ${provider}" 
                            data-language="${languageCode}" 
                            data-provider="${provider}" 
                            data-language-name="${languageName}">
                        ${this.getProviderIcon(provider)} ${provider.toUpperCase()}
                    </button>
                `).join('')}
            </div>
        `;
        
        // Add event listeners to provider buttons
        const providerButtons = card.querySelectorAll('.provider-btn');
        providerButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const languageCode = button.dataset.language;
                const provider = button.dataset.provider;
                const languageName = button.dataset.languageName;
                this.toggleAgent(languageCode, provider, languageName);
            });
        });
        
        return card;
    }
    
    getLanguageFlag(languageCode) {
        const flags = {
            'en': '🇺🇸',
            'pl': '🇵🇱',
            'lt': '🇱🇹',
            'lv': '🇱🇻',
            'et': '🇪🇪'
        };
        return flags[languageCode] || '🌐';
    }
    
    getProviderIcon(provider) {
        const icons = {
            'openai': '<i class="fas fa-robot"></i>',
            'google': '<i class="fab fa-google"></i>'
        };
        return icons[provider] || '<i class="fas fa-microphone"></i>';
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
        // Update button states
        this.disableAllButtons();
        
        const activeButton = document.querySelector(`[data-language="${languageCode}"][data-provider="${provider}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
            activeButton.innerHTML = `${this.getProviderIcon(provider)} END CALL`;
        }
        
        // Set active agent
        this.activeAgent = {
            language: languageCode,
            provider: provider,
            languageName: languageName
        };
        
        // Clean audio player before starting new call
        this.cleanAudioPlayer();
        
        // Reset timing metrics
        this.resetTimingMetrics();
        this.currentSttTime = null;
        
        // Show call interface
        this.showCallInterface();
        
        // Connect WebSocket
        this.connectWebSocket();
        
        // Add welcome message
        this.addMessage('agent', `Hello! I'm your RenovaVision AI Voice Solutions presale manager. I can help you explore our voice AI agents in ${languageName}. Press and hold the "Say" button to speak!`);
        
        // Initialize microphone only when call is active
        await this.initializeMicrophone();
    }
    
    endCall() {
        // Reset button states
        this.enableAllButtons();
        
        // Clear active agent
        this.activeAgent = null;
        
        // Clean audio player
        this.cleanAudioPlayer();
        
        // Hide call interface
        this.hideCallInterface();
        
        // Disconnect WebSocket
        this.disconnectWebSocket();
        
        // Stop any ongoing recording
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Release microphone access
        this.releaseMicrophone();
        
        // Reset voice status
        this.resetVoiceStatus();
    }
    
    disableAllButtons() {
        const buttons = document.querySelectorAll('.provider-btn');
        buttons.forEach(button => {
            button.classList.remove('active');
            button.innerHTML = button.innerHTML.replace('END CALL', button.dataset.provider.toUpperCase());
        });
    }
    
    enableAllButtons() {
        const buttons = document.querySelectorAll('.provider-btn');
        buttons.forEach(button => {
            button.classList.remove('active');
            button.innerHTML = `${this.getProviderIcon(button.dataset.provider)} ${button.dataset.provider.toUpperCase()}`;
        });
    }
    
    showCallInterface() {
        this.callInterface.style.display = 'block';
        this.languageGrid.style.display = 'none';
        
        // Update call header
        this.callTitle.textContent = `${this.activeAgent.languageName} Voice Call`;
        this.callSubtitle.textContent = `Connected via ${this.activeAgent.provider.toUpperCase()}`;
        
        // Show audio controls and timing metrics
        this.showAudioControls();
        this.showTimingMetrics();
    }
    
    hideCallInterface() {
        this.callInterface.style.display = 'none';
        this.languageGrid.style.display = 'grid';
        
        // Clear chat area
        this.chatArea.innerHTML = '';
        
        // Hide audio controls and timing metrics
        this.hideAudioControls();
        this.hideTimingMetrics();
    }
    
    connectWebSocket() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            return;
        }
        
        // Use secure WebSocket for HTTPS and handle both local and production
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.websocket = new WebSocket(`${protocol}//${window.location.host}/ws`);
        
        this.websocket.onopen = () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
            console.log('WebSocket connected');
        };
        
        this.websocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.websocket.onclose = (event) => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            console.log('WebSocket disconnected', event.code, event.reason);
            
            // Don't auto-reconnect if intentionally closed
            if (this.isConnectionIntentionallyClosed) {
                this.isConnectionIntentionallyClosed = false;
                return;
            }
            
            // Auto-reconnect after delay for unexpected disconnections
            setTimeout(() => {
                if (!this.isConnected && this.activeAgent) {
                    console.log('Attempting to reconnect WebSocket...');
                    this.connectWebSocket();
                }
            }, 2000);
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.showError('Connection error');
        };
    }
    
    disconnectWebSocket() {
        if (this.websocket) {
            this.isConnectionIntentionallyClosed = true;
            this.websocket.close();
            this.websocket = null;
        }
    }
    
    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.style.display = 'none';
        } else {
            this.connectionStatus.style.display = 'block';
        }
    }
    
    handleWebSocketMessage(data) {
        console.log('Received WebSocket message:', data);
        
        if (data.type === 'agent_message') {
            this.addMessage('agent', data.text);
            if (data.audio_data) {
                console.log('Playing audio data, length:', data.audio_data.length);
                this.playAudioBase64(data.audio_data);
            } else {
                console.log('No audio data in message');
            }
            
            // Update timing metrics if available
            if (data.timing_metrics) {
                this.updateTimingMetrics(data.timing_metrics);
            }
        } else if (data.type === 'system_message') {
            this.addMessage('system', data.text);
        } else if (data.type === 'error') {
            this.showError(data.message);
        } else {
            console.log('Unknown message type:', data.type);
        }
    }
    
    addMessage(type, text) {
        if (!this.chatArea) {
            console.error('Chat area element not found');
            return;
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = text;
        this.chatArea.appendChild(messageDiv);
        this.chatArea.scrollTop = this.chatArea.scrollHeight;
    }
    
    async playAudio(audioFile) {
        try {
            this.audioPlayer.src = audioFile;
            await this.audioPlayer.play();
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    }
    
    async playAudioBase64(audioBase64) {
        try {
            const audioBlob = this.base64ToBlob(audioBase64, 'audio/wav');
            const audioUrl = URL.createObjectURL(audioBlob);
            await this.playAudio(audioUrl);
        } catch (error) {
            console.error('Error playing base64 audio:', error);
        }
    }
    
    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }
    
    stopAgentSpeech() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
        }
    }
    
    async initializeMicrophone() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.processVoiceInput(audioBlob);
                this.audioChunks = [];
            };
            
            if (this.voiceStatus) {
                this.voiceStatus.textContent = 'Microphone ready. Press and hold to speak.';
                this.voiceStatus.style.color = '#57f287';
            }
            
        } catch (error) {
            console.error('Error initializing microphone:', error);
            if (this.voiceStatus) {
                this.voiceStatus.textContent = 'Failed to initialize microphone.';
                this.voiceStatus.style.color = '#ed4245';
            }
        }
    }
    
    releaseMicrophone() {
        // Stop any ongoing recording
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        // Stop all tracks in the stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Reset recording state
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isButtonPressed = false;
        
        console.log('Microphone access released');
    }
    
    showAudioControls() {
        const audioControls = document.querySelector('.audio-controls');
        if (audioControls) {
            audioControls.style.display = 'flex';
        }
    }
    
    showTimingMetrics() {
        if (this.timingMetrics) {
            this.timingMetrics.style.display = 'block';
        }
    }
    
    hideTimingMetrics() {
        if (this.timingMetrics) {
            this.timingMetrics.style.display = 'none';
        }
    }
    
    updateTimingMetrics(timingMetrics) {
        if (!this.timingMetrics) return;
        
        if (timingMetrics.tts_time) {
            document.getElementById('tts-timing').textContent = `${timingMetrics.tts_time}ms`;
        }
        if (timingMetrics.llm_time) {
            document.getElementById('llm-timing').textContent = `${timingMetrics.llm_time}ms`;
        }
        if (timingMetrics.stt_time) {
            document.getElementById('stt-timing').textContent = `${timingMetrics.stt_time}ms`;
        }
    }
    
    resetTimingMetrics() {
        if (!this.timingMetrics) return;
        
        document.getElementById('tts-timing').textContent = '-';
        document.getElementById('llm-timing').textContent = '-';
        document.getElementById('stt-timing').textContent = '-';
    }
    
    hideAudioControls() {
        // Stop any playing audio and clear the source
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
            this.audioPlayer.src = ''; // Clear the audio source
            this.audioPlayer.load(); // Reset the audio element
        }
        
        // Hide the entire audio controls container
        const audioControls = document.querySelector('.audio-controls');
        if (audioControls) {
            audioControls.style.display = 'none';
        }
    }
    
    cleanAudioPlayer() {
        if (this.audioPlayer) {
            // Stop any playing audio
            this.audioPlayer.pause();
            // Reset to beginning
            this.audioPlayer.currentTime = 0;
            // Clear the audio source completely
            this.audioPlayer.src = '';
            // Reset the audio element
            this.audioPlayer.load();
            // Remove any object URLs to prevent memory leaks
            if (this.audioPlayer.src && this.audioPlayer.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.audioPlayer.src);
            }
        }
        console.log('Audio player cleaned');
    }
    
    startRecording() {
        if (!this.mediaRecorder || this.isRecording) return;
        
        const now = Date.now();
        if (now - this.lastProcessingTime < 1000) return; // Prevent rapid successive recordings
        
        this.isRecording = true;
        this.isButtonPressed = true;
        if (this.pushToTalkBtn) {
            this.pushToTalkBtn.classList.add('recording');
            this.pushToTalkBtn.innerHTML = '<i class="fas fa-stop"></i>';
        }
        if (this.voiceStatus) {
            this.voiceStatus.textContent = 'Recording... Release to send.';
            this.voiceStatus.style.color = '#ed4245';
        }
        
        this.mediaRecorder.start();
    }
    
    stopRecording() {
        if (!this.mediaRecorder || !this.isRecording) return;
        
        this.isRecording = false;
        this.isButtonPressed = false;
        if (this.pushToTalkBtn) {
            this.pushToTalkBtn.classList.remove('recording');
            this.pushToTalkBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
        if (this.voiceStatus) {
            this.voiceStatus.textContent = 'Processing...';
            this.voiceStatus.style.color = '#faa61a';
        }
        
        this.mediaRecorder.stop();
        this.lastProcessingTime = Date.now();
    }
    
    async processVoiceInput(audioBlob) {
        try {
            const base64Audio = await this.blobToBase64(audioBlob);
            
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
            
            const data = await response.json();
            
            if (data.success && data.text) {
                this.addMessage('user', data.text);
                
                // Store STT timing for later use
                if (data.stt_time) {
                    this.currentSttTime = data.stt_time;
                    // Update STT timing immediately
                    document.getElementById('stt-timing').textContent = `${data.stt_time}ms`;
                }
                
                // Send to WebSocket for processing
                if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                    this.websocket.send(JSON.stringify({
                        text: data.text,
                        language: this.activeAgent.language,
                        provider: this.activeAgent.provider,
                        agent_type: 'presale_manager'
                    }));
                }
                
                if (this.voiceStatus) {
                    this.voiceStatus.textContent = 'Message sent. Waiting for response...';
                    this.voiceStatus.style.color = '#faa61a';
                }
            } else {
                if (this.voiceStatus) {
                    this.voiceStatus.textContent = 'Failed to transcribe audio.';
                    this.voiceStatus.style.color = '#ed4245';
                }
            }
        } catch (error) {
            console.error('Error processing voice input:', error);
            if (this.voiceStatus) {
                this.voiceStatus.textContent = 'Error processing voice input.';
                this.voiceStatus.style.color = '#ed4245';
            }
        }
    }
    
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    
    resetVoiceStatus() {
        if (this.voiceStatus) {
            this.voiceStatus.textContent = 'Click "Start Call" to begin voice conversation';
            this.voiceStatus.style.color = '#b9bbbe';
        }
    }
    
    setupEventListeners() {
        // End call button
        if (this.endCallBtn) {
            this.endCallBtn.addEventListener('click', () => {
                this.endCall();
            });
        }
        

        
        // Replay button
        if (this.replayBtn) {
            this.replayBtn.addEventListener('click', () => {
                if (this.audioPlayer.src) {
                    this.audioPlayer.currentTime = 0;
                    this.audioPlayer.play();
                }
            });
        }
        
        // Stop button
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => {
                this.stopAgentSpeech();
            });
        }
        
        // Audio player ended
        if (this.audioPlayer) {
            this.audioPlayer.addEventListener('ended', () => {
                if (this.voiceStatus) {
                    this.voiceStatus.textContent = 'Ready for next message';
                    this.voiceStatus.style.color = '#57f287';
                }
            });
        }
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        if (this.chatArea) {
            this.chatArea.appendChild(errorDiv);
            
            setTimeout(() => {
                errorDiv.remove();
            }, 5000);
        } else {
            // Fallback: show error in console and as alert
            console.error('Error:', message);
            alert('Error: ' + message);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VoiceAgentControl();
});