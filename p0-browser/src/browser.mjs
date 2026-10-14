import { existsSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function loadPlaywright() {
  try { return await import('playwright'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
  const candidates = [
    process.env.GEO_PLAYWRIGHT_MODULE,
    path.resolve(root, '../sources/Elmo/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs'),
  ].filter(Boolean);
  for (const candidate of candidates) if (existsSync(candidate)) return import(pathToFileURL(candidate).href);
  throw new Error('未找到 Playwright。请在 p0-browser 中运行 pnpm install，再运行 pnpm exec playwright install chromium。');
}
export function browserExecutable(chromium) {
  if (process.env.GEO_BROWSER_EXECUTABLE) return process.env.GEO_BROWSER_EXECUTABLE;
  if (process.platform === 'win32') {
    const edge = path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe');
    if (existsSync(edge)) return edge;
  }
  const expected = chromium.executablePath();
  if (existsSync(expected)) return expected;
  // Windows app sandboxes redirect LOCALAPPDATA; reuse only the matching revision.
  const marker = `${path.sep}ms-playwright${path.sep}`;
  const index = expected.indexOf(marker);
  if (process.platform === 'win32' && index >= 0) {
    const cached = path.join(homedir(), 'AppData', 'Local', 'ms-playwright', expected.slice(index + marker.length));
    if (existsSync(cached)) return cached;
  }
  return expected;
}
export async function launchContext(rootDir, platform, { fixture = false } = {}) {
  const { chromium } = await loadPlaywright();
  const executablePath = browserExecutable(chromium);
  if (!existsSync(executablePath)) throw new Error('Chromium 不存在；请安装 Playwright Chromium 或设置 GEO_BROWSER_EXECUTABLE。');
  return chromium.launchPersistentContext(path.join(rootDir, 'private', fixture ? 'profiles-fixture' : 'profiles', platform), {
    executablePath, headless: fixture, locale: 'en-US', timezoneId: 'America/New_York',
    viewport: { width: 1360, height: 960 }, acceptDownloads: false,
  });
}
