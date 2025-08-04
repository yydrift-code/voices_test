// Voice Agents Demo JavaScript
class VoiceAgentsDemo {
    constructor() {
        this.ws = null;
        this.audioPlayer = null;
        this.currentAudio = null;
        this.isConnected = false;
        this.selectedAgent = null;
        this.agents = [];
        
        this.initializeElements();
        this.bindEvents();
        this.loadAgents();
        this.connectWebSocket();
        this.initializeComparisonTable();
    }
    
    initializeElements() {
        this.chatMessages = document.getElementById('chat-messages');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.languageSelect = document.getElementById('language-select');
        this.providerSelect = document.getElementById('provider-select');
        this.agentList = document.getElementById('agent-list');
        this.currentAgentName = document.getElementById('current-agent-name');
        this.connectionStatus = document.getElementById('connection-status');
        this.audioPlayer = document.getElementById('audio-player');
        this.testText = document.getElementById('test-text');
        this.testAllProvidersButton = document.getElementById('test-all-providers');
        this.comparisonTableBody = document.getElementById('comparison-table-body');
    }
    
    bindEvents() {
        // Send message
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Test all providers
        this.testAllProvidersButton.addEventListener('click', () => this.testAllProviders());
        
        // Audio player events
        this.audioPlayer.addEventListener('ended', () => this.onAudioEnded());
    }
    
    async loadAgents() {
        try {
            const response = await fetch('/api/agents');
            const data = await response.json();
            this.agents = data.agents;
            this.renderAgents();
        } catch (error) {
            console.error('Error loading agents:', error);
        }
    }
    
    renderAgents() {
        this.agentList.innerHTML = '';
        
        this.agents.forEach(agent => {
            const agentCard = document.createElement('div');
            agentCard.className = 'agent-card';
            agentCard.dataset.agentType = agent.type;
            
            agentCard.innerHTML = `
                <h4>${agent.name}</h4>
                <p>${agent.description}</p>
                <div class="expertise">
                    <strong>Expertise:</strong> ${agent.expertise.join(', ')}
                </div>
            `;
            
            agentCard.addEventListener('click', () => this.selectAgent(agent));
            this.agentList.appendChild(agentCard);
        });
    }
    
    selectAgent(agent) {
        // Remove previous selection
        document.querySelectorAll('.agent-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Select new agent
        const agentCard = document.querySelector(`[data-agent-type="${agent.type}"]`);
        if (agentCard) {
            agentCard.classList.add('selected');
        }
        
        this.selectedAgent = agent;
        this.currentAgentName.textContent = agent.name;
        
        // Enable chat if connected
        if (this.isConnected) {
            this.messageInput.disabled = false;
            this.sendButton.disabled = false;
        }
        
        // Add system message
        this.addSystemMessage(`Switched to ${agent.name}. ${agent.personality}`);
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            this.addSystemMessage('Connected to Voice Agent System');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.addSystemMessage('Disconnected from Voice Agent System');
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.addSystemMessage('Connection error');
        };
    }
    
    updateConnectionStatus(connected) {
        const statusElement = this.connectionStatus;
        if (connected) {
            statusElement.innerHTML = '<i class="fas fa-circle text-success"></i> Connected';
        } else {
            statusElement.innerHTML = '<i class="fas fa-circle text-danger"></i> Disconnected';
        }
    }
    
    sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || !this.isConnected || !this.selectedAgent) return;
        
        const language = this.languageSelect.value;
        const provider = this.providerSelect.value;
        
        // Add user message to chat
        this.addUserMessage(text);
        
        // Send to WebSocket
        this.ws.send(JSON.stringify({
            text: text,
            language: language,
            provider: provider,
            agent_type: this.selectedAgent.type
        }));
        
        // Clear input
        this.messageInput.value = '';
        
        // Show typing indicator
        this.showTypingIndicator();
    }
    
    handleMessage(data) {
        this.hideTypingIndicator();
        
        if (data.type === 'agent_message') {
            this.addAgentMessage(data.text, data.agent_name, data.provider, data.language, data.audio_data);
        } else if (data.type === 'system_message') {
            this.addSystemMessage(data.text);
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
    
    addAgentMessage(text, agentName, provider, language, audioData) {
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
                <div class="agent-name">${agentName}</div>
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
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <i class="fas fa-info-circle"></i> ${this.escapeHtml(text)}
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
    
    onAudioEnded() {
        // Reset button states
        document.querySelectorAll('.audio-button').forEach(btn => {
            btn.classList.remove('playing');
            btn.innerHTML = '<i class="fas fa-play"></i> Play Audio';
        });
        
        this.currentAudio = null;
    }
    
    initializeComparisonTable() {
        const languages = ['en', 'be', 'pl', 'lt', 'lv', 'et'];
        const languageNames = {
            'en': 'English',
            'be': 'Belarusian',
            'pl': 'Polish',
            'lt': 'Lithuanian',
            'lv': 'Latvian',
            'et': 'Estonian'
        };
        
        this.comparisonTableBody.innerHTML = '';
        
        languages.forEach(lang => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${languageNames[lang]}</strong></td>
                <td><span class="provider-status" id="status_${lang}_openai"></span>OpenAI</td>
                <td><span class="provider-status" id="status_${lang}_google"></span>Google</td>
                <td><span class="provider-status" id="status_${lang}_pyttsx3"></span>pyttsx3</td>
            `;
            this.comparisonTableBody.appendChild(row);
        });
    }
    
    async testAllProviders() {
        const text = this.testText.value.trim();
        if (!text) {
            alert('Please enter test text');
            return;
        }
        
        const language = this.languageSelect.value;
        const providers = ['openai', 'google', 'pyttsx3'];
        
        this.testAllProvidersButton.disabled = true;
        this.testAllProvidersButton.innerHTML = '<span class="loading"></span> Testing...';
        
        // Update status indicators
        providers.forEach(provider => {
            const statusElement = document.getElementById(`status_${language}_${provider}`);
            if (statusElement) {
                statusElement.className = 'provider-status loading';
            }
        });
        
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
                // Update status indicators
                providers.forEach(provider => {
                    const statusElement = document.getElementById(`status_${language}_${provider}`);
                    if (statusElement) {
                        if (data.results[provider] && !data.results[provider].startsWith('Error:')) {
                            statusElement.className = 'provider-status success';
                        } else {
                            statusElement.className = 'provider-status error';
                        }
                    }
                });
                
                // Play audio samples
                providers.forEach(provider => {
                    if (data.results[provider] && !data.results[provider].startsWith('Error:')) {
                        setTimeout(() => {
                            this.playAudioFromData(data.results[provider]);
                        }, providers.indexOf(provider) * 2000); // Play with 2-second intervals
                    }
                });
            } else {
                alert('Error testing providers: ' + data.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error testing providers');
        } finally {
            this.testAllProvidersButton.disabled = false;
            this.testAllProvidersButton.innerHTML = 'Test All Providers';
        }
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
    demo = new VoiceAgentsDemo();
}); 