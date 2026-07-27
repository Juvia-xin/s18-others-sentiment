const express = require('express');
const router = express.Router();
const DailyReport = require('../models/dailyReport');
const Post = require('../models/post');
const Comment = require('../models/comment');
const SentimentResult = require('../models/sentiment');
const ReportArchive = require('../models/reportArchive');
const { getDb } = require('../db');
const { runDailyAnalysis } = require('../scheduler/dailyTask');

router.get('/', (req, res) => {
  const { date } = req.query;
  const reportDate = date || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const reports = DailyReport.findByDate(reportDate);
  res.json({ date: reportDate, reports });
});

router.get('/overview', (req, res) => {
  const { date } = req.query;
  const reportDate = date || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const overview = DailyReport.getOverview(reportDate);
  res.json({ date: reportDate, overview });
});

router.get('/ranking', (req, res) => {
  const { date } = req.query;
  const reportDate = date || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const ranking = DailyReport.getSentimentRanking(reportDate);
  res.json({ date: reportDate, ranking });
});

router.get('/archives', (req, res) => {
  const archives = ReportArchive.findAll();
  res.json({ archives });
});

router.get('/latest-date', (req, res) => {
  const db = getDb();
  const row = db.prepare(
    'SELECT report_date FROM daily_reports ORDER BY report_date DESC LIMIT 1'
  ).get();
  res.json({ date: row ? row.report_date : null });
});

router.get('/weekly', (req, res) => {
  const db = getDb();
  const latestRow = db.prepare('SELECT MAX(report_date) as d FROM daily_reports').get();
  if (!latestRow?.d) return res.json({ startDate: null, endDate: null, reports: [] });

  const endDate = latestRow.d;
  const d = new Date(endDate);
  d.setDate(d.getDate() - 6);
  const startDate = d.toISOString().slice(0, 10);

  const reports = db.prepare(`
    SELECT c.id as competitor_id, c.name as competitor_name,
           SUM(d.total_posts) as total_posts,
           SUM(d.total_comments) as total_comments,
           SUM(d.positive_count) as positive_count,
           SUM(d.neutral_count) as neutral_count,
           SUM(d.negative_count) as negative_count,
           ROUND(SUM(d.positive_count)*100.0/MAX(SUM(d.total_comments),1)) as positive_pct,
           ROUND(SUM(d.neutral_count)*100.0/MAX(SUM(d.total_comments),1)) as neutral_pct,
           ROUND(SUM(d.negative_count)*100.0/MAX(SUM(d.total_comments),1)) as negative_pct
    FROM daily_reports d
    JOIN competitors c ON d.competitor_id = c.id
    WHERE d.report_date >= ? AND d.report_date <= ?
    GROUP BY c.id
  `).all(startDate, endDate);

  res.json({ startDate, endDate, reports });
});

router.get('/weekly-ranking', (req, res) => {
  const db = getDb();
  const latestRow = db.prepare('SELECT MAX(report_date) as d FROM daily_reports').get();
  if (!latestRow?.d) return res.json({ startDate: null, endDate: null, ranking: [] });

  const endDate = latestRow.d;
  const d2 = new Date(endDate);
  d2.setDate(d2.getDate() - 6);
  const startDate = d2.toISOString().slice(0, 10);

  const ranking = db.prepare(`
    SELECT c.name, c.id as competitor_id,
           SUM(d.total_posts) as total_posts,
           SUM(d.total_comments) as total_comments,
           SUM(d.positive_count) as positive_count,
           SUM(d.neutral_count) as neutral_count,
           SUM(d.negative_count) as negative_count,
           ROUND(SUM(d.positive_count)*100.0/MAX(SUM(d.total_comments),1), 1) as positive_pct,
           ROUND(SUM(d.negative_count)*100.0/MAX(SUM(d.total_comments),1), 1) as negative_pct
    FROM daily_reports d
    JOIN competitors c ON d.competitor_id = c.id
    WHERE d.report_date >= ? AND d.report_date <= ?
    GROUP BY c.id
    ORDER BY negative_pct DESC
  `).all(startDate, endDate);

  res.json({ startDate, endDate, ranking });
});

router.get('/:competitorId', (req, res) => {
  const { date } = req.query;
  const reportDate = date || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const report = DailyReport.findByDateAndCompetitor(reportDate, req.params.competitorId);
  if (!report) return res.json({ date: reportDate, report: null });
  res.json({ date: reportDate, report });
});

router.get('/:competitorId/samples', (req, res) => {
  const { date } = req.query;
  const reportDate = date || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const competitorId = parseInt(req.params.competitorId);

  const db = getDb();

  const hotKeywords = db.prepare(`
    SELECT s.keywords, COUNT(*) as cnt
    FROM sentiment_results s
    JOIN comments c ON s.comment_id = c.id
    JOIN posts p ON c.post_id = p.id
    WHERE p.competitor_id = ? AND date(c.publish_time) = ?
      AND s.keywords != ''
    GROUP BY s.keywords
    ORDER BY cnt DESC LIMIT 10
  `).all(competitorId, reportDate);

  const topKeywords = hotKeywords.map(k => k.keywords.toLowerCase());

  const posts = Post.findAll({
    competitorId,
    limit: 2000,
  });

  const samples = [];

  for (const post of posts) {
    const content = (post.content || post.title || '').trim();
    if (content.length < 10) continue;
    if (content.startsWith('总评:') || content.startsWith('Steam评价摘要') || content.startsWith('B站游戏评分:')) continue;
    if (post.post_id.startsWith('steam_summary_') || post.post_id.startsWith('bl_gm_meta_')) continue;

    const comments = Comment.findAll({ postId: post.id, limit: 50 });
    if (comments.length === 0) continue;

    for (const comment of comments) {
      const commentText = (comment.content || '').trim();
      if (commentText.length < 10) continue;

      const sentimentRows = db.prepare(
        'SELECT sentiment, score, keywords FROM sentiment_results WHERE comment_id = ?'
      ).all(comment.id);

      if (sentimentRows.length === 0) continue;

      const s = sentimentRows[0];
      const kwList = (s.keywords || '').toLowerCase().split(',').map(k => k.trim()).filter(Boolean);

      const matchesHot = kwList.length > 0 && topKeywords.some(hk =>
        kwList.some(k => k.includes(hk) || hk.includes(k))
      );

      if ((s.sentiment === 'positive' || s.sentiment === 'negative')) {
        samples.push({
          content: commentText.slice(0, 200),
          sentiment: s.sentiment,
          score: s.score,
          keywords: s.keywords,
          platform: post.platform,
          url: post.url,
          author: comment.author || post.author || '',
          date: post.publish_time,
        });
      }
    }
  }

  const topPositive = samples
    .filter(s => s.sentiment === 'positive')
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 5);

  const topNegative = samples
    .filter(s => s.sentiment === 'negative')
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 5);

  const allKeywords = db.prepare(`
    SELECT s.keywords, COUNT(*) as count
    FROM sentiment_results s
    JOIN comments c ON s.comment_id = c.id
    JOIN posts p ON c.post_id = p.id
    WHERE p.competitor_id = ? AND date(c.publish_time) = ?
      AND s.keywords != ''
    GROUP BY s.keywords
    ORDER BY count DESC LIMIT 30
  `).all(competitorId, reportDate);

  const wordcloud = {};
  for (const row of allKeywords) {
    const kws = (row.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
    for (const kw of kws) {
      wordcloud[kw] = (wordcloud[kw] || 0) + row.count;
    }
  }

  res.json({
    date: reportDate,
    competitorId,
    positive: topPositive,
    negative: topNegative,
    wordcloud: Object.entries(wordcloud)
      .map(([text, weight]) => ({ text, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 30),
  });
});

let analysisRunning = false;

router.post('/run-analysis', async (req, res) => {
  if (analysisRunning) return res.status(409).json({ error: '分析任务已在运行中' });
  const { date } = req.body;
  analysisRunning = true;
  res.json({ status: 'started', date: date || 'yesterday' });
  try {
    await runDailyAnalysis(date || undefined);
  } catch (e) {
    console.error('[run-analysis] 失败:', e.message);
  } finally {
    analysisRunning = false;
  }
});

module.exports = router;
