const { getDb } = require('../db');

class ReportArchive {
  static create(data) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO report_archives (start_date, end_date, snapshot_path, generated_at)
      VALUES (?, ?, ?, datetime('now', 'localtime'))
    `);
    const result = stmt.run(data.start_date, data.end_date, data.snapshot_path);
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM report_archives WHERE id = ?').get(id);
  }

  static findAll() {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM report_archives
      ORDER BY generated_at DESC
    `).all();
  }

  static findByDateRange(startDate, endDate) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM report_archives
      WHERE start_date = ? AND end_date = ?
    `).get(startDate, endDate);
  }
}

module.exports = ReportArchive;
