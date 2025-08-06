/**
 * Ultravox WebSocket Speech-to-Speech Control
 * Handles real-time voice conversation using Ultravox WebSocket API
 */

class UltravoxController {
    constructor() {
        this.websocket = null;
        this.callId = null;
        this.isConnected = false;
        this.callStartTime = null;
        this.messageCount = 0;
        this.callDurationInterval = null;
        this.heartbeatInterval = null;
        this.initialMessageSent = false;
        this.isCallIntentionallyEnded = false; // Flag to track intentional call ending
        
        this.initializeElements();
        this.bindEvents();
    }
    
    initializeElements() {
        this.startCallButton = document.getElementById('startCall');
        this.stopCallButton = document.getElementById('stopCall');
        this.testConnectionButton = document.getElementById('testConnection');
        this.systemPromptInput = document.getElementById('systemPrompt');
        this.voiceSelect = document.getElementById('voiceSelect');
        this.messageInput = document.getElementById('messageInput');
        this.sendMessageButton = document.getElementById('sendMessage');
        this.ultravoxCallStatus = document.getElementById('ultravoxCallStatus');
        this.ultravoxMetrics = document.getElementById('ultravoxMetrics');
        this.messageCountSpan = document.getElementById('messageCount');
        this.durationSpan = document.getElementById('callDuration');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.statusDiv = document.getElementById('status');
    }
    
    bindEvents() {
        this.startCallButton.addEventListener('click', () => this.startCall());
        this.stopCallButton.addEventListener('click', () => this.stopCall());
        this.testConnectionButton.addEventListener('click', () => this.testConnection());
        this.sendMessageButton.addEventListener('click', () => this.sendTextMessageFromInput());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendTextMessageFromInput();
            }
        });
    }
    
    showPanel() {
        const panel = document.getElementById('ultravoxPanel');
        if (panel) {
            panel.style.display = 'block';
        }
    }
    
    hidePanel() {
        const panel = document.getElementById('ultravoxPanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }
    
    async startCall() {
        try {
            this.updateStatus('Connecting...', 'warning');
            this.startCallButton.disabled = true;
            this.initialMessageSent = false;
            this.isCallIntentionallyEnded = false; // Reset flag
            
            // Create Ultravox call
            const response = await fetch('/api/ultravox/create-call', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    systemPrompt: this.systemPromptInput.value,
                    voice: this.voiceSelect.value
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create call: ${response.statusText} - ${errorText}`);
            }
            
            const callData = await response.json();
            console.log('Call data received:', callData);
            
            if (!callData.success) {
                throw new Error(callData.error || 'Failed to create call');
            }
            
            this.callId = callData.callId;
            
            if (!callData.joinUrl) {
                throw new Error('No WebSocket URL received from server');
            }
            
            console.log('Connecting to WebSocket:', callData.joinUrl);
            
            // Connect to WebSocket
            await this.connectWebSocket(callData.joinUrl);
            
        } catch (error) {
            console.error('Failed to start Ultravox call:', error);
            this.updateStatus('Failed to start call', 'error');
            this.startCallButton.disabled = false;
            this.addMessage('system', `Error: ${error.message}`);
        }
    }
    
    async connectWebSocket(joinUrl) {
        try {
            console.log('Attempting to connect to WebSocket:', joinUrl);
            
            if (!joinUrl || joinUrl === 'undefined') {
                throw new Error('Invalid WebSocket URL');
            }
            
            this.websocket = new WebSocket(joinUrl);
            
            this.websocket.onopen = () => {
                console.log('Ultravox WebSocket connected successfully');
                this.isConnected = true;
                this.updateStatus('Connected', 'success');
                this.startCallTimer();
                this.startHeartbeat();
                this.showCallControls();
                this.addMessage('system', '✅ Connected to Ultravox! You can now have a real-time voice conversation.');
                this.addMessage('system', '💡 Type a message in the text box below to start chatting with the AI assistant.');
            };
            
            this.websocket.onmessage = (event) => {
                console.log('WebSocket message received:', event.data);
                this.handleWebSocketMessage(event.data);
            };
            
            this.websocket.onclose = (event) => {
                console.log('Ultravox WebSocket disconnected:', event.code, event.reason);
                console.log('Close event details:', event);
                this.isConnected = false;
                this.updateStatus('Disconnected', 'error');
                this.stopCallTimer();
                this.stopHeartbeat();
                this.hideCallControls();
                
                // Only show error message if the call wasn't intentionally ended
                if (!this.isCallIntentionallyEnded) {
                    this.addMessage('system', `Connection closed: ${event.reason || 'Unknown reason'} (Code: ${event.code})`);
                }
            };
            
            this.websocket.onerror = (error) => {
                console.error('Ultravox WebSocket error:', error);
                this.updateStatus('Connection error', 'error');
                // Only show error message if the call wasn't intentionally ended
                if (!this.isCallIntentionallyEnded) {
                    this.addMessage('system', 'Connection error occurred. Check browser console for details.');
                }
            };
            
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.updateStatus('Connection failed', 'error');
            this.addMessage('system', `Connection failed: ${error.message}`);
            this.startCallButton.disabled = false;
        }
    }
    
    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data);
            const messageType = message.type;
            
            switch (messageType) {
                case 'transcript':
                    this.handleTranscript(message);
                    break;
                case 'audio':
                    this.handleAudio(message);
                    break;
                case 'state':
                    this.handleState(message);
                    break;
                case 'error':
                    this.handleError(message);
                    break;
                case 'room_info':
                    console.log('Room info received:', message);
                    // Handle room info - continue with Ultravox connection
                    this.handleRoomInfo(message);
                    break;
                case 'pong':
                    console.log('Received pong response');
                    break;
                case 'ping':
                    // Send pong response
                    const pongMessage = {
                        type: 'pong',
                        timestamp: Date.now()
                    };
                    this.websocket.send(JSON.stringify(pongMessage));
                    console.log('Sent pong response');
                    break;
                default:
                    console.log('Unknown message type:', messageType, message);
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }
    
    handleTranscript(message) {
        const role = message.role;
        const text = message.text || '';
        const isFinal = message.final || false;
        
        if (role === 'agent') {
            this.addMessage('agent', text);
            if (isFinal) {
                this.messageCount++;
                this.updateMessageCount();
            }
        } else if (role === 'user') {
            this.addMessage('user', text);
        }
    }
    
    handleAudio(message) {
        const audioData = message.audio;
        if (audioData) {
            // Convert base64 to audio and play
            this.playAudio(audioData);
        }
    }
    
    handleState(message) {
        const state = message.state;
        console.log('Call state:', state);
        this.updateConnectionStatus(state);
    }
    
    handleError(message) {
        const error = message.error;
        console.error('Ultravox error:', error);
        this.addMessage('system', `Error: ${error}`);
    }
    
    async handleRoomInfo(roomInfo) {
        try {
            const roomUrl = roomInfo.roomUrl;
            const token = roomInfo.token;
            
            console.log('Room info received - continuing with Ultravox connection');
            this.addMessage('system', '🔄 Room info received - connection ready');
            
            // Instead of switching to LiveKit, continue using the Ultravox WebSocket
            // The room_info indicates the connection is ready for communication
            if (!this.initialMessageSent) {
                this.initialMessageSent = true;
                setTimeout(() => {
                    this.sendTextMessage('Hello! How can you help me today?');
                }, 1000);
            }
            
        } catch (error) {
            console.error('Failed to handle room info:', error);
            this.addMessage('system', `❌ Error processing room info: ${error.message}`);
        }
    }
    
    sendTextMessage(text) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.addMessage('system', 'Cannot send message: WebSocket not connected');
            return;
        }
        
        const message = {
            type: 'user_text_message',
            text: text
        };
        
        console.log('Sending text message:', message);
        this.websocket.send(JSON.stringify(message));
        this.addMessage('user', text);
        this.addMessage('system', '📤 Message sent, waiting for response...');
    }
    
    sendTextMessageFromInput() {
        const text = this.messageInput.value.trim();
        if (!text) {
            return;
        }
        
        this.sendTextMessage(text);
        this.messageInput.value = '';
    }
    
    async testConnection() {
        try {
            this.addMessage('system', 'Testing Ultravox connection...');
            
            const response = await fetch('/api/ultravox/create-call', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    systemPrompt: 'You are a helpful assistant.',
                    voice: 'Mark'
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const callData = await response.json();
            console.log('Test call data:', callData);
            
            if (!callData.success) {
                throw new Error(callData.error || 'Failed to create test call');
            }
            
            this.addMessage('system', `✅ Test call created successfully! Call ID: ${callData.callId}`);
            this.addMessage('system', `🔗 WebSocket URL: ${callData.joinUrl}`);
            
            // Test WebSocket connection
            if (callData.joinUrl) {
                this.addMessage('system', 'Testing WebSocket connection...');
                await this.testWebSocketConnection(callData.joinUrl);
            }
            
        } catch (error) {
            console.error('Test connection failed:', error);
            this.addMessage('system', `❌ Test failed: ${error.message}`);
        }
    }
    
    async testWebSocketConnection(joinUrl) {
        try {
            const testWebSocket = new WebSocket(joinUrl);
            
            testWebSocket.onopen = () => {
                this.addMessage('system', '✅ WebSocket connection test successful');
                testWebSocket.close();
            };
            
            testWebSocket.onerror = (error) => {
                this.addMessage('system', '❌ WebSocket connection test failed');
            };
            
        } catch (error) {
            this.addMessage('system', `❌ WebSocket test error: ${error.message}`);
        }
    }
    
    addMessage(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        const roleIcon = role === 'user' ? '👤' : role === 'agent' ? '🤖' : '💬';
        const roleText = role === 'user' ? 'You' : role === 'agent' ? 'Agent' : 'System';
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="role-icon">${roleIcon}</span>
                <span class="role-text">${roleText}</span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content">${text}</div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    playAudio(base64Audio) {
        try {
            const audioBlob = this.base64ToBlob(base64Audio, 'audio/wav');
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play().catch(error => {
                console.error('Failed to play audio:', error);
            });
        } catch (error) {
            console.error('Error playing audio:', error);
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
    
    updateStatus(text, type = 'info') {
        this.statusDiv.textContent = text;
        this.statusDiv.className = `status ${type}`;
    }
    
    updateConnectionStatus(status) {
        console.log('Connection status:', status);
    }
    
    startCallTimer() {
        this.callStartTime = Date.now();
        this.callDurationInterval = setInterval(() => {
            const elapsed = Date.now() - this.callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            this.durationSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    stopCallTimer() {
        if (this.callDurationInterval) {
            clearInterval(this.callDurationInterval);
            this.callDurationInterval = null;
        }
        this.durationSpan.textContent = '00:00';
    }
    
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                const heartbeat = {
                    type: 'ping',
                    timestamp: Date.now()
                };
                console.log('Sending heartbeat:', heartbeat);
                this.websocket.send(JSON.stringify(heartbeat));
            }
        }, 30000); // Send heartbeat every 30 seconds
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    updateMessageCount() {
        this.messageCountSpan.textContent = this.messageCount;
    }
    
    showCallControls() {
        this.startCallButton.style.display = 'none';
        this.stopCallButton.style.display = 'inline-block';
        this.ultravoxCallStatus.style.display = 'flex';
        this.ultravoxMetrics.style.display = 'block';
        this.messageInput.style.display = 'block';
        this.sendMessageButton.style.display = 'inline-block';
    }
    
    hideCallControls() {
        this.startCallButton.style.display = 'inline-block';
        this.stopCallButton.style.display = 'none';
        this.ultravoxCallStatus.style.display = 'none';
        this.ultravoxMetrics.style.display = 'none';
        this.messageInput.style.display = 'none';
        this.sendMessageButton.style.display = 'none';
        this.startCallButton.disabled = false;
    }
    
    stopCall() {
        // Set flag to indicate intentional call ending
        this.isCallIntentionallyEnded = true;
        
        if (this.websocket) {
            this.websocket.close(1000, 'Call ended by user');
        }
        
        this.stopCallTimer();
        this.stopHeartbeat();
        this.hideCallControls();
        this.updateStatus('Call ended', 'info');
        this.addMessage('system', '📞 Call ended');
        
        // Reset metrics
        this.messageCount = 0;
        this.updateMessageCount();
        this.durationSpan.textContent = '00:00';
        
        // Also set the flag for the main WebSocket connection if it exists
        if (window.voiceAgentControl) {
            window.voiceAgentControl.isConnectionIntentionallyClosed = true;
        }
        if (window.voiceAgentsDemo) {
            window.voiceAgentsDemo.isConnectionIntentionallyClosed = true;
        }
    }
}

// Initialize the controller when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new UltravoxController();
}); 