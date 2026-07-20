const { getDb } = require('../db');

class SentimentResult {
  static createBatch(results) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO sentiment_results (comment_id, sentiment, score, keywords, analysis_json)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction(() => {
      for (const r of results) {
        stmt.run(r.comment_id, r.sentiment, r.score, r.keywords, JSON.stringify(r.analysis || {}));
      }
    });

    insertMany();
    return results.length;
  }

  static getSummaryByCompetitor(competitorId, date) {
    const db = getDb();
    return db.prepare(`
      SELECT
        s.sentiment,
        COUNT(*) as count,
        ROUND(AVG(s.score), 2) as avg_score
      FROM sentiment_results s
      JOIN comments c ON s.comment_id = c.id
      JOIN posts p ON c.post_id = p.id
      WHERE p.competitor_id = ? AND date(c.publish_time) = ?
      GROUP BY s.sentiment
    `).all(competitorId, date);
  }

  static getTrend(competitorId, days = 7) {
    const db = getDb();
    return db.prepare(`
      SELECT
        date(c.publish_time) as date,
        s.sentiment,
        COUNT(*) as count
      FROM sentiment_results s
      JOIN comments c ON s.comment_id = c.id
      JOIN posts p ON c.post_id = p.id
      WHERE p.competitor_id = ?
        AND c.publish_time >= datetime('now', '-' || ? || ' days', 'localtime')
      GROUP BY date(c.publish_time), s.sentiment
      ORDER BY date DESC
    `).all(competitorId, days);
  }

  static getHotKeywords(competitorId, date, limit = 20) {
    const db = getDb();
    return db.prepare(`
      SELECT s.keywords, COUNT(*) as count
      FROM sentiment_results s
      JOIN comments c ON s.comment_id = c.id
      JOIN posts p ON c.post_id = p.id
      WHERE p.competitor_id = ? AND date(c.publish_time) = ? AND s.keywords != ''
      GROUP BY s.keywords
      ORDER BY count DESC
      LIMIT ?
    `).all(competitorId, date, limit);
  }
}

module.exports = SentimentResult;
