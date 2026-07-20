const BrowserCrawler = require('./browser-base');

class DouyinBrowserCrawler extends BrowserCrawler {
  constructor() {
    super('douyin');
  }

  async crawl(competitor, options = {}) {
    const { startDate, endDate } = options;
    const secUid = competitor.platformAccounts?.douyin?.sec_uid;

    if (!secUid) {
      console.log(`[抖音] 竞品 ${competitor.name} 未配置抖音sec_uid，跳过`);
      return { posts: [], comments: [] };
    }

    console.log(`[抖音] 开始爬取 ${competitor.name} (sec_uid: ${secUid})`);
    const results = [];
    const comments = [];
    let apiPosts = [];

    try {
      const page = await require('../utils/browser').newPage();

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/aweme/v1/web/aweme/post/')) {
          try {
            const json = await response.json();
            if (json.aweme_list) {
              apiPosts = apiPosts.concat(json.aweme_list.map(a => ({
                post_id: a.aweme_id,
                title: (a.desc || '').slice(0, 80),
                content: a.desc || '',
                url: `https://www.douyin.com/video/${a.aweme_id}`,
                author: a.author?.nickname || competitor.name,
                publish_time: new Date(a.create_time * 1000).toISOString(),
                metrics: {
                  likes: a.statistics?.digg_count || 0,
                  comments: a.statistics?.comment_count || 0,
                  shares: a.statistics?.share_count || 0,
                  views: a.statistics?.play_count || 0,
                },
              })));
            }
          } catch {}
        }
      });

      await page.goto(`https://www.douyin.com/user/${secUid}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await page.waitForTimeout(3000);
      await this.scrollPage(page, 5);
      await page.waitForTimeout(3000);

      for (const p of apiPosts.slice(0, 3)) {
        if (p.metrics.comments > 0) {
          try {
            const cData = await page.evaluate(async (awemeId) => {
              try {
                const r = await fetch(`https://www.douyin.com/aweme/v1/web/comment/list/?aweme_id=${awemeId}&cursor=0&count=20`, { credentials: 'include' });
                const d = await r.json();
                return JSON.stringify(d.comments || []);
              } catch { return '[]'; }
            }, p.post_id);
            const cmts = JSON.parse(cData);
            for (const c of cmts) {
              comments.push({
                post_id: p.post_id,
                platform: 'douyin',
                comment_id: String(c.cid),
                content: c.text || '',
                author: c.user?.nickname || '',
                author_id: String(c.user?.uid || ''),
                publish_time: new Date(c.create_time * 1000).toISOString(),
                likes: c.digg_count || 0,
                replies: c.reply_comment_total || 0,
              });
            }
          } catch {}
        }
      }

      for (const p of apiPosts) {
        if (startDate && p.publish_time < startDate) continue;
        if (endDate && p.publish_time > endDate) continue;
        results.push(this.normalizePost(p));
      }

      console.log(`[抖音] ${competitor.name}: ${results.length} 条动态, ${comments.length} 条评论`);
      await page.close();
    } catch (e) {
      console.error(`[抖音] 爬取 ${competitor.name} 失败:`, e.message);
    }

    return { posts: results, comments };
  }
}

module.exports = DouyinBrowserCrawler;
