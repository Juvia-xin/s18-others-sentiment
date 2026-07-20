const { getDb } = require('../db');

class DailyReport {
  static createOrUpdate(data) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO daily_reports (report_date, competitor_id, total_posts, total_comments,
        positive_count, neutral_count, negative_count, sentiment_ratio,
        hot_topics_json, user_profile_json, summary_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(report_date, competitor_id) DO UPDATE SET
        total_posts = excluded.total_posts,
        total_comments = excluded.total_comments,
        positive_count = excluded.positive_count,
        neutral_count = excluded.neutral_count,
        negative_count = excluded.negative_count,
        sentiment_ratio = excluded.sentiment_ratio,
        hot_topics_json = excluded.hot_topics_json,
        user_profile_json = excluded.user_profile_json,
        summary_text = excluded.summary_text
    `);
    stmt.run(
      data.report_date, data.competitor_id, data.total_posts, data.total_comments,
      data.positive_count, data.neutral_count, data.negative_count,
      JSON.stringify(data.sentiment_ratio || {}),
      JSON.stringify(data.hot_topics || []),
      JSON.stringify(data.user_profile || {}),
      data.summary_text || null
    );
    return this.findByDateAndCompetitor(data.report_date, data.competitor_id);
  }

  static findByDateAndCompetitor(date, competitorId) {
    const db = getDb();
    return db.prepare(`
      SELECT d.*, c.name as competitor_name
      FROM daily_reports d
      JOIN competitors c ON d.competitor_id = c.id
      WHERE d.report_date = ? AND d.competitor_id = ?
    `).get(date, competitorId);
  }

  static findByDate(date) {
    const db = getDb();
    return db.prepare(`
      SELECT d.*, c.name as competitor_name
      FROM daily_reports d
      JOIN competitors c ON d.competitor_id = c.id
      WHERE d.report_date = ?
      ORDER BY c.name
    `).all(date);
  }

  static getOverview(date) {
    const db = getDb();
    return db.prepare(`
      SELECT
        d.*,
        c.name as competitor_name,
        c.category as competitor_category
      FROM daily_reports d
      JOIN competitors c ON d.competitor_id = c.id
      WHERE d.report_date = ?
      ORDER BY (d.negative_count * 1.0 / MAX(d.total_comments, 1)) DESC
    `).all(date);
  }

  static getSentimentRanking(date) {
    const db = getDb();
    return db.prepare(`
      SELECT
        c.name,
        c.id as competitor_id,
        d.total_posts,
        d.total_comments,
        d.positive_count,
        d.neutral_count,
        d.negative_count,
        ROUND(d.positive_count * 100.0 / MAX(d.total_comments, 1), 1) as positive_pct,
        ROUND(d.negative_count * 100.0 / MAX(d.total_comments, 1), 1) as negative_pct
      FROM daily_reports d
      JOIN competitors c ON d.competitor_id = c.id
      WHERE d.report_date = ?
      ORDER BY negative_pct DESC
    `).all(date);
  }
}

module.exports = DailyReport;
