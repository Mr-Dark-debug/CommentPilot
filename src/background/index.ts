// Background Script

// Allow users to open the side panel by clicking the extension icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Initialize default settings on install if not present
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['provider', 'model'], (result) => {
    if (!result.provider) {
      chrome.storage.local.set({ provider: 'groq' });
    }
    if (!result.model) {
      chrome.storage.local.set({ model: 'llama3-8b-8192' });
    }
  });
});
