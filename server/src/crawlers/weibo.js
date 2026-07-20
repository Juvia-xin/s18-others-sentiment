const BrowserCrawler = require('./browser-base');

class WeiboBrowserCrawler extends BrowserCrawler {
  constructor() {
    super('weibo');
  }

  async crawl(competitor, options = {}) {
    const { startDate, endDate } = options;
    const uid = competitor.platformAccounts?.weibo?.uid;

    if (!uid) {
      console.log(`[微博] 竞品 ${competitor.name} 未配置微博UID，跳过`);
      return [];
    }

    console.log(`[微博] 开始爬取 ${competitor.name} (UID: ${uid})`);
    const results = [];
    const comments = [];

    try {
      const page = await require('../utils/browser').newPage();

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('mymblog') || url.includes('getIndex') || url.includes('profile/statuses')) {
          try {
            const json = await response.json();
            const rawList = json.data?.list || json.data?.cards || [];
            for (const item of rawList) {
              const mblog = item.mblog || item.card_group?.[0]?.mblog || item;
              if (!mblog) continue;
              if (item.card_type && item.card_type !== 9) continue;

              results.push({
                post_id: mblog.id || mblog.mid,
                title: ((mblog.text_raw || mblog.text || '').replace(/<[^>]+>/g, '')).slice(0, 80),
                content: (mblog.text_raw || mblog.text || '').replace(/<[^>]+>/g, ''),
                url: `https://m.weibo.cn/detail/${mblog.id || mblog.mid}`,
                author: mblog.user?.screen_name || competitor.name,
                publish_time: mblog.created_at || json.created_at,
                metrics: {
                  reposts: mblog.reposts_count || 0,
                  comments: mblog.comments_count || 0,
                  likes: mblog.attitudes_count || 0,
                },
              });
            }
          } catch {}
        }
        if (url.includes('/comments/hotflow')) {
          const midMatch = url.match(/mid=(\d+)/);
          const postId = midMatch ? midMatch[1] : '';
          try {
            const json = await response.json();
            if (json.data?.data) {
              for (const c of (json.data.data || [])) {
                comments.push({
                  post_id: postId,
                  platform: 'weibo',
                  comment_id: String(c.id),
                  content: (c.text || '').replace(/<[^>]+>/g, ''),
                  author: c.user?.screen_name || '',
                  author_id: String(c.user?.id || ''),
                  publish_time: c.created_at,
                  likes: c.like_count || 0,
                  replies: c.total_number || 0,
                });
              }
            }
          } catch {}
        }
      });

      await page.route('**/*.{png,jpg,jpeg,gif,svg,mp4,woff2}', route => route.abort());

      await page.goto(`https://m.weibo.cn/u/${uid}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await page.waitForTimeout(5000);
      await this.scrollPage(page, 4);
      await page.waitForTimeout(3000);

      if (results.length > 0) {
        const postsToVisit = results.slice(0, 5);
        for (const post of postsToVisit) {
          const detailUrl = `https://m.weibo.cn/detail/${post.post_id}`;
          try {
            await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(3000);
            await page.evaluate(() => window.scrollBy(0, 500));
            await page.waitForTimeout(2000);
            await page.evaluate(() => window.scrollBy(0, 1000));
            await page.waitForTimeout(2000);
          } catch { continue; }
        }
      }

      for (const p of results) {
        const publishTime = this.parseTime(p.publish_time);
        if (startDate && publishTime && publishTime < startDate) continue;
        if (endDate && publishTime && publishTime > endDate) continue;
        p.publish_time = publishTime;
      }

      console.log(`[微博] ${competitor.name}: ${results.length} 条动态, ${comments.length} 条评论`);
      await page.close();
    } catch (e) {
      console.error(`[微博] 爬取 ${competitor.name} 失败:`, e.message);
    }

    return { posts: results, comments };
  }

  parseTime(timeText) {
    if (!timeText) return null;
    try {
      const d = new Date(timeText);
      if (!isNaN(d.getTime())) return d.toISOString();
      if (timeText.includes('分钟前')) {
        const min = parseInt(timeText) || 0;
        return new Date(Date.now() - min * 60000).toISOString();
      }
      if (timeText.includes('小时前')) {
        const h = parseInt(timeText) || 0;
        return new Date(Date.now() - h * 3600000).toISOString();
      }
    } catch {}
    return null;
  }
}

module.exports = WeiboBrowserCrawler;
