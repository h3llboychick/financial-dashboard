export function makeSettingsRepo(db) {
  return {
    get({ user_id }) {
      const row = db.prepare('SELECT currency FROM user_settings WHERE user_id = ?').get(user_id)
      return { currency: row?.currency ?? 'EUR' }
    },

    set_currency({ user_id, currency }) {
      db.prepare(`
        INSERT INTO user_settings (user_id, currency) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET currency = excluded.currency, updated_at = CURRENT_TIMESTAMP
      `).run(user_id, currency)
      return { currency }
    },
  }
}
