const Competitor = require('../models/competitor');
const Post = require('../models/post');
const Comment = require('../models/comment');
const SentimentResult = require('../models/sentiment');
const DailyReport = require('../models/dailyReport');
const ReportArchive = require('../models/reportArchive');
const { getAllCrawlers } = require('../crawlers');
const { batchAnalyze, generateSummaryText } = require('../analysis/sentiment');
const { analyzeUserProfile } = require('../analysis/userProfile');
const KeywordCrawler = require('../crawlers/keyword-search');
const { generateSnapshotHtml } = require('./snapshotGenerator');

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getDateRange(dateStr) {
  const isFirstRun = process.argv.includes('--first-run');
  const start = isFirstRun ? '2026-01-01T00:00:00' : `${dateStr}T00:00:00`;
  const end = `${dateStr}T23:59:59`;
  return { start, end, date: dateStr };
}

function getLast7Days() {
  const days = [];
  const d = new Date();
  d.setDate(d.getDate() - 7);
  for (let i = 0; i < 7; i++) {
    d.setDate(d.getDate() + 1);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function runDailyAnalysis(dateStr) {
  const reportDate = dateStr || getYesterday();
  const { start, end, date } = getDateRange(reportDate);

  console.log(`\n===== 开始执行 ${date} 竞品舆情分析 =====`);

  const competitors = Competitor.findAll().filter(c => c.status === 'active').map(c => ({
    ...c,
    platformAccounts: JSON.parse(c.platform_accounts_json || '{}'),
    keywords: JSON.parse(c.keywords_json || '[]'),
  }));
  console.log(`共 ${competitors.length} 个活跃竞品`);

  const crawlers = getAllCrawlers();
  const platforms = Object.keys(crawlers);

  console.log('\n--- 阶段1: 数据采集 ---');
  for (const competitor of competitors) {
    console.log(`\n处理竞品: ${competitor.name}`);

    for (const platform of platforms) {
      const crawler = crawlers[platform];
      if (!crawler) continue;

      try {
        const result = await crawler.crawl(competitor, { startDate: start, endDate: end });
        const postList = Array.isArray(result) ? result : (result.posts || []);
        const commentList = Array.isArray(result) ? [] : (result.comments || []);

        for (const postData of postList) {
          try {
            Post.create({
              competitor_id: competitor.id,
              platform: postData.platform,
              post_id: postData.post_id,
              title: postData.title,
              content: postData.content,
              url: postData.url,
              author: postData.author,
              publish_time: postData.publish_time,
              metrics: postData.metrics,
              raw: postData.raw,
            });
          } catch (postErr) {
            console.error(`  [${platform}] 动态入库失败: ${postErr.message}，跳过`);
          }
        }

        if (commentList.length > 0) {
          const postRecords = Post.findAll({ competitorId: competitor.id, platform, limit: 2000 });
          const postIdMap = {};
          postRecords.forEach(p => { postIdMap[p.post_id] = p.id; });

          const batch = commentList.map(c => ({
            post_id: postIdMap[c.post_id] || null,
            platform: c.platform || platform,
            comment_id: c.comment_id,
            content: c.content,
            author: c.author,
            author_id: c.author_id || '',
            publish_time: c.publish_time,
            likes: c.likes || 0,
            replies: c.replies || 0,
          })).filter(c => c.post_id);

          if (batch.length > 0) {
            try {
              Comment.createBatch(batch);
              console.log(`  [${platform}] ${batch.length} 条评论入库`);
            } catch (e) {
              console.error(`  [${platform}] 评论入库失败: ${e.message}，跳过`);
            }
          }
        }

        const logged = new Set();
        for (const postData of postList) {
          if (!logged.has(postData.post_id)) {
            console.log(`  [${platform}] 已入库: ${postData.title?.slice(0, 30) || postData.post_id}`);
            logged.add(postData.post_id);
          }
        }
      } catch (platformErr) {
        console.error(`  [${platform}] 采集失败: ${platformErr.message}，跳过`);
      }
    }
  }

  const s18 = competitors.find(c => c.name === '极限战场');
  if (s18 && s18.keywords.length > 0) {
      console.log(`\n[关键词搜索] S18 极限战场 (${s18.keywords.length} 个关键词)`);
      const kwCrawler = new KeywordCrawler();
      const kwPosts = await kwCrawler.searchAll(s18.keywords, {
        startDate: start,
        endDate: end,
        gameNames: [s18.name, s18.name_en].filter(Boolean),
      });
      for (const p of kwPosts) {
        try {
          Post.create({
            competitor_id: s18.id,
            platform: p.platform,
            post_id: p.post_id,
            title: p.title,
            content: p.content,
            url: p.url,
            author: p.author,
            publish_time: p.publish_time,
            metrics: p.metrics,
            raw: { source: 'keyword_search', keyword: p.keyword },
          });
        } catch {}
      }
      console.log(`[关键词搜索] 入库 ${kwPosts.length} 条`);
  }

  console.log('\n--- 阶段2: 舆情分析 ---');
  for (const competitor of competitors) {
    console.log(`\n分析竞品: ${competitor.name}`);

    const posts = Post.findAll({
      competitorId: competitor.id,
      startDate: start,
      endDate: end,
      limit: 2000,
    });

    let allComments = [];
    for (const post of posts) {
      const realComments = Comment.findAll({ postId: post.id });
      if (realComments.length > 0) {
        allComments = allComments.concat(realComments);
      } else if (post.platform === 'steam' || (post.post_id && post.post_id.startsWith('kw_'))) {
        const existing = Comment.findAll({ postId: post.id, limit: 1 });
        if (existing.length === 0) {
          Comment.createBatch([{
            post_id: post.id,
            platform: post.platform,
            comment_id: `${post.post_id}_auto`,
            content: post.content || post.title || '',
            author: post.author || '',
            author_id: '',
            publish_time: post.publish_time || reportDate,
            likes: 0,
            replies: 0,
          }]);
        }
        const saved = Comment.findAll({ postId: post.id, limit: 1 });
        if (saved.length > 0) {
          allComments.push(saved[0]);
        }
      }
    }

    if (allComments.length === 0) {
      console.log(`  ${competitor.name}: 无评论数据`);
      DailyReport.createOrUpdate({
        report_date: date,
        competitor_id: competitor.id,
        total_posts: posts.length,
        total_comments: 0,
        positive_count: 0,
        neutral_count: 0,
        negative_count: 0,
        sentiment_ratio: { positive: 0, neutral: 0, negative: 0 },
        hot_topics: [],
        user_profile: {},
        summary_text: '当日无评论数据',
      });
      continue;
    }

    const results = batchAnalyze(allComments);
    SentimentResult.createBatch(results);

    const positiveCount = results.filter(r => r.sentiment === 'positive').length;
    const neutralCount = results.filter(r => r.sentiment === 'neutral').length;
    const negativeCount = results.filter(r => r.sentiment === 'negative').length;
    const total = results.length;

    const positivePct = Math.round(positiveCount / total * 100);
    const neutralPct = Math.round(neutralCount / total * 100);
    const negativePct = Math.round(negativeCount / total * 100);

    const hotTopics = SentimentResult.getHotKeywords(competitor.id, date, 10);
    const userProfile = analyzeUserProfile(allComments);
    const summaryText = generateSummaryText(positivePct, neutralPct, negativePct, hotTopics);

    DailyReport.createOrUpdate({
      report_date: date,
      competitor_id: competitor.id,
      total_posts: posts.length,
      total_comments: allComments.length,
      positive_count: positiveCount,
      neutral_count: neutralCount,
      negative_count: negativeCount,
      sentiment_ratio: { positive: positivePct, neutral: neutralPct, negative: negativePct },
      hot_topics: hotTopics,
      user_profile: userProfile,
      summary_text: summaryText,
    });

    console.log(`  ${competitor.name}: ${total}条评论 | 正${positivePct}% 中${neutralPct}% 负${negativePct}%`);
  }

  console.log(`\n===== ${date} 竞品舆情分析完成 =====\n`);
}

async function runWeeklyAnalysis(endDateStr) {
  const endDate = endDateStr || getYesterday();
  const days = [];
  const d = new Date(endDate);
  for (let i = 6; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(day.getDate() - i);
    days.push(day.toISOString().slice(0, 10));
  }

  console.log(`\n===== 开始执行周分析 (${days[0]} ~ ${days[6]}) =====`);

  for (const day of days) {
    try {
      await runDailyAnalysis(day);
    } catch (e) {
      console.error(`[周分析] ${day} 执行失败:`, e.message);
    }
  }

  const htmlPath = generateSnapshotHtml(days[0], days[6]);
  console.log(`[周分析] 报表已生成: ${htmlPath}`);

  ReportArchive.create({
    start_date: days[0],
    end_date: days[6],
    snapshot_path: htmlPath,
  });

  console.log(`\n===== 周分析 (${days[0]} ~ ${days[6]}) 全部完成 =====\n`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const date = args[0];

  if (date === '--week' || args.includes('--week')) {
    const endDate = args.length > 1 ? args[1] : undefined;
    runWeeklyAnalysis(endDate).catch(console.error);
  } else if (date) {
    runDailyAnalysis(date).catch(console.error);
  } else {
    runDailyAnalysis().catch(console.error);
  }
}

module.exports = { runDailyAnalysis, runWeeklyAnalysis, getYesterday };
