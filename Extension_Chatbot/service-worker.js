  // Service worker configuration
  const GROQ_API_KEY = '<your groq API here>';
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

  async function getPageStructure(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          try {
            function getElementInfo(element, depth = 0) {
              // Limit depth to prevent excessive nesting
              if (depth > 3) return null;
              
              // Skip if element is not valid
              if (!element || !element.tagName) return null;
              
              const tagName = element.tagName.toLowerCase();
              // Skip script, style, and hidden elements
              if (['script', 'style', 'noscript'].includes(tagName)) {
                return null;
              }
  
              const id = element.id ? `#${element.id}` : '';
              const classes = Array.from(element.classList)
                .filter(c => !c.includes('__'))
                .slice(0, 2)
                .map(c => `.${c}`)
                .join('');
              
              const selector = tagName + id + classes;
              
              // Get text content
              const textContent = element.textContent?.trim().substring(0, 30) || '';
              
              // Get interactive elements
              const isInteractive = element.tagName === 'A' || 
                                  element.tagName === 'BUTTON' || 
                                  element.tagName === 'INPUT' ||
                                  element.tagName === 'SELECT';
              
              // Include aria labels and placeholders for better context
              const ariaLabel = element.getAttribute('aria-label');
              const placeholder = element.getAttribute('placeholder');
              const additionalInfo = [ariaLabel, placeholder]
                .filter(Boolean)
                .join(' | ');
  
              return {
                selector: selector,
                text: textContent,
                type: isInteractive ? tagName.toLowerCase() : null,
                info: additionalInfo || undefined,
                children: Array.from(element.children)
                  .map(child => getElementInfo(child, depth + 1))
                  .filter(Boolean)
                  .slice(0, 5)
              };
            }
  
            const structure = getElementInfo(document.body);
            console.log('Page structure extracted:', structure); // Debug log
            return JSON.stringify({
              url: window.location.href,
              title: document.title,
              structure: structure
            });
          } catch (error) {
            console.error('Error extracting page structure:', error);
            return JSON.stringify({
              error: error.message,
              url: window.location.href
            });
          }
        }
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error('Script execution error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else if (!results || !results[0]) {
          reject(new Error('No results from page structure extraction'));
        } else {
          const data = JSON.parse(results[0].result);
          if (data.error) {
            reject(new Error(`Page structure extraction failed: ${data.error}`));
          } else {
            resolve(results[0].result);
          }
        }
      });
    });
  }

  // Function to format messages for Groq API
  function formatMessagesForGroq(messages, pageStructure = '') {
  let structureInfo = 'No page structure available';
  
  try {
    const parsedStructure = JSON.parse(pageStructure);
    if (parsedStructure.structure) {
      structureInfo = `Current page: ${parsedStructure.title || 'Untitled'}
URL: ${parsedStructure.url}
Page structure: ${JSON.stringify(parsedStructure.structure, null, 2)}`;
    }
  } catch (error) {
    console.error('Error parsing page structure:', error);
  }

  const formattedMessages = [{
    role: "system",
    content: `You are a helpful AI web assistant that guides users through web pages. When responding to navigation requests:
    1. Analyze the user's request and the provided page structure
    2. Provide numbered steps to achieve their goal
    3. For each step that requires clicking or interacting with an element, include its CSS selector in [selector] tags
    4. Keep responses concise and action-oriented
    5. If you can't find an exact element match, use the closest available selector
    6. If no page structure is available, inform the user and ask them to refresh the page
    
    ${structureInfo}`
  }];

  messages.slice(-5).forEach(msg => {
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
  async function getGroqChatCompletion(messages, pageStructure) {
    try {
      const formattedMessages = formatMessagesForGroq(messages, pageStructure);
      
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
        throw new Error(`API error: ${response.status}`);
      }
  
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error in getGroqChatCompletion:', error);
      throw error;
    }
  }

  // Handle messages from the chat interface
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getAIResponse') {
      chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
        try {
          if (!tabs || !tabs[0]?.id) {
            throw new Error('No active tab found');
          }
  
          console.log('Getting page structure for tab:', tabs[0].id);
          const pageStructure = await getPageStructure(tabs[0].id);
          console.log('Page structure received:', pageStructure);
  
          const response = await getGroqChatCompletion(request.messages, pageStructure);
          console.log('AI response received:', response);
          
          // Parse response for selectors
          const selectors = response.match(/\[selector\](.*?)\[\/selector\]/g)
            ?.map(s => s.replace(/\[selector\]|\[\/selector\]/g, '')) || [];
          
          sendResponse({ 
            success: true, 
            response,
            selectors,
            hasPageStructure: !!pageStructure
          });
          
          // Save to chat history
          chrome.storage.local.get(['chatHistory'], (result) => {
            const history = result.chatHistory || [];
            history.push({
              role: 'assistant',
              content: response,
              timestamp: new Date().toISOString()
            });
            chrome.storage.local.set({ chatHistory: history });
          });
        } catch (error) {
          console.error('Error in message handler:', error);
          sendResponse({ 
            success: false, 
            error: error.message,
            hasPageStructure: false
          });
        }
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