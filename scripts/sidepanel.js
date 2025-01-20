class SidePanelManager {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.triggerNextStepOnLoad();  // Trigger the next step directly on load
  }

  initializeElements() {
    // We no longer need the 'nextStep' button
    this.instructionsContainer = document.getElementById("instructions-container");
    this.analysisOutput = document.getElementById("analysis-output");
    this.errorMessage = document.getElementById("error-message");

    // Chat-related elements
    this.chatInput = document.getElementById("chat-input");
    this.sendChatButton = document.getElementById("send-chat");
    this.chatOutput = document.getElementById("chat-output");
  }

  setupEventListeners() {
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Chat send button event listener
    this.sendChatButton.addEventListener("click", () => this.handleSendChat());
  }

  // Trigger the next step directly when the side panel loads
  async triggerNextStepOnLoad() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const { currentPlatform } = await chrome.storage.local.get("currentPlatform");

      if (!currentPlatform) {
        this.showError("Platform is not specified. Please set it before proceeding.");
        return;
      }

      await chrome.tabs.sendMessage(tab.id, {
        action: "nextStep",
        platform: currentPlatform,
      });
    } catch (error) {
      this.showError("Failed to process next step: " + error.message);
    }
  }

  // Handle send chat interaction
  async handleSendChat() {
    const userMessage = this.chatInput.value.trim();
    if (!userMessage) {
      this.showError("Please enter a message.");
      return;
    }

    try {
      // Display user's message in the chat output
      this.chatOutput.innerHTML += `<div class="user-message">${userMessage}</div>`;
      this.chatInput.value = ""; // Clear input field

      // Retrieve platform info (e.g., "AWS" or "Heroku") from storage
      const { currentPlatform } = await chrome.storage.local.get("currentPlatform");

      if (!currentPlatform) {
        this.showError("Platform is not specified.");
        return;
      }

      // Send message to chat endpoint
      const response = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: currentPlatform,
          issue: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();

      // Display chatbot's response in the chat output
      this.chatOutput.innerHTML += `<div class="bot-message">${data.response}</div>`;
      this.chatOutput.scrollTop = this.chatOutput.scrollHeight; // Auto-scroll to the latest message
    } catch (error) {
      this.showError("Failed to send chat message: " + error.message);
    }
  }

  // Handle receiving message from content script (to update panel)
  handleMessage(message, sender, sendResponse) {
    if (message.action === "updateSidePanel") {
      this.updatePanel(message);
      sendResponse({ status: "success" });
    }
  }

  // Update side panel with new data (including analysis)
  updatePanel(data) {
    // Update analysis output with relevant content for the new step/page
    if (data.analysis) {
      this.analysisOutput.textContent = data.analysis;
    }

    // Ensure chat output is separate from the analysis
    if (data.analysis && !this.chatOutput.innerHTML.includes(data.analysis)) {
      // Optionally: Append analysis messages to the analysis output
      // this.chatOutput.innerHTML += `<div class="bot-message">${data.analysis}</div>`;
    }
  }

  // Show error messages if any
  showError(message) {
    this.errorMessage.textContent = message;
  }
}

// Initialize the side panel
document.addEventListener("DOMContentLoaded", () => {
  new SidePanelManager();
});