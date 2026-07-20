const BaseCrawler = require('./base');

class NgaCrawler extends BaseCrawler {
  constructor() {
    super('nga');
  }

  async crawl(competitor, options = {}) {
    const fid = competitor.platformAccounts?.nga?.fid;
    if (!fid) {
      console.log(`[NGA] 竞品 ${competitor.name} 未配置NGA板块ID，跳过`);
      return [];
    }
    console.log(`[NGA] ${competitor.name} - NGA爬取暂未实现 (需Cookie)`);
    return [];
  }
}

module.exports = NgaCrawler;
