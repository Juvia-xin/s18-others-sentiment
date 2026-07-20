const { getDb } = require('../db');

class Post {
  static findAll({ competitorId, platform, startDate, endDate, limit = 50, offset = 0 } = {}) {
    const db = getDb();
    let sql = 'SELECT p.*, c.name as competitor_name FROM posts p JOIN competitors c ON p.competitor_id = c.id WHERE 1=1';
    const params = [];

    if (competitorId) { sql += ' AND p.competitor_id = ?'; params.push(competitorId); }
    if (platform) { sql += ' AND p.platform = ?'; params.push(platform); }
    if (startDate) { sql += ' AND p.publish_time >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND p.publish_time <= ?'; params.push(endDate); }

    sql += ' ORDER BY p.publish_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return db.prepare(sql).all(...params);
  }

  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT p.*, c.name as competitor_name FROM posts p JOIN competitors c ON p.competitor_id = c.id WHERE p.id = ?').get(id);
  }

  static findByPlatformPostId(platform, postId) {
    const db = getDb();
    return db.prepare('SELECT * FROM posts WHERE platform = ? AND post_id = ?').get(platform, postId);
  }

  static create(data) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO posts (competitor_id, platform, post_id, title, content, url, author, publish_time, metrics_json, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.competitor_id, data.platform, data.post_id,
      data.title || null, data.content || null, data.url || null,
      data.author || null, data.publish_time || null,
      JSON.stringify(data.metrics || {}), JSON.stringify(data.raw || null)
    );
    return this.findById(result.lastInsertRowid);
  }

  static countByCompetitorAndDate(competitorId, date) {
    const db = getDb();
    return db.prepare(`
      SELECT COUNT(*) as count FROM posts
      WHERE competitor_id = ? AND date(publish_time) = ?
    `).get(competitorId, date);
  }

  static getStatsByCompetitor(competitorId, days = 7) {
    const db = getDb();
    return db.prepare(`
      SELECT date(publish_time) as date, platform, COUNT(*) as count
      FROM posts
      WHERE competitor_id = ? AND publish_time >= datetime('now', '-' || ? || ' days', 'localtime')
      GROUP BY date(publish_time), platform
      ORDER BY date DESC
    `).all(competitorId, days);
  }
}

module.exports = Post;
