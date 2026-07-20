const BrowserCrawler = require('./browser-base');

class XiaohongshuBrowserCrawler extends BrowserCrawler {
  constructor() {
    super('xiaohongshu');
  }

  async crawl(competitor, options = {}) {
    const { startDate, endDate } = options;
    const userId = competitor.platformAccounts?.xiaohongshu?.user_id;

    if (!userId) {
      console.log(`[小红书] 竞品 ${competitor.name} 未配置user_id，跳过`);
      return [];
    }

    console.log(`[小红书] 开始爬取 ${competitor.name} (user_id: ${userId})`);
    const results = [];
    let apiPosts = [];

    try {
      const page = await require('../utils/browser').newPage();

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/sns/web/v1/note/user/posted') || url.includes('user_posted')) {
          try {
            const json = await response.json();
            const notes = json.data?.notes || [];
            for (const n of notes) {
              const publishTime = new Date(n.time || n.last_update_time || Date.now()).toISOString();
              if (startDate && publishTime < startDate) continue;
              if (endDate && publishTime > endDate) continue;

              apiPosts.push({
                post_id: n.note_id || n.id,
                title: (n.display_title || n.title || '').slice(0, 80),
                content: n.desc || '',
                url: `https://www.xiaohongshu.com/explore/${n.note_id || n.id}`,
                author: n.user?.nickname || '',
                publish_time: publishTime,
                metrics: {
                  likes: n.interact_info?.liked_count || 0,
                  comments: n.interact_info?.comment_count || 0,
                  shares: n.interact_info?.share_count || 0,
                  collects: n.interact_info?.collected_count || 0,
                },
              });
            }
          } catch {}
        }
      });

      await this.navigateAndWait(page, `https://www.xiaohongshu.com/user/profile/${userId}`, '[class*="note"], section, a[href*="explore"]', 30000);
      await this.scrollPage(page, 8);
      await page.waitForTimeout(5000);

      for (const p of apiPosts) {
        results.push(this.normalizePost(p));
      }

      await page.close();
    } catch (e) {
      console.error(`[小红书] 爬取失败:`, e.message);
    }

    console.log(`[小红书] ${competitor.name} 获取到 ${results.length} 条笔记`);
    return results;
  }
}

module.exports = XiaohongshuBrowserCrawler;
