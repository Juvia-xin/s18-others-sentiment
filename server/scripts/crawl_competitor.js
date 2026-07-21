const Competitor = require('../src/models/competitor');
const Post = require('../src/models/post');
const Comment = require('../src/models/comment');
const SentimentResult = require('../src/models/sentiment');
const DailyReport = require('../src/models/dailyReport');
const { getAllCrawlers } = require('../src/crawlers');
const { batchAnalyze, generateSummaryText } = require('../src/analysis/sentiment');
const { analyzeUserProfile } = require('../src/analysis/userProfile');
const path = require('path');
const fs = require('fs');

const COMPETITOR_NAME = process.argv[2] || '失控进化';
const START_DATE = process.argv[3] || '2026-07-01';
const END_DATE = process.argv[4] || '2026-07-21';

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateReportHtml(competitor, posts, comments, sentimentResults, reportDate) {
  const posCount = sentimentResults.filter(r => r.sentiment === 'positive').length;
  const neuCount = sentimentResults.filter(r => r.sentiment === 'neutral').length;
  const negCount = sentimentResults.filter(r => r.sentiment === 'negative').length;
  const total = sentimentResults.length || 1;
  const posPct = Math.round(posCount / total * 100);
  const neuPct = Math.round(neuCount / total * 100);
  const negPct = Math.round(negCount / total * 100);

  const platformStats = {};
  posts.forEach(p => {
    platformStats[p.platform] = platformStats[p.platform] || { posts: 0, comments: 0 };
    platformStats[p.platform].posts++;
  });
  comments.forEach(c => {
    const plat = c.platform || 'unknown';
    platformStats[plat] = platformStats[plat] || { posts: 0, comments: 0 };
    platformStats[plat].comments++;
  });

  const keywords = {};
  sentimentResults.forEach(s => {
    (s.keywords || '').split(',').map(k => k.trim()).filter(Boolean).forEach(k => {
      keywords[k] = (keywords[k] || 0) + 1;
    });
  });
  const topKeywords = Object.entries(keywords).sort((a, b) => b[1] - a[1]).slice(0, 20);

  const posSamples = sentimentResults.filter(s => s.sentiment === 'positive').slice(0, 5);
  const negSamples = sentimentResults.filter(s => s.sentiment === 'negative').slice(0, 5);

  const now = new Date();
  const genTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(competitor.name)} · 舆情分析报告 (${START_DATE} ~ ${END_DATE})</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:#0f1923;color:#e8edf2;padding:24px;max-width:1000px;margin:0 auto}
h1{font-size:24px;margin-bottom:4px}
h2{font-size:17px;margin:28px 0 14px;border-bottom:2px solid #4fc3f7;padding-bottom:6px}
h3{font-size:15px;margin:0 0 12px;color:#4fc3f7}
.sub{color:#8fa3b8;font-size:13px;margin-bottom:24px}
.card{background:#0d1a26;border:1px solid #2a3f54;border-radius:8px;padding:16px;margin:16px 0}
.metric-row{display:flex;gap:12px;margin:12px 0}
.metric{flex:1;text-align:center;padding:12px 8px;background:#1b2838;border-radius:6px}
.metric-num{display:block;font-size:24px;font-weight:700}
.metric-label{display:block;font-size:11px;color:#8fa3b8;margin-top:2px}
.metric.positive .metric-num{color:#66bb6a}
.metric.neutral .metric-num{color:#90a4ae}
.metric.negative .metric-num{color:#ef5350}
.kw-cloud{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.kw-tag{display:inline-block;padding:3px 10px;border-radius:4px;font-size:12px;background:#2a3f54;color:#8fa3b8}
.kw-tag.p{background:rgba(102,187,106,.15);color:#66bb6a}
.kw-tag.n{background:rgba(239,83,80,.15);color:#ef5350}
.sample-item{margin:6px 0;padding:8px 10px;background:rgba(0,0,0,.2);border-radius:4px;font-size:12px;line-height:1.5;color:#b0bec5}
.sample-src{display:block;font-size:10px;color:#5a7a8a;margin-top:2px}
.tag{display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;margin-right:4px}
.tag.p{background:rgba(102,187,106,.2);color:#66bb6a}
.tag.n{background:rgba(239,83,80,.2);color:#ef5350}
table{width:100%;border-collapse:collapse;font-size:13px;margin:10px 0}
th{background:#1b2838;padding:8px 10px;text-align:left;font-weight:600;color:#8fa3b8;font-size:12px}
td{padding:8px 10px;border-bottom:1px solid #2a3f54}
.positive{color:#66bb6a;font-weight:600}
.negative{color:#ef5350;font-weight:600}
.post-row{margin:8px 0;padding:10px;background:#1b2838;border-radius:4px;font-size:12px}
.post-title{font-weight:600;color:#e8edf2}
.post-meta{color:#5a7a8a;font-size:11px;margin-top:3px}
.platform-tag{display:inline-block;padding:1px 6px;background:#2a3f54;border-radius:3px;font-size:11px;margin-right:4px}
.footer{text-align:center;color:#5a7a8a;font-size:11px;margin-top:32px}
</style>
</head>
<body>
<h1>${escapeHtml(competitor.name)} · 竞品舆情分析报告</h1>
<div class="sub">
  品类: ${escapeHtml(competitor.category || '-')} | 数据周期: ${START_DATE} ~ ${END_DATE} | 生成时间: ${genTime}
</div>

<div class="card">
<h3>数据概览</h3>
<div class="metric-row">
  <div class="metric"><span class="metric-num">${posts.length}</span><span class="metric-label">动态数</span></div>
  <div class="metric"><span class="metric-num">${comments.length}</span><span class="metric-label">评论数</span></div>
  <div class="metric positive"><span class="metric-num">${posPct}%</span><span class="metric-label">正面率</span></div>
  <div class="metric neutral"><span class="metric-num">${neuPct}%</span><span class="metric-label">中性率</span></div>
  <div class="metric negative"><span class="metric-num">${negPct}%</span><span class="metric-label">负面率</span></div>
</div>
</div>

<div class="card">
<h3>平台分布</h3>
<table>
<thead><tr><th>平台</th><th>动态数</th><th>评论数</th></tr></thead>
<tbody>
${Object.entries(platformStats).map(([p, s]) => `<tr><td><span class="platform-tag">${escapeHtml(p)}</span></td><td>${s.posts}</td><td>${s.comments}</td></tr>`).join('')}
</tbody>
</table>
</div>

<div class="card">
<h3>关键词词云</h3>
<div class="kw-cloud">
${topKeywords.map(([kw, cnt]) => `<span class="kw-tag">${escapeHtml(kw)} (${cnt})</span>`).join(' ')}
</div>
</div>

<div class="card">
<h3><span class="tag p">好评</span>正面反馈摘录</h3>
${posSamples.length > 0 ? posSamples.map(s => `
<div class="sample-item"><span class="tag p">好评</span> "${escapeHtml((s.content || '').slice(0, 150))}"<span class="sample-src">— ${escapeHtml(s.platform || '')} | ${escapeHtml(s.author || '匿名')}</span></div>
`).join('') : '<p style="color:#5a7a8a;font-size:12px">暂无正面反馈数据</p>'}
</div>

<div class="card">
<h3><span class="tag n">差评</span>负面反馈摘录</h3>
${negSamples.length > 0 ? negSamples.map(s => `
<div class="sample-item"><span class="tag n">差评</span> "${escapeHtml((s.content || '').slice(0, 150))}"<span class="sample-src">— ${escapeHtml(s.platform || '')} | ${escapeHtml(s.author || '匿名')}</span></div>
`).join('') : '<p style="color:#5a7a8a;font-size:12px">暂无负面反馈数据</p>'}
</div>

<div class="card">
<h3>最新动态</h3>
${posts.length > 0 ? posts.slice(0, 20).map(p => `
<div class="post-row">
  <div class="post-title">${escapeHtml((p.title || p.content || '').slice(0, 100))}</div>
  <div class="post-meta"><span class="platform-tag">${escapeHtml(p.platform || '')}</span> ${p.publish_time || ''} | ${escapeHtml(p.author || '')} | ${p.url ? '<a href="' + escapeHtml(p.url) + '" style="color:#4fc3f7" target="_blank">原文链接</a>' : ''}</div>
</div>
`).join('') : '<p style="color:#5a7a8a;font-size:12px">暂无动态数据</p>'}
</div>

<div class="footer">自动生成于 ${genTime} · 极限战场竞品舆情系统</div>
</body>
</html>`;
}

async function main() {
  const competitor = Competitor.findByName(COMPETITOR_NAME);
  if (!competitor) { console.error('未找到竞品: ' + COMPETITOR_NAME); return; }

  const c = {
    ...competitor,
    platformAccounts: JSON.parse(competitor.platform_accounts_json || '{}'),
    keywords: JSON.parse(competitor.keywords_json || '[]'),
  };

  console.log(`===== 开始采集 ${c.name} 历史舆情 =====`);
  console.log(`日期范围: ${START_DATE} ~ ${END_DATE}`);
  console.log(`平台账号: ${JSON.stringify(c.platformAccounts)}\n`);

  const crawlers = getAllCrawlers();
  const startStr = START_DATE + 'T00:00:00';
  const endStr = END_DATE + 'T23:59:59';
  let totalPosts = 0, totalComments = 0;

  for (const [platform, crawler] of Object.entries(crawlers)) {
    console.log(`\n[${platform}] 爬取中...`);
    try {
      const result = await crawler.crawl(c, { startDate: startStr, endDate: endStr });
      const postList = Array.isArray(result) ? result : (result.posts || []);
      const commentList = Array.isArray(result) ? [] : (result.comments || []);

      for (const postData of postList) {
        try {
          Post.create({
            competitor_id: c.id,
            platform: postData.platform || platform,
            post_id: String(postData.post_id),
            title: postData.title,
            content: postData.content,
            url: postData.url,
            author: postData.author,
            publish_time: postData.publish_time,
            metrics: postData.metrics,
            raw: postData.raw,
          });
        } catch(e) { console.error('  帖子入库失败:', e.message.slice(0, 80)); }
      }

      if (commentList.length > 0) {
        const postRecords = Post.findAll({ competitorId: c.id, platform, limit: 1000 });
        const postIdMap = {};
        postRecords.forEach(p => { postIdMap[String(p.post_id)] = p.id; });

        const batch = commentList.map(cm => ({
          post_id: postIdMap[String(cm.post_id)] || null,
          platform: cm.platform || platform,
          comment_id: String(cm.comment_id),
          content: cm.content,
          author: cm.author,
          author_id: String(cm.author_id || ''),
          publish_time: cm.publish_time,
          likes: cm.likes || 0,
          replies: cm.replies || 0,
        })).filter(cm => cm.post_id);

        if (batch.length > 0) {
          try {
            Comment.createBatch(batch);
            totalComments += batch.length;
            console.log(`  评论入库: ${batch.length} 条`);
          } catch(e) { console.error('  评论入库失败:', e.message.slice(0, 80)); }
        }
      }

      totalPosts += postList.length;
      console.log(`  [${platform}] ${postList.length} 帖子, ${commentList.length} 评论`);
    } catch(e) { console.error(`  [${platform}] 失败:`, e.message); }
  }

  console.log(`\n===== 采集完成: ${totalPosts} 帖子, ${totalComments} 评论 =====`);

  console.log('\n--- 舆情分析 ---');
  const posts = Post.findAll({ competitorId: c.id, startDate: startStr, endDate: endStr, limit: 5000 });

  let allComments = [];
  for (const post of posts) {
    const realComments = Comment.findAll({ postId: post.id });
    if (realComments.length > 0) {
      allComments = allComments.concat(realComments.map(cm => ({...cm, platform: post.platform})));
    } else if (post.platform === 'steam' || (post.post_id && post.post_id.startsWith('kw_'))) {
      allComments.push({
        id: post.id, post_id: post.id,
        content: post.content || post.title || '',
        author: post.author || '', platform: post.platform,
        likes: 0, publish_time: post.publish_time,
      });
    }
  }

  console.log(`评论总数: ${allComments.length}`);

  if (allComments.length === 0) {
    console.log('无评论数据，跳过情感分析');
    DailyReport.createOrUpdate({
      report_date: END_DATE,
      competitor_id: c.id,
      total_posts: posts.length,
      total_comments: 0,
      positive_count: 0, neutral_count: 0, negative_count: 0,
      sentiment_ratio: { positive: 0, neutral: 0, negative: 0 },
      hot_topics: [],
      user_profile: {},
      summary_text: '历史周期无评论数据',
    });
  } else {
    const results = batchAnalyze(allComments);
    SentimentResult.createBatch(results);

    const pos = results.filter(r => r.sentiment === 'positive').length;
    const neu = results.filter(r => r.sentiment === 'neutral').length;
    const neg = results.filter(r => r.sentiment === 'negative').length;
    const total = results.length;

    const hotTopics = SentimentResult.getHotKeywords(c.id, END_DATE, 20);
    const userProfile = analyzeUserProfile(allComments);
    const summaryText = generateSummaryText(Math.round(pos/total*100), Math.round(neu/total*100), Math.round(neg/total*100), hotTopics);

    DailyReport.createOrUpdate({
      report_date: END_DATE,
      competitor_id: c.id,
      total_posts: posts.length,
      total_comments: total,
      positive_count: pos, neutral_count: neu, negative_count: neg,
      sentiment_ratio: { positive: Math.round(pos/total*100), neutral: Math.round(neu/total*100), negative: Math.round(neg/total*100) },
      hot_topics: hotTopics,
      user_profile: userProfile,
      summary_text: summaryText,
    });

    console.log(`分析结果: 正${Math.round(pos/total*100)}% 中${Math.round(neu/total*100)}% 负${Math.round(neg/total*100)}%`);

    const sentimentResults = results.map(r => ({
      ...r,
      content: (allComments.find(c => c.id === r.comment_id) || {}).content || '',
      author: (allComments.find(c => c.id === r.comment_id) || {}).author || '',
      platform: (allComments.find(c => c.id === r.comment_id) || {}).platform || '',
    }));

    const html = generateReportHtml(c, posts, allComments, sentimentResults, END_DATE);
    const outDir = path.join(__dirname, '..', 'data', 'snapshots');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filename = `sentiment-${COMPETITOR_NAME}-${START_DATE}-${END_DATE}.html`;
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(`\n[H5报告] 已生成: ${filePath}`);
  }

  console.log(`\n===== ${COMPETITOR_NAME} 历史舆情分析完成 =====\n`);
}

main().catch(console.error);
