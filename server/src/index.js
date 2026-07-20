require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');
const competitorsRouter = require('./routes/competitors');
const postsRouter = require('./routes/posts');
const sentimentRouter = require('./routes/sentiment');
const reportsRouter = require('./routes/reports');
const { startScheduler } = require('./scheduler');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const snapshotsDir = path.join(__dirname, '..', 'data', 'snapshots');
  app.use('/snapshots', express.static(snapshotsDir));

  app.use('/api/competitors', competitorsRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/sentiment', sentimentRouter);
  app.use('/api/reports', reportsRouter);

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}

function main() {
  initDb();
  const app = createApp();
  const PORT = process.env.PORT || 3001;
  const HOST = process.env.HOST || '0.0.0.0';

  startScheduler();

  app.listen(PORT, HOST, () => {
    console.log(`竞品舆情分析服务已启动: http://0.0.0.0:${PORT}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { createApp };
