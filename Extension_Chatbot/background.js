chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getAIResponse') {
        // Here you would typically make an API call to your AI service
        // For now, we'll just echo back a response
        setTimeout(() => {
            sendResponse(`This is a sample response to: "${request.message}"`);
        }, 1000);
        return true; // Will respond asynchronously
    }
});