const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'sentiment.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS competitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      name_en TEXT,
      category TEXT,
      platforms_json TEXT DEFAULT '[]',
      platform_accounts_json TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      post_id TEXT NOT NULL,
      title TEXT,
      content TEXT,
      url TEXT,
      author TEXT,
      publish_time TEXT,
      crawl_time TEXT DEFAULT (datetime('now', 'localtime')),
      metrics_json TEXT DEFAULT '{}',
      raw_json TEXT,
      UNIQUE(platform, post_id),
      FOREIGN KEY (competitor_id) REFERENCES competitors(id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      comment_id TEXT NOT NULL,
      content TEXT,
      author TEXT,
      author_id TEXT,
      publish_time TEXT,
      likes INTEGER DEFAULT 0,
      replies INTEGER DEFAULT 0,
      parent_comment_id TEXT,
      crawl_time TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(platform, comment_id),
      FOREIGN KEY (post_id) REFERENCES posts(id)
    );

    CREATE TABLE IF NOT EXISTS sentiment_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      sentiment TEXT NOT NULL CHECK(sentiment IN ('positive','neutral','negative')),
      score REAL DEFAULT 0.0,
      keywords TEXT,
      analysis_json TEXT DEFAULT '{}',
      analyzed_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (comment_id) REFERENCES comments(id)
    );

    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      competitor_id INTEGER NOT NULL,
      total_posts INTEGER DEFAULT 0,
      total_comments INTEGER DEFAULT 0,
      positive_count INTEGER DEFAULT 0,
      neutral_count INTEGER DEFAULT 0,
      negative_count INTEGER DEFAULT 0,
      sentiment_ratio TEXT,
      hot_topics_json TEXT DEFAULT '[]',
      user_profile_json TEXT DEFAULT '{}',
      summary_text TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(report_date, competitor_id),
      FOREIGN KEY (competitor_id) REFERENCES competitors(id)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_competitor ON posts(competitor_id, publish_time);
    CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_sentiment_comment ON sentiment_results(comment_id);
    CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);

    CREATE TABLE IF NOT EXISTS report_archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      snapshot_path TEXT,
      generated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  console.log('Database initialized successfully.');
  return db;
}

module.exports = { getDb, initDb };
