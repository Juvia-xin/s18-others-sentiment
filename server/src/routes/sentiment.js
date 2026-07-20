const express = require('express');
const router = express.Router();
const SentimentResult = require('../models/sentiment');

router.get('/summary', (req, res) => {
  const { competitor_id, date } = req.query;
  if (!competitor_id || !date) return res.status(400).json({ error: '需要 competitor_id 和 date 参数' });
  const summary = SentimentResult.getSummaryByCompetitor(competitor_id, date);
  res.json(summary);
});

router.get('/trend', (req, res) => {
  const { competitor_id, days } = req.query;
  if (!competitor_id) return res.status(400).json({ error: '需要 competitor_id 参数' });
  const trend = SentimentResult.getTrend(competitor_id, parseInt(days) || 7);
  res.json(trend);
});

router.get('/keywords', (req, res) => {
  const { competitor_id, date, limit } = req.query;
  if (!competitor_id || !date) return res.status(400).json({ error: '需要 competitor_id 和 date 参数' });
  const keywords = SentimentResult.getHotKeywords(competitor_id, date, parseInt(limit) || 20);
  res.json(keywords);
});

module.exports = router;
