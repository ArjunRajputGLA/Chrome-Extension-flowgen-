let currentStep = null; // Current step starts as null
let steps = []; // Steps dynamically generated

// Function to fetch instructions for the starting point
async function fetchStartingInstructions(platform) {
  try {
    const response = await fetch("http://localhost:5000/gemini-inference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: platform,
        current_step: null, // null indicates starting point
      }),
    });
    const data = await response.json();
    return data.next_step; // Starting instructions
  } catch (error) {
    console.error("Error fetching starting instructions:", error);
    return "Failed to fetch starting instructions. Please try again.";
  }
}

// Function to update the side panel dynamically
function updateSidePanel(description) {
  chrome.runtime.sendMessage({ action: "updateSidePanel", description });
}

// Function to fetch and highlight the next step
async function nextStep(platform) {
  try {
    const step = steps[currentStep];
    if (!step && currentStep === null) {
      const startingInstructions = await fetchStartingInstructions(platform);
      updateSidePanel(startingInstructions);
      currentStep = 0;
      return;
    }

    const element = document.querySelector(step.selector);
    if (element) {
      highlightElement(element, step.arrowGif); // Highlight the element
      updateSidePanel(step.description); // Update the side panel
      currentStep++;
    } else {
      updateSidePanel(`Step ${currentStep + 1}: Element not found. Please locate it manually.`);
      currentStep++;
    }
  } catch (error) {
    console.error("Error during next step:", error);
    updateSidePanel("Failed to fetch the next step. Please try again.");
  }
}

// Function to extract layout data from the DOM
function extractLayoutData() {
  return {
    headers: Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((header) => header.textContent),
    paragraphs: Array.from(document.querySelectorAll("p")).map((para) => para.textContent),
    links: Array.from(document.querySelectorAll("a")).map((link) => `${link.textContent} ${link.href}`),
    buttons: Array.from(document.querySelectorAll("button")).map((button) => button.textContent),
    forms: Array.from(document.querySelectorAll("form")).map((form) => form.outerHTML),
    inputs: Array.from(document.querySelectorAll("input")).map((input) => input.outerHTML),
    images: Array.from(document.querySelectorAll("img")).map((img) => img.src),
  };
}

// Send extracted layout data to the backend (Gemini model)
async function sendToGemini(layoutData) {
  try {
    const response = await fetch("http://localhost:5000/gemini-inference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout_data: layoutData }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send data to Gemini: ${response.status}`);
    }

    const result = await response.json();
    console.log("Gemini response:", result);

    // Process and display Gemini response in the side panel
    updateSidePanel(result.analysis || "Inference complete. Check console for details.");
  } catch (error) {
    console.error("Error sending data to Gemini:", error);
    updateSidePanel("Failed to process layout data. Please try again.");
  }
}

// Message Listener: Extract layout and respond to background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageLayout") {
    const layoutData = extractLayoutData();
    sendResponse({ layoutData });
  } else if (request.action === "nextStep") {
    nextStep(request.platform).catch(console.error);
  }
});

// Load platform and process initial data
chrome.storage.local.get("currentPlatform", async (data) => {
  const platform = data.currentPlatform || "unknown";

  // Fetch and display the first step
  await nextStep(platform);

  // Extract and send layout data for Gemini inference
  const layoutData = extractLayoutData();
  await sendToGemini(layoutData);
});
