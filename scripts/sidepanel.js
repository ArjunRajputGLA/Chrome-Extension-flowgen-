document.addEventListener("DOMContentLoaded", () => {
  const nextStepButton = document.getElementById("nextStep");
  const instructionsContainer = document.getElementById("instructions-container");
  const analysisContainer = document.getElementById("analysis-output");
  const elementOrderList = document.getElementById("element-order-list");

  // Create the element if it doesn't exist
  if (!elementOrderList) {
    const newElementOrderList = document.createElement("div");
    newElementOrderList.id = "element-order-list";
    document.body.appendChild(newElementOrderList);
  }

  // Debug log helper
  function debugLog(message, data = null) {
    console.log(`[DEBUG] ${message}`, data);
  }

  // Message Listener: Update side panel content
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateSidePanel") {
      debugLog("Message received in side panel:", message);

      if (instructionsContainer) {
        instructionsContainer.textContent = message.description;
      } else {
        console.error("Instructions container not found!");
      }

      // Display analysis and element order if available
      if (message.analysis && analysisContainer) {
        analysisContainer.textContent = message.analysis;
      }

      sendResponse({ status: "success" });
    }
  });

  // Add event listener for "Next Step" button
  nextStepButton.addEventListener("click", () => {
    debugLog("Next step button clicked");
  
    chrome.storage.local.get("currentPlatform", (data) => {
      const platform = data.currentPlatform || "unknown";
  
      chrome.runtime.sendMessage(
        { action: "nextStep", platform },
        (response) => {
          if (response) {
            debugLog("Received response:", response);
  
            if (response.status === "success") {
              instructionsContainer.textContent = response.description || "No further instructions.";
              debugLog("Next step processed successfully", response);
            } else {
              console.error("Failed to fetch the next step: ", response);
              instructionsContainer.textContent = "Error: Unable to process the next step.";
            }
          } else {
            console.error("No response received.");
            instructionsContainer.textContent = "Error: No response received.";
          }
        }
      );
    });
  });  

  // Initial load message
  instructionsContainer.textContent = "Welcome! Click 'Next Step' to begin.";
});
