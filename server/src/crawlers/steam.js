const BaseCrawler = require('./base');

class SteamCrawler extends BaseCrawler {
  constructor() {
    super('steam');
  }

  async crawl(competitor, options = {}) {
    const { startDate, endDate } = options;
    const appId = competitor.platformAccounts?.steam?.app_id;

    if (!appId) {
      console.log(`[Steam] 竞品 ${competitor.name} 未配置Steam AppID，跳过`);
      return [];
    }

    console.log(`[Steam] 开始爬取 ${competitor.name} (AppID: ${appId})`);
    const results = [];

    try {
      const summary = await this.fetchSummary(appId);
      if (summary) {
        results.push({
          platform: 'steam',
          post_id: `steam_summary_${appId}_${new Date().toISOString().slice(0, 10)}`,
          title: `Steam评价摘要`,
          content: `总评: ${summary.total_reviews} 条 | 好评: ${summary.total_positive} 条 | 差评: ${summary.total_negative} 条 | 评分描述: ${summary.review_score_desc}`,
          url: `https://store.steampowered.com/app/${appId}/`,
          author: 'Steam',
          publish_time: new Date().toISOString(),
          metrics: {
            total_reviews: summary.total_reviews,
            total_positive: summary.total_positive,
            total_negative: summary.total_negative,
            review_score: summary.review_score,
          },
          raw: summary,
        });
      }

      const reviews = await this.fetchReviews(appId, startDate, endDate);
      for (const r of reviews) {
        results.push({
          platform: 'steam',
          post_id: r.recommendationid,
          title: r.review.slice(0, 80),
          content: r.review,
          url: `https://store.steampowered.com/app/${appId}/`,
          author: r.author?.steamid || '',
          publish_time: new Date(r.timestamp_created * 1000).toISOString(),
          metrics: {
            voted_up: r.voted_up ? 1 : 0,
            votes_up: r.votes_up || 0,
            votes_funny: r.votes_funny || 0,
            playtime_forever: r.author?.playtime_forever || 0,
            playtime_at_review: r.author?.playtime_at_review || 0,
          },
          sentiment_label: r.voted_up ? 'positive' : 'negative',
          raw: r,
        });
      }
    } catch (e) {
      console.error(`[Steam] 爬取 ${competitor.name} 失败:`, e.message);
    }

    console.log(`[Steam] ${competitor.name} 获取到 ${results.length} 条记录`);
    return results;
  }

  async fetchSummary(appId) {
    const data = await this.fetch(
      `https://store.steampowered.com/appreviews/${appId}?json=1&filter=recent&language=schinese&review_type=all&purchase_type=all&num_per_page=0`
    );
    return data?.success === 1 ? data.query_summary : null;
  }

  async fetchReviews(appId, startDate, endDate) {
    const all = [];
    let cursor = '*';

    for (let page = 0; page < 5; page++) {
      const data = await this.fetch(
        `https://store.steampowered.com/appreviews/${appId}?json=1&filter=recent&language=schinese&review_type=all&purchase_type=all&num_per_page=100&cursor=${encodeURIComponent(cursor)}`
      );

      if (!data || data.success !== 1) break;

      const reviews = data.reviews || [];
      if (reviews.length === 0) break;

      for (const r of reviews) {
        const ts = new Date(r.timestamp_created * 1000).toISOString();
        if (startDate && cursor === '*' && ts < startDate) {
          cursor = -1;
          break;
        }
        if (endDate && ts > endDate) continue;
        all.push(r);
      }

      if (cursor === -1) break;
      cursor = data.cursor;
      if (!cursor) break;

      await new Promise(r => setTimeout(r, 1000));
    }

    return all;
  }
}

module.exports = SteamCrawler;
