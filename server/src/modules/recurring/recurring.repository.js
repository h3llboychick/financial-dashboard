export function makeRecurringRepo(db) {
  const selectWithDetails = `
    SELECT
      r.*,
      l.name AS ledger_name,
      l.type AS ledger_type,
      l.color AS ledger_color,
      w.name AS wallet_name,
      c.name AS category_name,
      c.color AS category_color
    FROM recurring_rules r
    JOIN ledgers l ON l.id = r.ledger_id AND l.user_id = r.user_id
    JOIN wallets w ON w.id = r.wallet_id AND w.user_id = r.user_id
    JOIN ledger_categories c ON c.id = r.category_id AND c.user_id = r.user_id
  `

  return {
    list({ user_id }) {
      return db
        .prepare(`${selectWithDetails} WHERE r.user_id = ? ORDER BY r.day_of_month ASC, r.name ASC`)
        .all(user_id)
    },

    find_by_id({ rule_id, user_id }) {
      return db.prepare(`${selectWithDetails} WHERE r.user_id = ? AND r.id = ?`).get(user_id, rule_id)
    },

    find_raw({ rule_id, user_id }) {
      return db.prepare('SELECT * FROM recurring_rules WHERE id = ? AND user_id = ?').get(rule_id, user_id)
    },

    list_active({ user_id = null, until }) {
      const conditions = ['active = 1', 'start_date <= ?']
      const parameters = [until]
      if (user_id !== null) {
        conditions.push('user_id = ?')
        parameters.push(user_id)
      }
      return db
        .prepare(`SELECT * FROM recurring_rules WHERE ${conditions.join(' AND ')} ORDER BY id ASC`)
        .all(...parameters)
    },

    create({ user_id, name, ledger_id, wallet_id, category_id, amount, currency, note = '', day_of_month, start_date }) {
      return db
        .prepare(
          `INSERT INTO recurring_rules (
            user_id, name, ledger_id, wallet_id, category_id, amount, currency, note, day_of_month, start_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(user_id, name, ledger_id, wallet_id, category_id, amount, currency, note, day_of_month, start_date)
    },

    update({ rule_id, user_id, name, ledger_id, wallet_id, category_id, amount, currency, note, day_of_month, start_date, active }) {
      return db
        .prepare(
          `UPDATE recurring_rules SET
            name = COALESCE(?, name),
            ledger_id = COALESCE(?, ledger_id),
            wallet_id = COALESCE(?, wallet_id),
            category_id = COALESCE(?, category_id),
            amount = COALESCE(?, amount),
            currency = COALESCE(?, currency),
            note = COALESCE(?, note),
            day_of_month = COALESCE(?, day_of_month),
            start_date = COALESCE(?, start_date),
            active = COALESCE(?, active)
          WHERE id = ? AND user_id = ?`,
        )
        .run(
          name ?? null,
          ledger_id ?? null,
          wallet_id ?? null,
          category_id ?? null,
          amount ?? null,
          currency ?? null,
          note ?? null,
          day_of_month ?? null,
          start_date ?? null,
          active ?? null,
          rule_id,
          user_id,
        )
    },

    delete_by_id({ rule_id, user_id }) {
      return db.prepare('DELETE FROM recurring_rules WHERE id = ? AND user_id = ?').run(rule_id, user_id)
    },

    /**
     * Claims a range of occurrences for one rule. Returns true only for the
     * caller that actually moved the watermark, so two concurrent runs cannot
     * create the same entry twice.
     */
    claim_until({ rule_id, user_id, date }) {
      const result = db
        .prepare(
          `UPDATE recurring_rules
             SET last_generated_on = ?
           WHERE id = ? AND user_id = ?
             AND (last_generated_on IS NULL OR last_generated_on < ?)`,
        )
        .run(date, rule_id, user_id, date)
      return result.changes === 1
    },
  }
}
