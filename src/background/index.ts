const DEFAULT_PROVIDER = 'groq';

// Allow users to open the side panel by clicking the extension icon.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to configure side panel behavior', error));

function ensureDefaultSettings(): void {
  chrome.storage.local.get(['provider'], (result) => {
    if (!result.provider) {
      chrome.storage.local.set({ provider: DEFAULT_PROVIDER });
    }
  });
}

// Initialize defaults on install and on worker startup so reset states recover cleanly.
chrome.runtime.onInstalled.addListener(() => {
  ensureDefaultSettings();
});

ensureDefaultSettings();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'OPEN_SIDE_PANEL') {
    return false;
  }

  const tabId = sender.tab?.id;

  if (!tabId) {
    sendResponse({ success: false, error: 'No active tab available.' });
    return false;
  }

  chrome.sidePanel
    .open({ tabId })
    .then(() => sendResponse({ success: true }))
    .catch((error) => {
      console.error('Failed to open side panel', error);
      sendResponse({ success: false, error: error.message });
    });

  return true;
});
