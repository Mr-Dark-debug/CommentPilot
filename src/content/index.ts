// Content script to read data from LinkedIn DOM

console.log("CommentPilot Content Script Loaded");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PAGE_CONTEXT') {
    try {
      const context = extractPageContext();
      sendResponse({ success: true, data: context });
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // Keep channel open for async response if needed
});

function extractPageContext() {
  const url = window.location.href;
  const isProfile = url.includes('/in/');
  const isPost = url.includes('/posts/') || url.includes('/feed/update/');
  const isFeed = url.includes('/feed/') && !isPost; // General feed, harder to target single post

  let type: 'post' | 'profile' | 'unknown' = 'unknown';
  let content = '';
  let author = '';

  if (isProfile) {
    type = 'profile';
    // Attempt to extract profile details
    const nameEl = document.querySelector('h1');
    const headlineEl = document.querySelector('.text-body-medium');
    const aboutEl = document.querySelector('#about')?.closest('section')?.querySelector('.display-flex');

    author = nameEl ? nameEl.innerText.trim() : '';
    const headline = headlineEl ? headlineEl.innerText.trim() : '';
    const about = aboutEl ? aboutEl.textContent?.trim() || '' : '';

    content = `Name: ${author}\nHeadline: ${headline}\nAbout: ${about.substring(0, 1000)}`;
  } else if (isPost || isFeed) {
    type = 'post';
    // This is a naive extraction. LinkedIn DOM is highly dynamic.
    // Tries to find the most relevant post in view.

    // Find all post text bodies. If in feed, pick the first one visible or hovered,
    // for simplicity, we pick the first one with significant text.
    const postSpans = document.querySelectorAll('.update-components-text span[dir="ltr"]');

    for (let i = 0; i < postSpans.length; i++) {
        const text = postSpans[i].textContent?.trim() || '';
        if (text.length > 20) {
            content = text;
            break;
        }
    }

    // Attempt to find author of that post
    const authorSpan = document.querySelector('.update-components-actor__name');
    if (authorSpan) {
      author = authorSpan.querySelector('span[dir="ltr"]')?.textContent?.trim() || authorSpan.textContent?.trim() || '';
    }
  }

  // Fallback to selected text if specific selectors fail or user highlights something
  const selection = window.getSelection()?.toString().trim();
  if (selection && content.length < 10) {
      content = selection;
      type = 'post'; // Assume it's text they want to comment on
  }

  return { type, content, author, url };
}
