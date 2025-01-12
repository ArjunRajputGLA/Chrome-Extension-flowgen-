// Service worker configuration
const GROQ_API_KEY = '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SUPPORTED_ORIGINS = [
  'https://www.google.com',
  'https://www.youtube.com',
  'https://github.com',
  'https://stackoverflow.com',
  'https://developer.mozilla.org'
];

// Initialize chat history storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ chatHistory: [] });
});

// Allow side panel opening
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error setting panel behavior:', error));

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  
  if (SUPPORTED_ORIGINS.some(origin => tab.url.startsWith(origin))) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true
    });
  } else {
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    });
  }
});

// Function to format messages for Groq API
function formatMessagesForGroq(messages) {
  // First, add the system message
  const formattedMessages = [{
    role: "system",
    content: "You are a helpful AI web assistant. You help users understand web content, summarize information, and answer questions about websites they're viewing."
  }];

  // Then format and add all other messages
  messages.forEach(msg => {
    // Only include role and content properties
    if (msg.role && msg.content) {
      formattedMessages.push({
        role: msg.role,
        content: msg.content
      });
    }
  });

  return formattedMessages;
}

// Function to get chat completion from Groq
async function getGroqChatCompletion(messages) {
  try {
    const formattedMessages = formatMessagesForGroq(messages);
    console.log('Calling Groq API with formatted messages:', formattedMessages);
    
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: formattedMessages,
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        max_tokens: 1024,
        top_p: 1,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Groq API error:', errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Groq API response:', data);
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error in getGroqChatCompletion:', error);
    throw error;
  }
}

// Handle messages from the chat interface
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type);
  
  if (request.type === 'getAIResponse') {
    // Ensure page content message is properly formatted if it exists
    const processedMessages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    getGroqChatCompletion(processedMessages)
      .then(response => {
        console.log('Got chat completion:', response);
        // Save to chat history with timestamp
        chrome.storage.local.get(['chatHistory'], (result) => {
          const history = result.chatHistory || [];
          history.push({
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString()
          });
          chrome.storage.local.set({ chatHistory: history });
        });
        sendResponse({ success: true, response });
      })
      .catch(error => {
        console.error('Error getting chat completion:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.type === 'getPageContent') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: () => document.body.innerText
        }, (result) => {
          sendResponse({ content: result[0].result });
        });
      } else {
        sendResponse({ content: '' });
      }
    });
    return true;
  }
  
  if (request.type === 'clearHistory') {
    chrome.storage.local.set({ chatHistory: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});