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
        this.processingQueue = []; // Queue for processing multiple audio inputs
        this.isProcessing = false; // Flag to track if we're currently processing
        this.silenceTimer = null; // Timer for detecting silence
        this.lastAudioLevel = 0; // Track audio levels for silence detection
        this.audioContext = null; // For audio analysis
        this.analyser = null; // For audio analysis
        this.microphone = null; // For audio analysis
        
        // Audio playback properties
        this.audioQueue = []; // Queue for audio playback
        this.isPlayingAudio = false; // Flag to track if audio is currently playing
        this.lastAudioPlayTime = 0; // Track when audio was last played
        
        // Response throttling
        this.lastResponseTime = 0; // Track when last response was sent
        this.responseThrottleMs = 3000; // Minimum time between responses (3 seconds)
        this.isAgentResponding = false; // Flag to prevent multiple simultaneous responses
        
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
        this.addMessage('agent', `Hello! I'm your RenovaVision AI Voice Solutions presale manager. I can help you explore our voice AI agents in ${languageName}. How can I assist you today?`);
        
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
        this.processingQueue = [];
        this.isProcessing = false;
        
        // Reset audio playback state
        this.audioQueue = [];
        this.isPlayingAudio = false;
        
        // Reset response throttling
        this.lastResponseTime = 0;
        this.isAgentResponding = false;
        this.lastAudioPlayTime = 0;
        
        // Clean up audio analysis
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.analyser = null;
        this.microphone = null;
        
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
        this.voiceStatus.textContent = 'Starting continuous voice conversation...';
        
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
                this.isAgentResponding = true;
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
        
        // Limit queue size to prevent memory issues
        if (this.audioQueue.length >= 10) {
            console.log('Audio queue full, skipping:', audioFile);
            return;
        }
        
        console.log('Adding audio to queue:', audioFile);
        // Add to audio queue
        this.audioQueue.push(audioFile);
        
        // If not currently playing, start playing
        if (!this.isPlayingAudio) {
            this.processAudioQueue();
        }
    }
    
    async processAudioQueue() {
        if (this.audioQueue.length === 0 || this.isPlayingAudio) {
            return;
        }
        
        this.isPlayingAudio = true;
        const audioFile = this.audioQueue.shift();
        console.log('Processing audio from queue:', audioFile, 'Queue length:', this.audioQueue.length);
        
        const audioUrl = `/api/audio/${audioFile}`;
        this.audioPlayer.src = audioUrl;
        this.audioControls.style.display = 'flex';
        
        try {
            // Pause recording while agent is speaking to prevent feedback
            if (this.isRecording) {
                this.stopRecording();
            }
            
            await this.audioPlayer.play();
        } catch (error) {
            console.error('Error playing audio:', error);
            this.isPlayingAudio = false;
            // Try to play next audio in queue
            this.processAudioQueue();
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
            
            // Set up audio analysis for silence detection
            this.setupAudioAnalysis();
            
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
                
                        // Only add to processing queue if blob has content and call is active
        // AND we haven't recently played audio (to prevent agent hearing itself)
        const timeSinceLastAudio = Date.now() - (this.lastAudioPlayTime || 0);
        const recentlyPlayedAudio = timeSinceLastAudio < 4000; // 4 seconds after audio played
        
        if (audioBlob.size > 0 && this.activeAgent && this.isConnected && 
            !this.isAgentResponding && !this.isPlayingAudio && !this.isProcessing && 
            !recentlyPlayedAudio) {
            this.processingQueue.push(audioBlob);
            this.processQueue();
        } else if (recentlyPlayedAudio) {
            console.log('Blocking audio processing - too soon after agent spoke');
        }
                
                // Immediately start the next recording session
                if (this.activeAgent && this.isConnected) {
                    this.startRecording();
                }
            };
            
            // Start initial recording
            this.startRecording();
            
            // Set up continuous recording - restart immediately when recording stops
            this.recordingInterval = setInterval(() => {
                if (this.activeAgent && this.isConnected && !this.isRecording) {
                    this.startRecording();
                }
            }, 100); // Check every 100ms for continuous recording
            
        } catch (error) {
            console.error('Error starting automatic recording:', error);
            this.showError('Failed to start voice recording. Please check microphone permissions.');
        }
    }
    
    setupAudioAnalysis() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            this.microphone.connect(this.analyser);
        } catch (error) {
            console.warn('Audio analysis not supported, falling back to timer-based recording');
        }
    }
    
    startRecording() {
        if (this.mediaRecorder && !this.isRecording && this.activeAgent) {
            this.mediaRecorder.start();
            this.isRecording = true;
            this.voiceStatus.textContent = 'Listening continuously... Speak anytime';
            this.voiceStatus.className = 'voice-status recording';
            
            // Start silence detection
            this.startSilenceDetection();
            
            // Fallback: stop recording after 10 seconds maximum
            setTimeout(() => {
                if (this.isRecording && this.activeAgent) {
                    this.stopRecording();
                }
            }, 10000);
        }
    }
    
    startSilenceDetection() {
        if (!this.analyser) {
            return; // Fall back to timer-based recording
        }
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        const checkAudioLevel = () => {
            if (!this.isRecording || !this.activeAgent) {
                return;
            }
            
            this.analyser.getByteFrequencyData(dataArray);
            
            // Calculate average audio level
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const averageLevel = sum / dataArray.length;
            
            // Update last audio level
            this.lastAudioLevel = averageLevel;
            
            // Check if audio level is above threshold (speech detected)
            if (averageLevel > 10) { // Adjust threshold as needed
                // Reset silence timer
                if (this.silenceTimer) {
                    clearTimeout(this.silenceTimer);
                }
                this.silenceTimer = setTimeout(() => {
                    if (this.isRecording && this.activeAgent) {
                        console.log('Silence detected, stopping recording');
                        this.stopRecording();
                    }
                }, 1500); // Wait 1.5 seconds of silence before stopping
            }
            
            // Continue monitoring
            if (this.isRecording) {
                requestAnimationFrame(checkAudioLevel);
            }
        };
        
        checkAudioLevel();
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            // Clear silence timer
            if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
            }
            
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.voiceStatus.textContent = 'Listening continuously... Speak anytime';
            this.voiceStatus.className = 'voice-status';
        }
    }
    
    async processQueue() {
        // If already processing or no items in queue, return
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        // Add timeout to prevent infinite processing
        const processingTimeout = setTimeout(() => {
            console.log('Processing timeout, resetting processing flag');
            this.isProcessing = false;
        }, 10000); // 10 second timeout
        
        try {
            // Process up to 5 items at a time to prevent infinite loops
            let processedCount = 0;
            const maxProcessPerCycle = 5;
            
            while (this.processingQueue.length > 0 && processedCount < maxProcessPerCycle) {
                const audioBlob = this.processingQueue.shift();
                if (audioBlob && audioBlob.size > 0) {
                    await this.processVoiceInput(audioBlob);
                    processedCount++;
                }
            }
        } finally {
            clearTimeout(processingTimeout);
            this.isProcessing = false;
            
            // If there are still items in queue, process them in the next cycle
            if (this.processingQueue.length > 0) {
                setTimeout(() => this.processQueue(), 100);
            }
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
                    this.voiceStatus.textContent = 'Listening continuously... Speak anytime';
                }
                return;
            }
            
            // Convert blob to base64 with size limit
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Check if audio is too large (limit to 1MB)
            if (arrayBuffer.byteLength > 1024 * 1024) {
                console.log('Audio blob too large, skipping processing');
                return;
            }
            
            // Convert to base64 safely
            let base64Audio;
            try {
                const uint8Array = new Uint8Array(arrayBuffer);
                // Use a more robust method for large arrays
                const chunks = [];
                const chunkSize = 8192; // Process in 8KB chunks
                
                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                    const chunk = uint8Array.slice(i, i + chunkSize);
                    chunks.push(String.fromCharCode(...chunk));
                }
                
                base64Audio = btoa(chunks.join(''));
            } catch (error) {
                console.log('Error converting audio to base64, skipping processing:', error.message);
                return;
            }
            
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
            const hasSpeech = cleanText.length > 2; // Reduced minimum length to allow short phrases
            
            // Only filter out actual noise, not legitimate speech
            const noiseWords = ['um', 'uh', 'ah', 'oh', 'hmm', 'mm', 'mhm'];
            const isOnlyNoise = noiseWords.some(noise => cleanText.toLowerCase().trim() === noise);
            
            if (isOnlyNoise) {
                console.log('Filtered out noise word:', cleanText);
                return;
            }
                
                if (hasSpeech) {
                    // Only add message and send to agent if speech was detected AND agent is not responding
                    // Also check if we've recently received a response to prevent feedback loops
                    const timeSinceLastResponse = Date.now() - this.lastResponseTime;
                    const recentlyResponded = timeSinceLastResponse < 5000; // 5 seconds
                    const timeSinceLastAudio = Date.now() - (this.lastAudioPlayTime || 0);
                    const recentlyPlayedAudio = timeSinceLastAudio < 4000; // 4 seconds
                    
                    if (!this.isAgentResponding && !this.isPlayingAudio && !recentlyResponded && !recentlyPlayedAudio) {
                        this.addMessage('user', cleanText);
                        
                        // Send to agent via WebSocket with throttling
                        if (this.isConnected && this.activeAgent) {
                            const now = Date.now();
                            const timeSinceLastResponse = now - this.lastResponseTime;
                            
                            if (timeSinceLastResponse >= this.responseThrottleMs) {
                                const data = {
                                    text: cleanText,
                                    language: this.activeAgent.language,
                                    provider: this.activeAgent.provider,
                                    agent_type: 'presale_manager'
                                };
                                this.websocket.send(JSON.stringify(data));
                                this.lastResponseTime = now;
                                console.log('Sending message to agent (throttled)');
                            } else {
                                console.log('Throttling response - too soon since last response');
                            }
                        }
                    } else {
                        console.log('Ignoring speech - agent is currently responding or playing audio');
                        if (recentlyPlayedAudio) {
                            console.log('Blocked due to recent audio playback');
                        }
                        if (recentlyResponded) {
                            console.log('Blocked due to recent response');
                        }
                    }
                } else {
                    // No speech detected, just continue listening
                    console.log('No speech detected, continuing to listen...');
                }
                
                if (this.activeAgent) {
                    this.voiceStatus.textContent = 'Listening continuously... Speak anytime';
                }
            } else {
                this.showError('Failed to transcribe speech: ' + result.error);
                if (this.activeAgent) {
                    this.voiceStatus.textContent = 'Listening continuously... Speak anytime';
                }
            }
            
        } catch (error) {
            console.error('Error processing voice input:', error);
            this.showError('Failed to process voice input');
            if (this.activeAgent) {
                this.voiceStatus.textContent = 'Listening continuously... Speak anytime';
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
        this.audioPlayer.addEventListener('play', () => {
            // Pause recording when agent starts speaking
            if (this.isRecording) {
                this.stopRecording();
            }
            // Update status to show agent is speaking
            this.voiceStatus.textContent = 'Agent is speaking... Please wait';
            // Track when audio started playing
            this.lastAudioPlayTime = Date.now();
            // Set agent as responding to prevent new messages
            this.isAgentResponding = true;
            
            // Temporarily disable WebSocket to prevent any new messages
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                console.log('Temporarily disabling WebSocket during agent speech');
                this.websocket.close();
            }
        });
        
        this.audioPlayer.addEventListener('ended', () => {
            this.isPlayingAudio = false;
            this.isAgentResponding = false;
            
            // Reconnect WebSocket after agent finishes speaking
            setTimeout(() => {
                if (this.activeAgent && this.isConnected && !this.websocket) {
                    console.log('Reconnecting WebSocket after agent speech');
                    this.connectWebSocket();
                }
            }, 2000); // Wait 2 seconds before reconnecting
            
            // Resume recording when agent finishes speaking
            if (this.activeAgent && this.isConnected && !this.isRecording) {
                setTimeout(() => {
                    this.startRecording();
                    this.voiceStatus.textContent = 'Listening continuously... Speak anytime';
                }, 1000); // Reduced delay to ensure audio has completely finished
            }
            
            // Auto-hide controls after playback
            setTimeout(() => {
                this.audioControls.style.display = 'none';
            }, 2000);
            
            // Process next audio in queue
            this.processAudioQueue();
        });
        
        this.audioPlayer.addEventListener('pause', () => {
            this.isPlayingAudio = false;
            
            // Resume recording if audio is paused
            if (this.activeAgent && this.isConnected && !this.isRecording) {
                this.startRecording();
                this.voiceStatus.textContent = 'Listening continuously... Speak anytime';
            }
            
            // Process next audio in queue
            this.processAudioQueue();
        });
        
        this.audioPlayer.addEventListener('error', () => {
            this.isPlayingAudio = false;
            
            // Resume recording if audio playback fails
            if (this.activeAgent && this.isConnected && !this.isRecording) {
                this.startRecording();
                this.voiceStatus.textContent = 'Listening continuously... Speak anytime';
            }
            
            // Process next audio in queue
            this.processAudioQueue();
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