const DEPLOYMENT_SITES = {
  "vercel.com": "Vercel",
  "netlify.com": "Netlify",
  "pages.github.com": "GitHub Pages",
  "cloud.google.com": "Google Cloud Platform",
  "render.com": "Render",
};

function detectPlatform(url) {
  try {
    const hostname = new URL(url).hostname;
    return Object.entries(DEPLOYMENT_SITES).find(([site]) => 
      hostname.includes(site))?.[1] ?? null;
  } catch (error) {
    console.error('[ERROR] Failed to parse URL:', error);
    return null;
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    handleTabUpdate(tabId, tab);
  }
});

// Listen for navigation completion
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only handle main frame navigation
  if (details.frameId === 0) {
    const tab = await chrome.tabs.get(details.tabId);
    handleTabUpdate(details.tabId, tab);
  }
});

async function handleTabUpdate(tabId, tab) {
  const platform = detectPlatform(tab.url);
  
  try {
    if (platform) {
      await chrome.storage.local.set({ currentPlatform: platform });
      await chrome.sidePanel.setOptions({
        tabId,
        path: "sidepanel.html",
        enabled: true
      });
      console.log(`[INFO] Platform detected: ${platform}`);
      
      // Send message to content script to trigger analysis
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: "nextStep",
          platform: platform
        });
      } catch (error) {
        console.log("[INFO] Content script not ready, injecting it first");
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        // Try sending the message again after a short delay
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, {
              action: "nextStep",
              platform: platform
            });
          } catch (error) {
            console.error('[ERROR] Failed to send message after injection:', error);
          }
        }, 1000);
      }
    } else {
      await chrome.sidePanel.setOptions({
        tabId,
        enabled: false
      });
      console.log("[INFO] No matching platform detected");
    }
  } catch (error) {
    console.error('[ERROR] Failed to update side panel:', error);
  }
}