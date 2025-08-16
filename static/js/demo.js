// Demo Page JavaScript
class TTSDemo {
    constructor() {
        this.ws = null;
        this.audioPlayer = null;
        this.currentAudio = null;
        this.isConnected = false;
        
        this.initializeElements();
        this.bindEvents();
        this.connectWebSocket();
    }
    
    initializeElements() {
        this.chatMessages = document.getElementById('chat-messages');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.languageSelect = document.getElementById('language-select');
        this.providerSelect = document.getElementById('provider-select');
        this.compareProvidersButton = document.getElementById('compare-providers');
        this.comparisonText = document.getElementById('comparison-text');
        this.generateComparisonButton = document.getElementById('generate-comparison');
        this.comparisonResults = document.getElementById('comparison-results');
        this.comparisonContent = document.getElementById('comparison-content');
        this.audioPlayer = document.getElementById('audio-player');
    }
    
    bindEvents() {
        // Send message
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Compare providers
        this.compareProvidersButton.addEventListener('click', () => this.compareProviders());
        this.generateComparisonButton.addEventListener('click', () => this.generateComparison());
        
        // Audio player events
        this.audioPlayer.addEventListener('ended', () => this.onAudioEnded());
    }
    
    connectWebSocket() {
        // Force secure WebSocket for HTTPS and handle both local and production
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'voice-test.renovavision.tech';
        const protocol = isSecure ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        console.log('WebSocket URL:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.addSystemMessage('Connected to RenovaVision AI Agent');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleAgentMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.addSystemMessage('Disconnected from AI Agent');
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.addSystemMessage('Connection error');
        };
    }
    
    sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || !this.isConnected) return;
        
        const language = this.languageSelect.value;
        const provider = this.providerSelect.value;
        
        // Add user message to chat
        this.addUserMessage(text);
        
        // Send to WebSocket
        this.ws.send(JSON.stringify({
            text: text,
            language: language,
            provider: provider
        }));
        
        // Clear input
        this.messageInput.value = '';
        
        // Show typing indicator
        this.showTypingIndicator();
    }
    
    handleAgentMessage(data) {
        this.hideTypingIndicator();
        
        if (data.type === 'agent_message') {
            this.addAgentMessage(data.text, data.provider, data.language, data.audio_data);
        }
    }
    
    addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        
        const timestamp = new Date().toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${this.escapeHtml(text)}
                <div class="message-timestamp">${timestamp}</div>
            </div>
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    addAgentMessage(text, provider, language, audioData) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message agent';
        
        const timestamp = new Date().toLocaleTimeString();
        
        let audioControls = '';
        if (audioData) {
            audioControls = `
                <div class="audio-controls">
                    <button class="audio-button" onclick="demo.playAudioFromData('${audioData}')">
                        <i class="fas fa-play"></i> Play Audio
                    </button>
                    <span class="provider-info">Provider: ${provider} | Language: ${language}</span>
                </div>
            `;
        }
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                ${this.escapeHtml(text)}
                ${audioControls}
                <div class="message-timestamp">${timestamp}</div>
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.style.justifyContent = 'center';
        
        messageDiv.innerHTML = `
            <div class="message-content" style="background: #e9ecef; color: #6c757d; max-width: 50%;">
                <i class="fas fa-info-circle me-2"></i>
                ${this.escapeHtml(text)}
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message agent typing-indicator-container';
        typingDiv.id = 'typing-indicator';
        
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    async compareProviders() {
        const text = this.comparisonText.value.trim();
        if (!text) {
            alert('Please enter text to compare');
            return;
        }
        
        const language = this.languageSelect.value;
        
        this.generateComparisonButton.disabled = true;
        this.generateComparisonButton.innerHTML = '<span class="loading"></span> Generating...';
        
        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    language: language
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayComparisonResults(data.results);
            } else {
                alert('Error generating comparison: ' + data.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error generating comparison');
        } finally {
            this.generateComparisonButton.disabled = false;
            this.generateComparisonButton.innerHTML = '<i class="fas fa-play me-2"></i> Generate Comparison';
        }
    }
    
    async generateComparison() {
        await this.compareProviders();
    }
    
    displayComparisonResults(results) {
        this.comparisonContent.innerHTML = '';
        
        for (const [provider, result] of Object.entries(results)) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'comparison-item';
            
            if (typeof result === 'string' && result.startsWith('Error:')) {
                itemDiv.classList.add('error');
                itemDiv.innerHTML = `
                    <div class="provider-name">
                        ${provider.toUpperCase()}
                        <span class="provider-status error">Error</span>
                    </div>
                    <div>${result}</div>
                `;
            } else {
                itemDiv.classList.add('success');
                itemDiv.innerHTML = `
                    <div class="provider-name">
                        ${provider.toUpperCase()}
                        <span class="provider-status success">Success</span>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="demo.playAudioFromData('${result}')">
                        <i class="fas fa-play me-2"></i> Play Audio
                    </button>
                `;
            }
            
            this.comparisonContent.appendChild(itemDiv);
        }
        
        this.comparisonResults.style.display = 'block';
    }
    
    playAudioFromData(audioData) {
        if (this.currentAudio) {
            this.currentAudio.pause();
        }
        
        // Convert base64 to blob and create URL
        const byteCharacters = atob(audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        
        this.audioPlayer.src = audioUrl;
        this.audioPlayer.play();
        
        this.currentAudio = this.audioPlayer;
        
        // Update button states
        document.querySelectorAll('.audio-button').forEach(btn => {
            btn.classList.remove('playing');
            btn.innerHTML = '<i class="fas fa-play"></i> Play Audio';
        });
        
        // Find and update the clicked button
        event.target.classList.add('playing');
        event.target.innerHTML = '<i class="fas fa-pause"></i> Playing...';
    }
    
    playAudio(audioPath) {
        if (this.currentAudio) {
            this.currentAudio.pause();
        }
        
        const audioUrl = `/api/audio/${audioPath.split('/').pop()}`;
        this.audioPlayer.src = audioUrl;
        this.audioPlayer.play();
        
        this.currentAudio = this.audioPlayer;
        
        // Update button states
        document.querySelectorAll('.audio-button').forEach(btn => {
            btn.classList.remove('playing');
            btn.innerHTML = '<i class="fas fa-play"></i> Play Audio';
        });
        
        // Find and update the clicked button
        event.target.classList.add('playing');
        event.target.innerHTML = '<i class="fas fa-pause"></i> Playing...';
    }
    
    onAudioEnded() {
        // Reset button states
        document.querySelectorAll('.audio-button').forEach(btn => {
            btn.classList.remove('playing');
            btn.innerHTML = '<i class="fas fa-play"></i> Play Audio';
        });
        
        this.currentAudio = null;
    }
    
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize demo when page loads
let demo;
document.addEventListener('DOMContentLoaded', () => {
    demo = new TTSDemo();
}); 