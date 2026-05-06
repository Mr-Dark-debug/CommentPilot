console.log('CommentPilot content script loaded');

type PageContextType = 'post' | 'profile' | 'unknown';
type ComposeMode = 'comment' | 'reply' | 'message';

interface ExtractedContext {
  type: PageContextType;
  content: string;
  author: string;
  url: string;
}

interface PendingComposeContext {
  mode: ComposeMode;
  contextText: string;
  commentText?: string;
  author?: string;
  url: string;
  source: 'linkedin-inline';
  timestamp: number;
}

const HOST_ATTR = 'data-commentpilot-host';
const HOST_KIND_ATTR = 'data-commentpilot-kind';
const POST_SELECTOR = 'div[role="listitem"]';
const COMMENT_SELECTOR = '[componentkey*="replaceableComment_"]';
const TEXT_BOX_SELECTOR = '[data-testid="expandable-text-box"]';

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'GET_PAGE_CONTEXT') {
    try {
      sendResponse({ success: true, data: extractPageContext() });
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }

  return true;
});

function extractPageContext(): ExtractedContext {
  const url = window.location.href;
  const isProfile = url.includes('/in/');
  const isPost = url.includes('/posts/') || url.includes('/feed/update/');
  const isFeed = url.includes('/feed/') && !isPost;

  if (isProfile) {
    return extractProfileContext(url);
  }

  if (isPost || isFeed) {
    const bestPost = findBestPostCandidate();
    if (bestPost) {
      const postData = extractPostData(bestPost);
      if (postData.content) {
        return { type: 'post', content: postData.content, author: postData.author, url };
      }
    }
  }

  const selection = normalizeText(window.getSelection()?.toString() || '');
  if (selection) {
    return { type: 'post', content: selection, author: '', url };
  }

  return { type: 'unknown', content: '', author: '', url };
}

function extractProfileContext(url: string): ExtractedContext {
  const nameEl = document.querySelector('h1');
  const headlineEl = document.querySelector('.text-body-medium');
  const aboutEl = document.querySelector('#about')?.closest('section')?.querySelector('.display-flex');

  const author = normalizeText(nameEl?.textContent || '');
  const headline = normalizeText(headlineEl?.textContent || '');
  const about = normalizeText(aboutEl?.textContent || '').slice(0, 1000);
  const content = `Name: ${author}\nHeadline: ${headline}\nAbout: ${about}`.trim();

  return { type: 'profile', content, author, url };
}

function findBestPostCandidate(): HTMLElement | null {
  const posts = Array.from(document.querySelectorAll<HTMLElement>(POST_SELECTOR)).filter((post) =>
    looksLikeFeedPost(post)
  );

  if (!posts.length) {
    return null;
  }

  const visiblePost = posts.find((post) => isNearViewport(post));
  return visiblePost || posts[0];
}

function looksLikeFeedPost(element: HTMLElement): boolean {
  return Boolean(findLabeledControl(element, 'Like')) &&
    Boolean(findLabeledControl(element, 'Comment')) &&
    Boolean(findLabeledControl(element, 'Repost'));
}

function isNearViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight * 0.9;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isCommentElement(element: Element): boolean {
  return Boolean(element.closest(COMMENT_SELECTOR));
}

function extractPostData(postElement: HTMLElement): { content: string; author: string } {
  const textBoxes = Array.from(postElement.querySelectorAll<HTMLElement>(TEXT_BOX_SELECTOR))
    .filter((box) => !isCommentElement(box))
    .map((box) => normalizeText(box.textContent || ''))
    .filter((text) => text.length > 20);

  const content = textBoxes[0] || '';
  const author = extractAuthorName(postElement);

  return { content, author };
}

function extractCommentData(commentElement: HTMLElement): { content: string; author: string } {
  const content = normalizeText(
    commentElement.querySelector<HTMLElement>(TEXT_BOX_SELECTOR)?.textContent || ''
  );
  const author = extractAuthorName(commentElement);

  return { content, author };
}

function extractAuthorName(root: HTMLElement): string {
  const linkedAuthor = root.querySelector<HTMLElement>(
    'a[href*="/in/"] strong, a[href*="/company/"] strong, a[href*="/school/"] strong'
  );
  if (linkedAuthor) {
    return normalizeText(linkedAuthor.textContent || '');
  }

  const namedLink = root.querySelector<HTMLElement>('a[href*="/in/"], a[href*="/company/"], a[href*="/school/"]');
  return normalizeText(namedLink?.textContent || '');
}

function findLabeledControl(root: HTMLElement, label: string): HTMLElement | null {
  const controls = Array.from(root.querySelectorAll<HTMLElement>('button, a, [role="button"]'));
  return (
    controls.find((control) => {
      if (control.closest(`[${HOST_ATTR}]`)) {
        return false;
      }

      const ariaLabel = control.getAttribute('aria-label') || '';
      const text = normalizeText(control.textContent || '');

      return ariaLabel.includes(label) || text === label || text.startsWith(label);
    }) || null
  );
}

function findSharedActionBar(root: HTMLElement, labels: string[]): HTMLElement | null {
  const controls = labels
    .map((label) => findLabeledControl(root, label))
    .filter(Boolean) as HTMLElement[];

  if (controls.length !== labels.length) {
    return null;
  }

  let current: HTMLElement | null = controls[0];
  while (current && current !== root) {
    if (controls.every((control) => current?.contains(control))) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

async function openComposer(context: PendingComposeContext): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ pendingComposeContext: context }, () => resolve());
  });

  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ action: 'OPEN_SIDE_PANEL' }, () => {
      if (chrome.runtime.lastError) {
        console.error('CommentPilot failed to open side panel', chrome.runtime.lastError.message);
      }
      resolve();
    });
  });
}

function createInlineAction(kind: 'post' | 'comment', onClick: () => Promise<void>): HTMLElement {
  const host = document.createElement('div');
  host.setAttribute(HOST_ATTR, 'true');
  host.setAttribute(HOST_KIND_ATTR, kind);
  host.style.display = 'block';
  host.style.marginTop = kind === 'post' ? '8px' : '6px';

  const shadow = host.attachShadow({ mode: 'open' });
  const wrapper = document.createElement('div');
  const button = document.createElement('button');

  const baseLabel = kind === 'post' ? 'AI Comment' : 'AI Reply';
  button.type = 'button';
  button.textContent = baseLabel;
  button.setAttribute('aria-label', baseLabel);

  const style = document.createElement('style');
  style.textContent = `
    .cp-wrap {
      display: inline-flex;
      align-items: center;
    }

    .cp-button {
      appearance: none;
      border: 1px solid #0a66c2;
      background: linear-gradient(180deg, #ffffff 0%, #f4f9ff 100%);
      color: #0a66c2;
      border-radius: 999px;
      padding: 6px 12px;
      font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
      transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }

    .cp-button:hover {
      background: #eaf4ff;
      box-shadow: 0 3px 10px rgba(10, 102, 194, 0.18);
      transform: translateY(-1px);
    }

    .cp-button:active {
      transform: translateY(0);
    }

    .cp-button:disabled {
      cursor: wait;
      opacity: 0.72;
      transform: none;
      box-shadow: none;
    }
  `;

  button.className = 'cp-button';
  wrapper.className = 'cp-wrap';
  wrapper.appendChild(button);
  shadow.append(style, wrapper);

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Opening...';

    try {
      await onClick();
      button.textContent = 'Ready';
      window.setTimeout(() => {
        button.textContent = baseLabel;
        button.disabled = false;
      }, 900);
    } catch (error) {
      console.error('CommentPilot inline action failed', error);
      button.textContent = baseLabel;
      button.disabled = false;
    }
  });

  return host;
}

function mountPostAction(postElement: HTMLElement): void {
  const actionBar = findSharedActionBar(postElement, ['Like', 'Comment', 'Repost']);
  if (!actionBar || actionBar.nextElementSibling?.hasAttribute(HOST_ATTR)) {
    return;
  }

  const host = createInlineAction('post', async () => {
    const postData = extractPostData(postElement);
    if (!postData.content) {
      throw new Error('No post text found for inline comment generation.');
    }

    await openComposer({
      mode: 'comment',
      contextText: postData.content,
      author: postData.author,
      url: window.location.href,
      source: 'linkedin-inline',
      timestamp: Date.now()
    });
  });

  actionBar.insertAdjacentElement('afterend', host);
}

function mountCommentAction(commentElement: HTMLElement): void {
  const actionBar = findSharedActionBar(commentElement, ['Like', 'Reply']);
  if (!actionBar || actionBar.nextElementSibling?.hasAttribute(HOST_ATTR)) {
    return;
  }

  const host = createInlineAction('comment', async () => {
    const commentData = extractCommentData(commentElement);
    const postElement = commentElement.closest<HTMLElement>(POST_SELECTOR) || findBestPostCandidate();
    const postData = postElement ? extractPostData(postElement) : { content: '', author: '' };

    if (!commentData.content) {
      throw new Error('No comment text found for inline reply generation.');
    }

    await openComposer({
      mode: 'reply',
      contextText: postData.content,
      commentText: commentData.content,
      author: commentData.author || postData.author,
      url: window.location.href,
      source: 'linkedin-inline',
      timestamp: Date.now()
    });
  });

  actionBar.insertAdjacentElement('afterend', host);
}

function scanAndMountInlineActions(): void {
  Array.from(document.querySelectorAll<HTMLElement>(POST_SELECTOR))
    .filter((post) => looksLikeFeedPost(post))
    .forEach((post) => mountPostAction(post));

  Array.from(document.querySelectorAll<HTMLElement>(COMMENT_SELECTOR))
    .forEach((comment) => mountCommentAction(comment));
}

let scanQueued = false;

function queueInlineActionScan(): void {
  if (scanQueued) {
    return;
  }

  scanQueued = true;
  window.requestAnimationFrame(() => {
    scanQueued = false;
    scanAndMountInlineActions();
  });
}

const observer = new MutationObserver(() => {
  queueInlineActionScan();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

queueInlineActionScan();
