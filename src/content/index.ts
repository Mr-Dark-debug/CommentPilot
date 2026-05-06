import { generateCompletion } from '../lib/ai';
import {
  COMMENT_SYSTEM_PROMPT,
  REPLY_SYSTEM_PROMPT,
  buildCommentUserPrompt,
  buildReplyUserPrompt
} from '../lib/prompts';

console.log('CommentPilot content script loaded');

type PageContextType = 'post' | 'profile' | 'unknown';
type ComposeMode = 'comment' | 'reply' | 'message';
type InlineActionKind = 'post' | 'comment';

interface ExtractedContext {
  type: PageContextType;
  content: string;
  author: string;
  url: string;
}

const HOST_ATTR = 'data-commentpilot-host';
const HOST_KIND_ATTR = 'data-commentpilot-kind';
const ACTIVE_TARGET_ATTR = 'data-commentpilot-active-target';
const ACTIVE_MODE_ATTR = 'data-commentpilot-active-mode';
const POST_CONTAINER_SELECTORS = [
  'div[role="listitem"]',
  '.fie-impression-container',
  '.feed-shared-update-v2',
  '.feed-shared-update-v2__update-content-wrapper'
];
const COMMENT_CONTAINER_SELECTORS = [
  '[componentkey*="replaceableComment_"]',
  '.comments-comment-item',
  '.comments-comment-item__main-content',
  '.comments-comment-social-bar'
];
const TEXT_BOX_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '.update-components-text',
  '.comments-comment-item__main-content',
  '.comments-comment-item-content-body',
  '.comments-comment-item__comment-text'
];
const EDITABLE_SELECTORS = [
  'textarea',
  '[contenteditable="true"][role="textbox"]',
  '[contenteditable="true"]',
  'div[role="textbox"]'
];

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'GET_PAGE_CONTEXT') {
    try {
      sendResponse({ success: true, data: extractPageContext() });
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }

    return true;
  }

  if (request.action === 'APPLY_GENERATED_TEXT') {
    applyGeneratedTextToActiveComposer(request.mode, request.text)
      .then(() => sendResponse({ success: true }))
      .catch((error: any) => sendResponse({ success: false, error: error.message }));

    return true;
  }

  return false;
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
  const posts = Array.from(document.querySelectorAll<HTMLElement>(POST_CONTAINER_SELECTORS.join(','))).filter((post) =>
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

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isCommentElement(element: Element): boolean {
  return Boolean(element.closest(COMMENT_CONTAINER_SELECTORS.join(',')));
}

function extractPostData(postElement: HTMLElement): { content: string; author: string } {
  const textBoxes = Array.from(postElement.querySelectorAll<HTMLElement>(TEXT_BOX_SELECTORS.join(',')))
    .filter((box) => !isCommentElement(box))
    .map((box) => normalizeText(box.textContent || ''))
    .filter((text) => text.length > 20);

  const content = textBoxes[0] || '';
  const author = extractAuthorName(postElement);

  return { content, author };
}

function extractCommentData(commentElement: HTMLElement): { content: string; author: string } {
  const content = Array.from(commentElement.querySelectorAll<HTMLElement>(TEXT_BOX_SELECTORS.join(',')))
    .map((element) => normalizeText(element.textContent || ''))
    .find((text) => text.length > 0) || '';
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

function findCommentRootFromReplyControl(replyControl: HTMLElement): HTMLElement | null {
  let current = replyControl.parentElement;

  while (current && current !== document.body) {
    const textCandidate = extractCommentData(current).content;
    const hasReply = Boolean(findLabeledControl(current, 'Reply'));

    if (textCandidate && hasReply) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function findPostRootFromActionBar(actionBar: HTMLElement): HTMLElement | null {
  let current = actionBar.parentElement;

  while (current && current !== document.body) {
    const hasPostText = extractPostData(current).content;
    const hasMainActions = Boolean(findSharedActionBar(current, ['Like', 'Comment', 'Repost']));

    if (hasPostText && hasMainActions) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function findEditableCandidates(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(EDITABLE_SELECTORS.join(','))).filter((element) => {
    if (!isVisible(element)) {
      return false;
    }

    if (element.closest(`[${HOST_ATTR}]`)) {
      return false;
    }

    return true;
  });
}

function findComposerInRoot(root: HTMLElement, mode: ComposeMode): HTMLElement | null {
  const candidates = findEditableCandidates(root);
  if (!candidates.length) {
    return null;
  }

  const scored = candidates
    .map((candidate) => {
      const placeholder = normalizeText(
        candidate.getAttribute('aria-label') ||
        candidate.getAttribute('placeholder') ||
        candidate.textContent ||
        ''
      ).toLowerCase();
      const insideComment = Boolean(candidate.closest(COMMENT_CONTAINER_SELECTORS.join(',')));

      let score = 0;
      if (mode === 'reply') {
        if (insideComment) score += 3;
        if (placeholder.includes('reply')) score += 2;
      } else {
        if (!insideComment) score += 3;
        if (placeholder.includes('comment')) score += 2;
      }
      if (placeholder.includes('add a comment')) score += 2;
      if (candidate === document.activeElement) score += 1;

      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.candidate || null;
}

function clearActiveTargets(): void {
  document.querySelectorAll<HTMLElement>(`[${ACTIVE_TARGET_ATTR}]`).forEach((element) => {
    element.removeAttribute(ACTIVE_TARGET_ATTR);
    element.removeAttribute(ACTIVE_MODE_ATTR);
  });
}

function setActiveTarget(root: HTMLElement, mode: ComposeMode): void {
  clearActiveTargets();
  root.setAttribute(ACTIVE_TARGET_ATTR, 'true');
  root.setAttribute(ACTIVE_MODE_ATTR, mode);
}

function getActiveTarget(mode: ComposeMode): HTMLElement | null {
  const exactMatch = document.querySelector<HTMLElement>(`[${ACTIVE_TARGET_ATTR}="true"][${ACTIVE_MODE_ATTR}="${mode}"]`);
  if (exactMatch) {
    return exactMatch;
  }

  return document.querySelector<HTMLElement>(`[${ACTIVE_TARGET_ATTR}="true"]`);
}

async function waitForComposer(root: HTMLElement, mode: ComposeMode, timeoutMs = 4000): Promise<HTMLElement> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const composer = findComposerInRoot(root, mode);
    if (composer) {
      return composer;
    }

    await delay(120);
  }

  throw new Error(`LinkedIn did not open the ${mode} composer.`);
}

async function ensureComposer(root: HTMLElement, mode: ComposeMode, triggerControl?: HTMLElement): Promise<HTMLElement> {
  const existing = findComposerInRoot(root, mode);
  if (existing) {
    setActiveTarget(root, mode);
    return existing;
  }

  triggerControl?.click();
  setActiveTarget(root, mode);
  return waitForComposer(root, mode);
}

async function applyGeneratedTextToActiveComposer(mode: ComposeMode, text: string): Promise<void> {
  const targetRoot = getActiveTarget(mode);
  if (!targetRoot) {
    throw new Error('No active LinkedIn composer target was found.');
  }

  const composer = await ensureComposer(targetRoot, mode);
  insertTextIntoComposer(composer, text);
}

function insertTextIntoComposer(composer: HTMLElement, text: string): void {
  composer.focus();

  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(composer), 'value')?.set;
    setter?.call(composer, text);
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  let inserted = false;
  try {
    inserted = document.execCommand('selectAll', false) && document.execCommand('insertText', false, text);
  } catch {
    inserted = false;
  }

  if (!inserted || normalizeText(composer.textContent || '') !== normalizeText(text)) {
    composer.innerHTML = '';
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    composer.appendChild(paragraph);
  }

  composer.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
  composer.dispatchEvent(new Event('change', { bubbles: true }));
}

function pickBestGeneratedText(mode: ComposeMode, rawText: string): string {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      if (mode === 'reply') {
        const reply = parsed.conversational || parsed.concise || parsed.insightful;
        if (typeof reply === 'string' && reply.trim()) {
          return reply.trim();
        }
      }

      if (mode === 'comment') {
        const groups = ['medium', 'short', 'strong'] as const;
        for (const group of groups) {
          const items = parsed[group];
          if (Array.isArray(items)) {
            const firstText = items.find((item) => typeof item === 'string' && item.trim());
            if (typeof firstText === 'string') {
              return firstText.trim();
            }
          }
        }
      }
    } catch {
      // Fall back to plain text below.
    }
  }

  return cleaned;
}

async function generateInlineText(mode: ComposeMode, contextText: string, commentText: string): Promise<string> {
  if (mode === 'reply') {
    const prompt = buildReplyUserPrompt(contextText, commentText, 'Professional');
    const rawText = await generateCompletion(REPLY_SYSTEM_PROMPT, `${prompt}\nRequested Length: Short`);
    return pickBestGeneratedText(mode, rawText);
  }

  const prompt = buildCommentUserPrompt(contextText, 'Professional', 'High', 'Add value');
  const rawText = await generateCompletion(COMMENT_SYSTEM_PROMPT, `${prompt}\nRequested Length: Medium`);
  return pickBestGeneratedText(mode, rawText);
}

async function handleInlineGenerate(
  button: HTMLButtonElement,
  kind: InlineActionKind,
  targetRoot: HTMLElement,
  contextText: string,
  commentText: string,
  triggerControl?: HTMLElement
): Promise<void> {
  const mode: ComposeMode = kind === 'comment' ? 'reply' : 'comment';
  const baseLabel = kind === 'comment' ? 'AI Reply' : 'AI Comment';

  button.disabled = true;
  button.textContent = 'Opening...';

  try {
    await ensureComposer(targetRoot, mode, triggerControl);

    button.textContent = 'Generating...';
    const generatedText = await generateInlineText(mode, contextText, commentText);

    button.textContent = 'Applying...';
    await applyGeneratedTextToActiveComposer(mode, generatedText);

    button.textContent = 'Inserted';
    window.setTimeout(() => {
      button.textContent = baseLabel;
      button.disabled = false;
    }, 1200);
  } catch (error: any) {
    console.error('CommentPilot inline action failed', error);
    button.textContent = error?.message ? 'Try again' : baseLabel;
    window.setTimeout(() => {
      button.textContent = baseLabel;
      button.disabled = false;
    }, 1600);
  }
}

function createInlineAction(
  kind: InlineActionKind,
  onClick: (button: HTMLButtonElement) => Promise<void>
): HTMLElement {
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
    await onClick(button);
  });

  return host;
}

function mountPostAction(postElement: HTMLElement): void {
  const actionBar = findSharedActionBar(postElement, ['Like', 'Comment', 'Repost']);
  if (!actionBar || actionBar.nextElementSibling?.hasAttribute(HOST_ATTR)) {
    return;
  }

  const host = createInlineAction('post', async (button) => {
    const postData = extractPostData(postElement);
    if (!postData.content) {
      throw new Error('No post text found for inline comment generation.');
    }

    await handleInlineGenerate(
      button,
      'post',
      postElement,
      postData.content,
      '',
      findLabeledControl(postElement, 'Comment') || actionBar
    );
  });

  actionBar.insertAdjacentElement('afterend', host);
}

function mountCommentAction(commentElement: HTMLElement, replyControl?: HTMLElement): void {
  const actionBar = findSharedActionBar(commentElement, ['Like', 'Reply']);
  const anchor = replyControl || actionBar;

  if (!anchor) {
    return;
  }

  const siblingHost = replyControl ? replyControl.nextElementSibling : actionBar?.nextElementSibling;
  if (siblingHost?.hasAttribute(HOST_ATTR)) {
    return;
  }

  const host = createInlineAction('comment', async (button) => {
    const commentData = extractCommentData(commentElement);
    const postElement = commentElement.closest<HTMLElement>(POST_CONTAINER_SELECTORS.join(',')) || findBestPostCandidate();
    const postData = postElement ? extractPostData(postElement) : { content: '', author: '' };

    if (!commentData.content) {
      throw new Error('No comment text found for inline reply generation.');
    }

    await handleInlineGenerate(
      button,
      'comment',
      commentElement,
      postData.content,
      commentData.content,
      replyControl || findLabeledControl(commentElement, 'Reply') || actionBar
    );
  });

  if (replyControl) {
    host.style.display = 'inline-flex';
    host.style.marginTop = '0';
    host.style.marginLeft = '8px';
    replyControl.insertAdjacentElement('afterend', host);
    return;
  }

  actionBar.insertAdjacentElement('afterend', host);
}

function mountCommentComposerAction(postElement: HTMLElement, composer: HTMLElement): void {
  const container =
    composer.closest<HTMLElement>('form') ||
    composer.closest<HTMLElement>('.comments-comment-box') ||
    composer.parentElement;

  if (!container || container.querySelector(`:scope > [${HOST_ATTR}="${'true'}"][${HOST_KIND_ATTR}="post"]`)) {
    return;
  }

  const host = createInlineAction('post', async (button) => {
    const postData = extractPostData(postElement);
    if (!postData.content) {
      throw new Error('No post text found for inline comment generation.');
    }

    setActiveTarget(postElement, 'comment');
    await handleInlineGenerate(button, 'post', postElement, postData.content, '', findLabeledControl(postElement, 'Comment') || composer);
  });

  host.style.marginTop = '8px';
  container.appendChild(host);
}

function scanAndMountInlineActions(): void {
  const postActionBars = Array.from(document.querySelectorAll<HTMLElement>('.feed-shared-social-action-bar'));
  postActionBars.forEach((actionBar) => {
    const postElement = findPostRootFromActionBar(actionBar);
    if (postElement) {
      mountPostAction(postElement);
    }
  });

  const explicitComments = Array.from(document.querySelectorAll<HTMLElement>(COMMENT_CONTAINER_SELECTORS.join(',')));
  explicitComments.forEach((comment) => mountCommentAction(comment));

  const replyControls = Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"]')).filter((control) => {
    if (control.closest(`[${HOST_ATTR}]`)) {
      return false;
    }

    const ariaLabel = control.getAttribute('aria-label') || '';
    const text = normalizeText(control.textContent || '');
    return ariaLabel.includes('Reply') || text === 'Reply' || text.startsWith('Reply');
  });

  replyControls.forEach((replyControl) => {
    const commentRoot = findCommentRootFromReplyControl(replyControl);
    if (commentRoot) {
      mountCommentAction(commentRoot, replyControl);
    }
  });

  const visiblePost = findBestPostCandidate();
  if (visiblePost) {
    const commentComposer = findComposerInRoot(visiblePost, 'comment');
    if (commentComposer && !commentComposer.closest(COMMENT_CONTAINER_SELECTORS.join(','))) {
      mountCommentComposerAction(visiblePost, commentComposer);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
