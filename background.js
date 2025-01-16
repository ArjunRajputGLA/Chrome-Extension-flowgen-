const DEPLOYMENT_SITES = {
  "vercel.com": "Vercel",
  "netlify.com": "Netlify",
  "pages.github.com": "GitHub Pages",
  "cloud.google.com": "Google Cloud Platform",
  "render.com": "Render",
};

/**
 * Detect the platform based on the given URL.
 * @param {string} url - The URL of the current tab.
 * @returns {string|null} - Returns the platform name or null if not found.
 */
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
});