const BrowserCrawler = require('./browser-base');
const { getWbiKeys, signWbi } = require('../utils/wbi');
const axios = require('axios');

class BilibiliBrowserCrawler extends BrowserCrawler {
  constructor() {
    super('bilibili');
    this.httpAxios = axios.create({ timeout: 15000 });
  }

  async crawl(competitor, options = {}) {
    const results = [];
    const allComments = [];
    const uid = competitor.platformAccounts?.bilibili?.uid;
    const gameId = competitor.platformAccounts?.bilibili?.game_id;

    if (uid) {
      const r = await this.crawlChannel(uid, competitor, options);
      results.push(...r.posts);
      allComments.push(...(r.comments || []));
    }

    if (gameId) {
      const ids = String(gameId).split(',').map(s => s.trim()).filter(Boolean);
      for (const gid of ids) {
        const r = await this.crawlGamePage(gid, competitor, options);
        results.push(...(r.posts || r));
        allComments.push(...(r.comments || []));
      }
    }

    if (!uid && !gameId) {
      console.log(`[B站] 竞品 ${competitor.name} 未配置UID/game_id，跳过`);
    }

    console.log(`[B站] ${competitor.name} 获取到 ${results.length} 条动态`);
    return { posts: results, comments: allComments };
  }

  async crawlChannel(uid, competitor, { startDate, endDate }) {
    console.log(`[B站·官号] 开始爬取 ${competitor.name} (UID: ${uid})`);
    const results = [];
    const comments = [];

    try {
      const page = await require('../utils/browser').newPage();
      let apiPosts = [];

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('x/space') && (url.includes('arc/search') || url.includes('wbi/arc'))) {
          try {
            const json = await response.json();
            if (json.data?.list?.vlist) {
              for (const v of json.data.list.vlist) {
                const publishTime = new Date(v.created * 1000).toISOString();
                if (startDate && publishTime < startDate) continue;
                if (endDate && publishTime > endDate) continue;
                apiPosts.push({
                  post_id: `bl_ch_${v.bvid || v.aid}`,
                  aid: v.aid,
                  title: v.title,
                  content: v.description || '',
                  url: `https://www.bilibili.com/video/${v.bvid}`,
                  author: v.author,
                  publish_time: publishTime,
                  metrics: { views: v.play || 0, likes: v.favorites || 0, comments: v.comment || 0 },
                });
              }
            }
          } catch {}
        }
      });

      await this.navigateAndWait(page, `https://space.bilibili.com/${uid}/video`, 'iframe, .video-list, [class*="content"], .login-tip', 30000);
      await this.scrollPage(page, 4);
      await page.waitForTimeout(4000);

      if (apiPosts.length === 0) {
        console.log(`[B站] 浏览器拦截未获取到数据，尝试WBI签名请求...`);
        const cookies = await page.context().cookies('https://bilibili.com');
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        const wbiKey = await getWbiKeys(cookieStr);
        if (wbiKey) {
          let params = { mid: uid, ps: 50, pn: 1, order: 'pubdate' };
          params = signWbi(params, wbiKey);
          const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
          const data = await this.httpAxios.get(`https://api.bilibili.com/x/space/wbi/arc/search?${query}`, {
            headers: { Cookie: cookieStr, 'User-Agent': 'Mozilla/5.0', Referer: `https://space.bilibili.com/${uid}` },
          }).then(r => r.data).catch(() => null);
          if (data?.code === 0 && data.data?.list?.vlist) {
            for (const v of data.data.list.vlist) {
              const publishTime = new Date(v.created * 1000).toISOString();
              if (startDate && publishTime < startDate) continue;
              if (endDate && publishTime > endDate) continue;
              apiPosts.push({
                post_id: `bl_ch_${v.bvid || v.aid}`, aid: v.aid,
                title: v.title, content: v.description || '',
                url: `https://www.bilibili.com/video/${v.bvid}`,
                author: v.author, publish_time: publishTime,
                metrics: { views: v.play || 0, likes: v.favorites || 0, comments: v.comment || 0 },
              });
            }
            console.log(`[B站] WBI签名请求成功: ${apiPosts.length} 条`);
          } else {
            console.log(`[B站] WBI签名请求: code=${data?.code} msg=${data?.message}`);
          }
        }
      }

      // Fetch comments via page.evaluate for top videos
      for (const p of apiPosts.slice(0, 5)) {
        if (p.aid && p.metrics.comments > 0) {
          try {
            const cData = await page.evaluate(async (aid) => {
              try {
                const r = await fetch(`https://api.bilibili.com/x/v2/reply/main?oid=${aid}&type=1&ps=30`, { credentials: 'include' });
                const d = await r.json();
                return JSON.stringify(d.data?.replies || []);
              } catch { return '[]'; }
            }, p.aid);
            const replies = JSON.parse(cData);
            for (const c of replies) {
              comments.push({
                post_id: p.post_id,
                platform: 'bilibili',
                comment_id: String(c.rpid),
                content: c.content?.message || '',
                author: c.member?.uname || '',
                author_id: String(c.member?.mid || ''),
                publish_time: new Date(c.ctime * 1000).toISOString(),
                likes: c.like || 0,
                replies: c.rcount || 0,
              });
            }
          } catch {}
        }
      }

      for (const p of apiPosts) {
        results.push(this.normalizePost({ ...p, raw: { source: 'bilibili_channel', uid } }));
      }

      console.log(`[B站·官号] ${competitor.name}: ${results.length} 条视频, ${comments.length} 条评论`);

      await page.close();
    } catch (e) {
      console.error(`[B站·官号] 爬取失败:`, e.message);
    }
    return { posts: results, comments };
  }

  async crawlGamePage(gameId, competitor, { startDate, endDate }) {
    console.log(`[B站·游戏] 开始爬取 ${competitor.name} (GameID: ${gameId})`);
    const results = [];
    try {
      const page = await require('../utils/browser').newPage();
      const meta = await page.evaluate(async (gid) => {
        try {
          const r = await fetch(`https://api.biligame.com/pc/game/detail?game_id=${gid}`, { credentials: 'include' });
          const d = await r.json();
          if (d.code === 0 && d.data) return { score: d.data.score, review_count: d.data.review_count || d.data.comment_num || 0 };
        } catch {}
        return null;
      }, gameId);
      if (meta) {
        results.push(this.normalizePost({
          post_id: `bl_gm_${gameId}`, title: `B站游戏评分: ${meta.score}`,
          content: `评分: ${meta.score}/10 | 评价: ${meta.review_count}`,
          url: `https://www.biligame.com/detail/?id=${gameId}`,
          author: 'B站游戏中心', publish_time: new Date().toISOString(),
          metrics: { score: meta.score, review_count: meta.review_count },
          raw: { source: 'bilibili_game', gameId },
        }));
      }
      await page.close();
    } catch (e) {
      console.error(`[B站·游戏] 爬取失败:`, e.message);
    }
    console.log(`[B站·游戏] ${competitor.name} 获取到 ${results.length} 条记录`);
    return results;
  }
}

module.exports = BilibiliBrowserCrawler;
