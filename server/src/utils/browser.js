const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROME_USER_DATA = path.join(
  process.env.LOCALAPPDATA || '',
  'Google', 'Chrome', 'User Data'
);

const PROFILE_DIR = path.join(__dirname, '..', '..', 'data', 'browser-profile');
const SESSION_FLAG = path.join(PROFILE_DIR, '.session_ready');

let browserContext = null;

function copyChromeProfile() {
  if (fs.existsSync(SESSION_FLAG)) return;

  console.log('[浏览器] 首次启动，正在复制 Chrome 登录态...');

  if (!fs.existsSync(CHROME_USER_DATA)) {
    console.log('[浏览器] 未检测到 Chrome 用户数据，将使用空白会话');
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
    fs.writeFileSync(SESSION_FLAG, 'new');
    return;
  }

  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const filesToCopy = [
    'Local State',
    path.join('Default', 'Cookies'),
    path.join('Default', 'Cookies-journal'),
    path.join('Default', 'Login Data'),
    path.join('Default', 'Login Data-journal'),
    path.join('Default', 'Preferences'),
    path.join('Default', 'Web Data'),
    path.join('Default', 'Web Data-journal'),
  ];

  for (const f of filesToCopy) {
    const src = path.join(CHROME_USER_DATA, f);
    const dst = path.join(PROFILE_DIR, f);
    try {
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
      }
    } catch (e) {
      console.warn(`[浏览器] 复制 ${f} 失败:`, e.message);
    }
  }

  const localStorageSrc = path.join(CHROME_USER_DATA, 'Default', 'Local Storage');
  const localStorageDst = path.join(PROFILE_DIR, 'Default', 'Local Storage');
  if (fs.existsSync(localStorageSrc)) {
    try {
      fs.cpSync(localStorageSrc, localStorageDst, { recursive: true });
    } catch (e) {
      console.warn('[浏览器] 复制 Local Storage 失败:', e.message);
    }
  }

  fs.writeFileSync(SESSION_FLAG, 'ok');
  console.log('[浏览器] Chrome 登录态复制完成');
}

async function getBrowserContext({ headless = true, loginMode = false } = {}) {
  if (browserContext) {
    try {
      const pages = browserContext.pages();
      if (pages.length > 0 && !pages[0].isClosed()) return browserContext;
    } catch {}
    browserContext = null;
  }

  copyChromeProfile();

  const isHeadless = loginMode ? false : headless;

  console.log(`[浏览器] 启动 Chromium (headless=${isHeadless})...`);

  browserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: isHeadless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  });

  console.log('[浏览器] 启动完成');
  return browserContext;
}

async function closeBrowser() {
  if (browserContext) {
    try {
      await browserContext.close();
    } catch {}
    browserContext = null;
  }
}

async function newPage() {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  return page;
}

module.exports = { getBrowserContext, closeBrowser, newPage };
