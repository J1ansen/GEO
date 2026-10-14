export class CollectionError extends Error {
  constructor(code, message, pause = true) { super(message); this.code = code; this.pause = pause; }
}

export const adapters = {
  chatgpt: {
    id: 'chatgpt', revision: 'candidate-20261013-1', live_verified: false, url: 'https://chatgpt.com/', host: 'chatgpt.com',
    composer: '#prompt-textarea, textarea[data-testid="prompt-textarea"]',
    users: '[data-message-author-role="user"]', answers: '[data-message-author-role="assistant"]',
    signedIn: '[data-testid="accounts-profile-button"], button[aria-label="Open profile menu"], button[aria-label="Open user menu"]',
    stop: '[data-testid="stop-button"], button[aria-label="Stop generating"], button[aria-label="Stop streaming"]',
    selectedSearch: '[data-testid="composer-button-search"][aria-pressed="true"], button[aria-label="Search"][aria-pressed="true"]',
    model: '[data-testid="model-switcher-dropdown-button"]',
  },
  gemini: {
    id: 'gemini', revision: 'candidate-20261013-1', live_verified: false, url: 'https://gemini.google.com/app', host: 'gemini.google.com',
    composer: 'rich-textarea [contenteditable="true"], textarea[aria-label="Enter a prompt here"], div[role="textbox"][contenteditable="true"]',
    users: 'user-query', answers: 'model-response',
    signedIn: 'a[href*="SignOutOptions"], button[aria-label^="Google Account"], a[aria-label^="Google Account"], button[aria-label^="Google 账号"]',
    stop: 'button[aria-label="Stop response"], button[aria-label="Stop generating"]',
    selectedSearch: 'button[aria-label="Deep Research"][aria-pressed="true"]',
    model: '[data-test-id="bard-mode-menu-button"], [data-testid="model-selector"]',
  },
};

export function adapterFor(platform, fixtureOrigin) {
  const adapter = adapters[platform];
  if (!adapter) throw new Error('未知平台。');
  if (!fixtureOrigin) return adapter;
  const url = new URL(fixtureOrigin);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol !== 'http:') throw new Error('测试页面只能使用本机回环地址。');
  return { ...adapter, revision: 'local-fixture-v1', url: `${url.origin}/${platform}`, host: url.hostname, fixture: true };
}

export async function firstVisible(page, selector) {
  const items = page.locator(selector);
  for (let index = 0; index < await items.count(); index++) if (await items.nth(index).isVisible()) return items.nth(index);
  return null;
}
export async function detectBlocker(page, adapter) {
  const current = new URL(page.url());
  if (current.hostname !== adapter.host) return new CollectionError('login_required', '页面进入登录或其他站点，需要维护测试账号。');
  for (const frame of page.frames()) {
    if (frame.parentFrame() && /recaptcha|hcaptcha|challenges\.cloudflare/i.test(frame.url())) {
      const element = await frame.frameElement();
      if (await element.isVisible()) return new CollectionError('verification_required', '检测到验证组件，请人工维护账号后恢复。');
    }
  }
  const text = await page.locator('body').evaluate((body, selectors) => {
    const copy = body.cloneNode(true);
    for (const node of copy.querySelectorAll(`${selectors.users}, ${selectors.answers}, script, style`)) node.remove();
    return copy.textContent;
  }, { users: adapter.users, answers: adapter.answers });
  if (/verify (?:that )?you are human|unusual traffic|checking your browser|complete (?:the|this) security check|请完成验证|异常流量/i.test(text)) return new CollectionError('verification_required', '检测到验证页面，已暂停。');
  if (/you(?:’|')ve reached[^\n]{0,100}(?:limit|maximum)|you have reached[^\n]{0,100}(?:limit|maximum)|usage limit reached|try again (?:tomorrow|in \d)|达到.{0,15}(?:上限|限额)|已达.{0,15}上限/i.test(text)) return new CollectionError('quota_exhausted', '账号额度不足，需等待额度恢复。');
  if (/log in to continue|sign in to (?:continue|chat)|登录以继续|登录后继续/i.test(text)) return new CollectionError('login_required', '需要登录。');
  return null;
}
export async function prepareConversation(page, adapter) {
  await page.goto(adapter.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const initialBlocker = await detectBlocker(page, adapter);
  if (initialBlocker) throw initialBlocker;
  await page.locator(adapter.composer).first().waitFor({ state: 'visible', timeout: 30000 }).catch(async () => {
    throw await detectBlocker(page, adapter) ?? new CollectionError('ui_changed', '未找到输入框；需要检查页面选择器。');
  });
  const blocker = await detectBlocker(page, adapter);
  if (blocker) throw blocker;
  if (!await firstVisible(page, adapter.signedIn)) throw new CollectionError('account_unverified', '未检测到已登录账号标识；不在游客模式自动发问。');
  if (await page.locator(adapter.users).count() || await page.locator(adapter.answers).count()) throw new CollectionError('not_new_conversation', '页面已有聊天内容，不能作为新会话样本。');
  if (await firstVisible(page, adapter.selectedSearch)) throw new CollectionError('mode_mismatch', '发现已选中的搜索或研究模式，请恢复默认聊天。');
  const composer = await firstVisible(page, adapter.composer);
  if (!composer) throw new CollectionError('ui_changed', '未找到可操作输入框。');
  return composer;
}
export async function collectAnswer(page, adapter, { timeoutMs, stableMs, pollMs, signal }) {
  const started = Date.now();
  let last = '', stableSince = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (signal?.aborted) throw new CollectionError('interrupted', '用户停止了本次运行。');
    const blocker = await detectBlocker(page, adapter);
    if (blocker) throw blocker;
    const answers = page.locator(adapter.answers);
    let text = '';
    if (await answers.count()) text = (await answers.last().innerText()).trim();
    if (text !== last) { last = text; stableSince = Date.now(); }
    const busy = await firstVisible(page, adapter.stop);
    if (text && !busy && Date.now() - stableSince >= stableMs) {
      const answer = answers.last();
      const links = await answer.locator('a[href]').evaluateAll(elements => elements.map(a => ({ url: a.href, label: a.innerText })));
      const citations = links.filter(link => { try { const u = new URL(link.url); return ['http:', 'https:'].includes(u.protocol) && u.hostname !== adapter.host; } catch { return false; } });
      return {
        text, answer_html: await answer.evaluate(element => element.outerHTML),
        citations: [...new Map(citations.map(link => [link.url, link])).values()],
        citation_capture: 'visible_external_anchors_only; collapsed source panels are not expanded',
        observed_model_label: await firstVisible(page, adapter.model).then(async el => el ? (await el.innerText()).trim() || null : null),
        actual_search: 'unknown', actual_search_basis: 'Citations alone do not prove search execution; no provider network internals collected.',
        completion_basis: 'nonempty_answer_stable_and_no_visible_stop_control',
      };
    }
    await page.waitForTimeout(pollMs);
  }
  throw new CollectionError('answer_timeout', '未能在时限内确认完整回答；不保存为成功样本。', false);
}
