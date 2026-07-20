const BilibiliBrowserCrawler = require('./bilibili');
const TapTapBrowserCrawler = require('./taptap');
const WeiboBrowserCrawler = require('./weibo');
const DouyinBrowserCrawler = require('./douyin');
const NgaCrawler = require('./nga');
const XiaohongshuBrowserCrawler = require('./xiaohongshu');
const SteamCrawler = require('./steam');

const crawlers = {
  bilibili: new BilibiliBrowserCrawler(),
  taptap: new TapTapBrowserCrawler(),
  weibo: new WeiboBrowserCrawler(),
  douyin: new DouyinBrowserCrawler(),
  nga: new NgaCrawler(),
  xiaohongshu: new XiaohongshuBrowserCrawler(),
  steam: new SteamCrawler(),
};

function getCrawler(platform) {
  return crawlers[platform] || null;
}

function getAllCrawlers() {
  return crawlers;
}

module.exports = { getCrawler, getAllCrawlers };
