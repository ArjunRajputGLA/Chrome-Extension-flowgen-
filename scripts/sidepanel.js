document.addEventListener("DOMContentLoaded", () => {
  const nextStepButton = document.getElementById("nextStep");
  const instructionsContainer = document.getElementById("instructions-container");

  // Debug log helper
  function debugLog(message, data = null) {
    console.log(`[DEBUG] ${message}`, data);
  }

  // Message Listener: Update side panel content
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateSidePanel") {
      console.log("Message received in side panel:", message);
      if (instructionsContainer) {
        instructionsContainer.textContent = message.description;
      } else {
        console.error("Instructions container not found!");
      }
      sendResponse({ status: "success" });
    }
  });

  // Add event listener for "Next Step" button
  nextStepButton.addEventListener("click", () => {
    debugLog("Next step button clicked");
    chrome.runtime.sendMessage({ action: "nextStep" });
  });

  // Initial load message
  instructionsContainer.textContent = "Welcome! Click 'Next Step' to begin.";
});
