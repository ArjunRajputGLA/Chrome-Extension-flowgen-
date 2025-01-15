let conversationHistory = [];
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const clearButton = document.getElementById('clearButton');
let isWaitingForResponse = false;
let currentTypingIndicator = null;
let responseTimeout = null;

// Set initial timestamp for welcome message
document.querySelector('.bot-message .timestamp').textContent = 
    formatTimestamp(new Date().toISOString());

// Load chat history
chrome.storage.local.get(['chatHistory'], (result) => {
    if (result.chatHistory?.length) {
        chatContainer.innerHTML = '';
        result.chatHistory.forEach(msg => {
            addMessage(msg.content, msg.role === 'assistant' ? 'bot' : 'user', msg.timestamp);
        });
        conversationHistory = result.chatHistory;
    }
});

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function showTypingIndicator() {
    if (currentTypingIndicator) {
        currentTypingIndicator.remove();
    }

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    
    const indicatorContent = document.createElement('div');
    indicatorContent.className = 'typing-content';
    
    const indicatorText = document.createElement('span');
    indicatorText.textContent = 'AI is thinking';
    indicatorContent.appendChild(indicatorText);
    
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'typing-dots';
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        dotsContainer.appendChild(dot);
    }
    
    indicatorContent.appendChild(dotsContainer);
    indicator.appendChild(indicatorContent);
    
    chatContainer.appendChild(indicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    currentTypingIndicator = indicator;
    
    // Set timeout for response
    responseTimeout = setTimeout(() => {
        handleResponseTimeout();
    }, 30000); // 30 seconds timeout
    
    return indicator;
}

function handleResponseTimeout() {
    if (currentTypingIndicator) {
        currentTypingIndicator.remove();
        currentTypingIndicator = null;
    }
    
    isWaitingForResponse = false;
    sendButton.disabled = false;
    
    addErrorMessage("The AI is taking too long to respond. Please try again.");
}

function addErrorMessage(errorText) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    
    const errorIcon = document.createElement('span');
    errorIcon.className = 'error-icon';
    errorIcon.textContent = '⚠️';
    errorDiv.appendChild(errorIcon);
    
    const errorContent = document.createElement('span');
    errorContent.textContent = errorText;
    errorDiv.appendChild(errorContent);
    
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.textContent = 'Retry';
    retryButton.onclick = () => {
        errorDiv.remove();
        sendMessage(conversationHistory[conversationHistory.length - 1].content);
    };
    errorDiv.appendChild(retryButton);
    
    chatContainer.appendChild(errorDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addMessage(text, type, timestamp = new Date().toISOString()) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = text;
    messageDiv.appendChild(messageContent);
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = formatTimestamp(timestamp);
    messageDiv.appendChild(timestampDiv);
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage(overrideMessage = null) {
    if (isWaitingForResponse) return;
    
    const message = overrideMessage || messageInput.value.trim();
    if (!message) return;
  
    const timestamp = new Date().toISOString();
    addMessage(message, 'user', timestamp);
    
    const userMessage = { role: 'user', content: message, timestamp };
    conversationHistory.push(userMessage);
    
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendButton.disabled = true;
    isWaitingForResponse = true;
    
    const indicator = showTypingIndicator();
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'getAIResponse',
        messages: conversationHistory
      });
  
      clearTimeout(responseTimeout);
      indicator.remove();
      currentTypingIndicator = null;
  
      if (response.success) {
        const responseTimestamp = new Date().toISOString();
        addMessage(response.response, 'bot', responseTimestamp);
        
        // Handle selectors for highlighting
        if (response.selectors && response.selectors.length > 0) {
          response.selectors.forEach(selector => {
            // Send message to content script to highlight element
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'highlightFeature',
                selector: selector
              });
            });
          });
        }
  
        conversationHistory.push({
          role: 'assistant',
          content: response.response,
          timestamp: responseTimestamp
        });
      } else {
        throw new Error(response.error || 'Failed to get response');
      }
    } catch (error) {
      clearTimeout(responseTimeout);
      if (currentTypingIndicator) {
        currentTypingIndicator.remove();
        currentTypingIndicator = null;
      }
      addErrorMessage(error.message || 'Sorry, there was an error getting the response. Please try again.');
    } finally {
      isWaitingForResponse = false;
      sendButton.disabled = false;
    }
  }

// Event Listeners
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
    sendButton.disabled = !messageInput.value.trim();
});

sendButton.addEventListener('click', () => sendMessage());

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

clearButton.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
        const response = await chrome.runtime.sendMessage({ type: 'clearHistory' });
        if (response.success) {
            conversationHistory = [];
            chatContainer.innerHTML = '';
            
            const timestamp = new Date().toISOString();
            addMessage(
                "Hello! 👋 I'm your AI web assistant powered by Groq. I can help you with:\n• Summarizing web pages\n• Answering questions about the content\n• Finding specific information\n• Explaining complex topics\n\nHow can I assist you today?",
                'bot',
                timestamp
            );
        }
    }
});

document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.textContent;
      messageInput.value = text === 'Summarize this page' ? 
        'How do I navigate through this page?' : text;
      messageInput.dispatchEvent(new Event('input'));
      sendMessage();
    });
  });