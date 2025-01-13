// Map of known deployment platforms
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
  const hostname = new URL(url).hostname;
  for (const site in DEPLOYMENT_SITES) {
    if (hostname.includes(site)) {
      return DEPLOYMENT_SITES[site];
    }
  }
  return null;
}

/**
 * Listener for tab updates.
 * Injects the content script and manages the side panel visibility based on the URL.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const platform = detectPlatform(tab.url);

    if (platform) {
      // Save the current platform to storage for other scripts to access
      await chrome.storage.local.set({ currentPlatform: platform });

      // Enable the side panel with the corresponding HTML path
      await chrome.sidePanel.setOptions({
        tabId,
        path: "sidepanel.html",
        enabled: true,
      });

      console.log(`[INFO] Platform detected: ${platform}`);
    } else {
      // Disable the side panel for unrelated pages
      await chrome.sidePanel.setOptions({ 
        tabId,
        path: "sidepanl.html",
        enabled: false });
      console.log("[INFO] No matching platform detected. Side panel disabled.");
    }
  }
});
