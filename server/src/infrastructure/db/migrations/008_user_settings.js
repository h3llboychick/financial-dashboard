export function up({ context: db }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      currency TEXT NOT NULL DEFAULT 'EUR',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export function down({ context: db }) {
  db.exec('DROP TABLE IF EXISTS user_settings')
}
