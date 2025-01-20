class DeploymentHelper {
  constructor() {
    this.currentStep = null;
    this.steps = [];
    this.setupMessageListeners();
    console.log("[INFO] DeploymentHelper initialized");
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("[INFO] Received message:", message);
      
      if (message.action === "nextStep") {
        // Always process nextStep messages
        this.handleNextStep(message.platform)
          .then(response => {
            console.log("[INFO] NextStep handled successfully:", response);
            sendResponse(response);
          })
          .catch(error => {
            console.error("[ERROR] NextStep handling failed:", error);
            sendResponse({ status: "error", error: error.message });
          });
        return true; // Keep the message channel open
      }
    });
  }

  async handleNextStep(platform) {
    try {
      console.log("[INFO] Handling next step for platform:", platform);
      const layoutData = this.extractLayoutData();
      const response = await this.sendToGemini(layoutData);
      return { status: "success", data: response };
    } catch (error) {
      console.error("[ERROR] Error in handleNextStep:", error);
      throw error;
    }
  }

  extractLayoutData() {
    const layoutData = {
      currentUrl: window.location.href,
      headers: Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map(h => h.textContent?.trim()).filter(Boolean),
      paragraphs: Array.from(document.querySelectorAll("p")).map(p => p.textContent?.trim()).filter(Boolean),
      links: Array.from(document.querySelectorAll("a")).map(a => ({
        text: a.textContent?.trim(),
        href: a.href
      })).filter(link => link.text),
      buttons: Array.from(document.querySelectorAll("button")).map(b => b.textContent?.trim()).filter(Boolean),
      forms: Array.from(document.querySelectorAll("form")).map(f => ({
        id: f.id,
        action: f.action,
        method: f.method
      })),
      inputs: Array.from(document.querySelectorAll("input")).map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        placeholder: i.placeholder
      }))
    };

    console.log("[INFO] Extracted layout data:", layoutData);
    return layoutData;
  }

  async sendToGemini(layoutData) {
    try {
      console.log("[INFO] Sending data to Gemini");
      const response = await fetch("http://localhost:5000/gemini-inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout_data: layoutData })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      console.log("[INFO] Received response from Gemini:", data);

      // Send update to side panel
      chrome.runtime.sendMessage({
        action: "updateSidePanel",
        analysis: data.analysis,
        elementOrder: data.element_order
      });

      return data;
    } catch (error) {
      console.error("[ERROR] Error sending data to Gemini:", error);
      throw error;
    }
  }
}

// Initialize the helper
console.log("[INFO] Initializing DeploymentHelper");
const helper = new DeploymentHelper();