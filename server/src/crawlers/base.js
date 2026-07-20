const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

class BaseCrawler {
  constructor(platform, cookie = '') {
    this.platform = platform;
    this.cookie = cookie;
    this.axios = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/json,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
  }

  async fetch(url, opts = {}) {
    try {
      const merged = { ...opts };
      if (!merged.headers) merged.headers = {};
      if (this.cookie && !merged.headers.Cookie) merged.headers.Cookie = this.cookie;
      merged.headers['User-Agent'] = merged.headers['User-Agent'] || UA;
      const res = await this.axios.get(url, merged);
      return res.data;
    } catch (e) {
      console.error(`[${this.platform}] 请求失败: ${url}`, e.message);
      return null;
    }
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

  normalizeComment(raw, postId) {
    return {
      post_id: postId,
      platform: this.platform,
      comment_id: raw.comment_id,
      content: raw.content || '',
      author: raw.author || '',
      author_id: raw.author_id || '',
      publish_time: raw.publish_time,
      likes: raw.likes || 0,
      replies: raw.replies || 0,
      parent_comment_id: raw.parent_comment_id || null,
    };
  }
}

module.exports = BaseCrawler;
