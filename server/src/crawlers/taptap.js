const BrowserCrawler = require('./browser-base');

class TapTapBrowserCrawler extends BrowserCrawler {
  constructor() {
    super('taptap');
  }

  async crawl(competitor, options = {}) {
    const { startDate, endDate } = options;
    const appId = competitor.platformAccounts?.taptap?.app_id;

    if (!appId) {
      console.log(`[TapTap] 竞品 ${competitor.name} 未配置TapTap AppID，跳过`);
      return [];
    }

    console.log(`[TapTap] 开始爬取 ${competitor.name} (AppID: ${appId})`);
    const results = [];
    let apiPosts = [];

    try {
      const page = await require('../utils/browser').newPage();

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/webapiv2/') && (url.includes('feed') || url.includes('news') || url.includes('moment') || url.includes(appId))) {
          try {
            const json = await response.json();
            const list = json.data?.list || json.data?.data || json.data || [];
            const items = Array.isArray(list) ? list : [];
            for (const item of items) {
              const news = item.moment || item.news || item;
              if (!news || !news.id) continue;
              const ts = news.published_time || news.created_time || news.publish_time || 0;
              const publishTime = new Date(ts * 1000).toISOString();
              if (startDate && publishTime < startDate) continue;
              if (endDate && publishTime > endDate) continue;

              apiPosts.push({
                post_id: String(news.id),
                title: (news.title || news.contents?.text || news.content || '').slice(0, 80),
                content: news.contents?.text || news.content || news.description || '',
                url: news.share_url || `https://www.taptap.cn/app/${appId}`,
                author: '官方',
                publish_time: publishTime,
                metrics: {
                  likes: news.likes_count || news.like_count || 0,
                  comments: news.comments_count || 0,
                  shares: news.share_count || 0,
                },
              });
            }
          } catch {}
        }
      });

      await this.navigateAndWait(page, `https://www.taptap.cn/app/${appId}`, '[class*="feed"], [class*="moment"]', 30000);
      await this.scrollPage(page, 6);
      await page.waitForTimeout(3000);

      for (const p of apiPosts) {
        results.push(this.normalizePost(p));
      }

      await page.close();
    } catch (e) {
      console.error(`[TapTap] 爬取失败:`, e.message);
    }

    console.log(`[TapTap] ${competitor.name} 获取到 ${results.length} 条动态`);
    return results;
  }
}

module.exports = TapTapBrowserCrawler;
