document.addEventListener('DOMContentLoaded', async () => {
  const button = document.getElementById('openSidePanel');
  const status = document.getElementById('status');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const { currentPlatform } = await chrome.storage.local.get('currentPlatform');
    
    if (currentPlatform) {
      status.textContent = `Current platform: ${currentPlatform}`;
      button.addEventListener('click', async () => {
        try {
          await chrome.sidePanel.open({ tabId: tab.id });
          window.close();
        } catch (error) {
          status.textContent = 'Error opening side panel';
          console.error('[ERROR]', error);
        }
      });
    } else {
      button.disabled = true;
      status.textContent = 'No deployment platform detected on this page';
    }
  } catch (error) {
    status.textContent = 'Error checking platform status';
    console.error('[ERROR]', error);
  }
});