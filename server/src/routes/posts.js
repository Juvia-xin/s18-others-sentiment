const express = require('express');
const router = express.Router();
const Post = require('../models/post');

router.get('/', (req, res) => {
  const { competitor_id, platform, start_date, end_date, limit, offset } = req.query;
  const posts = Post.findAll({
    competitorId: competitor_id,
    platform,
    startDate: start_date,
    endDate: end_date,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });
  res.json(posts);
});

router.get('/:id', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  res.json(post);
});

router.get('/:id/comments', (req, res) => {
  const Comment = require('../models/comment');
  const comments = Comment.findAll({ postId: req.params.id });
  res.json(comments);
});

router.get('/stats/:competitorId', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const stats = Post.getStatsByCompetitor(req.params.competitorId, days);
  res.json(stats);
});

module.exports = router;
