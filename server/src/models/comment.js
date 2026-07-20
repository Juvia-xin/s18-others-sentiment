const { getDb } = require('../db');

class Comment {
  static findAll({ postId, platform, startDate, endDate, limit = 100, offset = 0 } = {}) {
    const db = getDb();
    let sql = 'SELECT * FROM comments WHERE 1=1';
    const params = [];

    if (postId) { sql += ' AND post_id = ?'; params.push(postId); }
    if (platform) { sql += ' AND platform = ?'; params.push(platform); }
    if (startDate) { sql += ' AND publish_time >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND publish_time <= ?'; params.push(endDate); }

    sql += ' ORDER BY publish_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return db.prepare(sql).all(...params);
  }

  static createBatch(comments) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO comments (post_id, platform, comment_id, content, author, author_id, publish_time, likes, replies, parent_comment_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction(() => {
      for (const c of comments) {
        stmt.run(c.post_id, c.platform, c.comment_id, c.content, c.author, c.author_id,
          c.publish_time, c.likes || 0, c.replies || 0, c.parent_comment_id || null);
      }
    });

    insertMany();
    return comments.length;
  }

  static countByPost(postId) {
    const db = getDb();
    return db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?').get(postId);
  }

  static findByDateRange(startDate, endDate) {
    const db = getDb();
    return db.prepare(`
      SELECT c.*, p.competitor_id, p.platform as post_platform
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE c.publish_time >= ? AND c.publish_time <= ?
      ORDER BY c.publish_time DESC
    `).all(startDate, endDate);
  }
}

module.exports = Comment;
