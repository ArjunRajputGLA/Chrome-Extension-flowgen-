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
  console.log("Updating side panel with:", description);
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

    if (step) {
      const element = document.querySelector(step.selector);
      if (element) {
        highlightElement(element, step.arrowGif);
        updateSidePanel(step.description);
        currentStep++;
      } else {
        updateSidePanel(`Step ${currentStep + 1}: Element not found. Please locate it manually.`);
        currentStep++;
      }
    } else {
      updateSidePanel("No more steps to process.");
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

    // Handle element order if available
    let elementOrderList = document.getElementById("element-order-list");
    if (!elementOrderList) {
      elementOrderList = document.createElement("div");
      elementOrderList.id = "element-order-list";
      document.body.appendChild(elementOrderList);
    }

    // Handle element order if available
    elementOrderList.innerHTML = "";  // Clear previous content
    if (Array.isArray(result.element_order)) {
      result.element_order.forEach((item) => {
        const listItem = document.createElement("div");
        listItem.textContent = `${item.id}: ${item.content}`;
        elementOrderList.appendChild(listItem);
      });
    } else {
      console.warn("element_order is not an array:", result.element_order);
    }    

  } catch (error) {
    console.error("Error sending data to Gemini:", error);
    updateSidePanel("Failed to process layout data. Please try again.");
  }
}


// Initialize MutationObserver to monitor DOM changes
function initializeObserver() {
  const observer = new MutationObserver(() => {
    const newContent = document.querySelector("your-target-selector");
    if (newContent) {
      chrome.runtime.sendMessage({
        action: "updateSidePanel",
        description: newContent.innerText,
      });
    }
  });

  // Start observing the DOM for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("[DEBUG] MutationObserver initialized.");
}

// Message Listener: Handle messages from side panel or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getPageLayout") {
    const layoutData = extractLayoutData();
    sendResponse({ layoutData });
  } else if (message.action === "nextStep") {
    nextStep(message.platform)
      .then(() => {
        sendResponse({ status: "success", description: "Next step executed." });
      })
      .catch((error) => {
        console.error("Error executing next step:", error);
        sendResponse({ status: "error", description: "Failed to execute next step." });
      });
    return true; // Keep the message channel open for async responses
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

  // Initialize the MutationObserver
  initializeObserver();
});
