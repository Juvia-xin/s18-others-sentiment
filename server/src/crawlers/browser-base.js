const { newPage, closeBrowser } = require('../utils/browser');

class BrowserCrawler {
  constructor(platform) {
    this.platform = platform;
  }

  async crawl(competitor, options = {}) {
    throw new Error('子类必须实现 crawl 方法');
  }

  normalizePost(raw) {
    return {
      platform: this.platform,
      post_id: raw.post_id,
      title: raw.title || '',
      content: raw.content || '',
      url: raw.url || '',
      author: raw.author || '',
      publish_time: raw.publish_time,
      metrics: raw.metrics || {},
      raw: raw,
    };
  }

  async navigateAndWait(page, url, waitSelector, timeout = 30000) {
    console.log(`[${this.platform}] 导航: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout }).catch(() => {
        console.warn(`[${this.platform}] 等待选择器超时: ${waitSelector}`);
      });
    }
    await this.randomDelay(1000, 3000);
  }

  async randomDelay(min, max) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(r => setTimeout(r, ms));
  }

  async scrollPage(page, times = 5) {
    for (let i = 0; i < times; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
      await this.randomDelay(800, 2000);
    }
  }
}

module.exports = BrowserCrawler;
