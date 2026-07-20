const express = require('express');
const router = express.Router();
const Competitor = require('../models/competitor');

router.get('/', (req, res) => {
  const competitors = Competitor.findAll();
  res.json(competitors);
});

router.get('/:id', (req, res) => {
  const c = Competitor.findById(req.params.id);
  if (!c) return res.status(404).json({ error: '竞品不存在' });
  res.json(c);
});

router.post('/', (req, res) => {
  const { name, name_en, category, platforms, platformAccounts } = req.body;
  if (!name) return res.status(400).json({ error: '竞品名称不能为空' });
  try {
    const c = Competitor.create({ name, name_en, category, platforms, platformAccounts });
    res.status(201).json(c);
  } catch (e) {
    res.status(409).json({ error: '竞品已存在或创建失败' });
  }
});

router.put('/:id', (req, res) => {
  const c = Competitor.update(req.params.id, req.body);
  if (!c) return res.status(404).json({ error: '竞品不存在' });
  res.json(c);
});

router.delete('/:id', (req, res) => {
  Competitor.delete(req.params.id);
  res.json({ success: true });
});

router.post('/seed', (req, res) => {
  const competitors = Competitor.seedDefaults();
  res.json({ message: '默认竞品已初始化', count: competitors.length, data: competitors });
});

module.exports = router;
