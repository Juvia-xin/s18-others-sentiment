require('dotenv').config();
const { getDb } = require('./db');
const Competitor = require('./models/competitor');
const Post = require('./models/post');
const Comment = require('./models/comment');
const WeiboBrowserCrawler = require('./crawlers/weibo');
const { closeBrowser } = require('./utils/browser');

async function main() {
  getDb();
  const wb = new WeiboBrowserCrawler();
  const all = Competitor.findAll().map(c => ({
    ...c,
    platformAccounts: JSON.parse(c.platform_accounts_json || '{}'),
  }));

  let totalComments = 0;

  for (const competitor of all) {
    const uid = competitor.platformAccounts?.weibo?.uid;
    if (!uid) continue;

    console.log(`\n[${competitor.name}] 微博评论采集...`);
    try {
      const result = await wb.crawl(
        { ...competitor, platformAccounts: { weibo: { uid } } },
        { startDate: '2026-06-01' }
      );

      if (result.comments.length > 0) {
        const posts = Post.findAll({ competitorId: competitor.id, platform: 'weibo', limit: 200 });
        const postIdMap = {};
        posts.forEach(p => { postIdMap[p.post_id] = p.id; });

        const batch = result.comments
          .map(c => ({
            post_id: postIdMap[c.post_id] || null,
            platform: 'weibo',
            comment_id: c.comment_id,
            content: c.content,
            author: c.author,
            author_id: c.author_id || '',
            publish_time: c.publish_time,
            likes: c.likes || 0,
            replies: c.replies || 0,
          }))
          .filter(c => c.post_id);

        if (batch.length > 0) {
          Comment.createBatch(batch);
          console.log(`  ${batch.length} 条评论入库`);
          totalComments += batch.length;
        }
      }
    } catch (e) {
      console.log(`  失败: ${e.message}`);
    }
  }

  console.log(`\n===== 共 ${totalComments} 条评论 =====`);
  await closeBrowser();
  process.exit(0);
}

main().catch(async e => {
  console.error(e);
  await closeBrowser();
  process.exit(1);
});
