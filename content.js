class DeploymentHelper {
  constructor() {
    this.currentStep = null;
    this.steps = [];
    this.setupMessageListeners();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "getPageLayout") {
        const layoutData = this.extractLayoutData();
        this.sendToGemini(layoutData);
        sendResponse({ status: "success" });
      } else if (message.action === "nextStep") {
        this.handleNextStep(message.platform)
          .then(response => sendResponse(response))
          .catch(error => sendResponse({ status: "error", error: error.message }));
        return true;
      }
    });
  }

  async handleNextStep(platform) {
    try {
      const layoutData = this.extractLayoutData();
      const response = await this.sendToGemini(layoutData);
      return { status: "success", data: response };
    } catch (error) {
      console.error("Error in handleNextStep:", error);
      return { status: "error", error: error.message };
    }
  }

  extractLayoutData() {
    return {
      headers: Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map(h => h.textContent),
      paragraphs: Array.from(document.querySelectorAll("p")).map(p => p.textContent),
      links: Array.from(document.querySelectorAll("a")).map(a => ({ text: a.textContent, href: a.href })),
      buttons: Array.from(document.querySelectorAll("button")).map(b => b.textContent),
      forms: Array.from(document.querySelectorAll("form")).map(f => ({
        id: f.id,
        action: f.action,
        method: f.method
      })),
      inputs: Array.from(document.querySelectorAll("input")).map(i => ({
        type: i.type,
        name: i.name,
        id: i.id
      }))
    };
  }

  async sendToGemini(layoutData) {
    try {
      const response = await fetch("http://localhost:5000/gemini-inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout_data: layoutData })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      chrome.runtime.sendMessage({
        action: "updateSidePanel",
        analysis: data.analysis,
        elementOrder: data.element_order
      });

      return data;
    } catch (error) {
      console.error("Error sending data to Gemini:", error);
      throw error;
    }
  }
}

// Initialize the helper
const helper = new DeploymentHelper();