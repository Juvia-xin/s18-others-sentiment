const { getDb } = require('../db');

class Competitor {
  static findAll() {
    const db = getDb();
    return db.prepare('SELECT id, name, name_en, category, platforms_json, platform_accounts_json, keywords_json, status, created_at, updated_at FROM competitors ORDER BY id').all();
  }

  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM competitors WHERE id = ?').get(id);
  }

  static findByName(name) {
    const db = getDb();
    return db.prepare('SELECT * FROM competitors WHERE name = ?').get(name);
  }

  static create(data) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO competitors (name, name_en, category, platforms_json, platform_accounts_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.name,
      data.name_en || null,
      data.category || null,
      JSON.stringify(data.platforms || []),
      JSON.stringify(data.platformAccounts || {})
    );
    return this.findById(result.lastInsertRowid);
  }

  static update(id, data) {
    const db = getDb();
    const fields = [];
    const values = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.name_en !== undefined) { fields.push('name_en = ?'); values.push(data.name_en); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.platforms !== undefined) { fields.push('platforms_json = ?'); values.push(JSON.stringify(data.platforms)); }
    if (data.platformAccounts !== undefined) { fields.push('platform_accounts_json = ?'); values.push(JSON.stringify(data.platformAccounts)); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_at = datetime('now', 'localtime')");
    values.push(id);

    db.prepare(`UPDATE competitors SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM competitors WHERE id = ?').run(id);
  }

  static seedDefaults() {
    const defaults = [
      { name: '灰境行者', category: '射击' },
      { name: '诡影藏锋', category: '射击' },
      { name: '七日世界', category: 'SOC生存' },
      { name: '弧光猎人', category: '射击' },
      { name: '三角洲行动', category: '战术射击' },
      { name: '暗区突围', category: '战术射击' },
      { name: '和平精英', category: '战术竞技' },
      { name: '萤火突击', category: '战术射击' },
      { name: '荒野行动', category: '战术竞技' },
    ];

    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO competitors (name, category) VALUES (?, ?)
    `);

    const insertMany = db.transaction(() => {
      for (const c of defaults) {
        insert.run(c.name, c.category);
      }
    });

    insertMany();
    return this.findAll();
  }
}

module.exports = Competitor;
