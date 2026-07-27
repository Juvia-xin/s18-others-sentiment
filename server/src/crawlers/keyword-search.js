const { getWbiKeys, signWbi } = require('../utils/wbi');

class KeywordCrawler {
  constructor(cookie = '') {
    this.cookie = cookie || process.env.BILIBILI_COOKIE || '';
    this.wbiKey = '';
  }

  async ensureWbiKey() {
    if (!this.wbiKey) {
      this.wbiKey = await getWbiKeys(this.cookie);
    }
  }

  async searchBilibili(keyword, { startDate, endDate, gameNames } = {}) {
    console.log(`[关键词·B站] 搜索: ${keyword}`);
    const results = [];

    try {
      await this.ensureWbiKey();
      let params = { search_type: 'video', keyword, page: 1, page_size: 30 };
      if (this.wbiKey) params = signWbi(params, this.wbiKey);

      const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
      const axios = require('axios');
      const { data } = await axios.get(
        `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`,
        {
          headers: {
            Cookie: this.cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Referer: 'https://search.bilibili.com/',
          },
        }
      );

      if (data?.code === 0 && data.data?.result) {
        const checkNames = gameNames || [keyword];
        for (const r of (data.data.result || []).slice(0, 20)) {
          const pubTime = new Date(r.pubdate * 1000).toISOString();
          if (startDate && pubTime < startDate) continue;
          if (endDate && pubTime > endDate) continue;

          const fullText = ((r.title || '') + (r.description || '')).toLowerCase();
          const matched = checkNames.some(name => fullText.includes(name.toLowerCase()));
          if (!matched) continue;

          results.push({
            platform: 'bilibili',
            post_id: `kw_${r.bvid || r.aid}`,
            title: r.title || '',
            content: r.description || '',
            url: `https://www.bilibili.com/video/${r.bvid}`,
            author: r.author || '',
            publish_time: pubTime,
            metrics: {
              views: r.play || 0,
              likes: r.favorites || 0,
              comments: r.comment || 0,
            },
            source: 'keyword_search',
            keyword,
          });
        }
      }
    } catch (e) {
      console.error(`[关键词·B站] 搜索失败:`, e.message);
    }

    console.log(`[关键词·B站] ${keyword}: ${results.length} 条`);
    return results;
  }

  async searchXiaohongshu(keyword, { startDate, endDate } = {}) {
    console.log(`[关键词·小红书] 搜索: ${keyword}`);

    try {
      const { newPage } = require('../utils/browser');
      const page = await newPage();
      const results = [];
      let apiData = [];

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/sns/web/v1/search/notes')) {
          try {
            const json = await response.json();
            if (json.success && json.data?.items) {
              apiData = json.data.items.map(item => {
                const note = item.note_card || item;
                return {
                  platform: 'xiaohongshu',
                  post_id: note.note_id || note.id,
                  title: (note.display_title || note.title || '').slice(0, 80),
                  content: note.desc || '',
                  url: `https://www.xiaohongshu.com/explore/${note.note_id}`,
                  author: note.user?.nickname || '',
                  publish_time: new Date(note.time || Date.now()).toISOString(),
                  metrics: {
                    likes: note.interact_info?.liked_count || 0,
                    comments: note.interact_info?.comment_count || 0,
                  },
                  source: 'keyword_search',
                  keyword,
                };
              });
            }
          } catch {}
        }
      });

      await page.goto(
        `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&type=51`,
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );

      await page.waitForTimeout(4000);
      await page.evaluate(() => window.scrollBy(0, 2000));
      await page.waitForTimeout(2000);

      for (const r of apiData) {
        if (startDate && r.publish_time < startDate) continue;
        if (endDate && r.publish_time > endDate) continue;
        results.push(r);
      }

      await page.close();
      console.log(`[关键词·小红书] ${keyword}: ${results.length} 条`);
      return results;
    } catch (e) {
      console.error(`[关键词·小红书] 搜索失败:`, e.message);
      return [];
    }
  }

  async searchAll(keywords, options = {}) {
    const all = [];
    for (const kw of (keywords || [])) {
      const blResults = await this.searchBilibili(kw, options);
      all.push(...blResults);
    }
    for (const kw of (keywords || [])) {
      const xhsResults = await this.searchXiaohongshu(kw, options);
      all.push(...xhsResults);
    }
    return all;
  }
}

module.exports = KeywordCrawler;
