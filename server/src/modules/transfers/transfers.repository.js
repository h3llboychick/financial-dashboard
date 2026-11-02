export function makeTransferRepo(db) {
  const selectWithWallets = `
    SELECT
      t.id,
      t.from_wallet_id,
      t.to_wallet_id,
      t.amount,
      t.currency,
      t.date,
      t.note,
      t.created_at,
      source.name AS from_wallet_name,
      target.name AS to_wallet_name
    FROM transfers t
    JOIN wallets source ON source.id = t.from_wallet_id
    JOIN wallets target ON target.id = t.to_wallet_id
  `

  return {
    list({ user_id }) {
      return db
        .prepare(`${selectWithWallets} WHERE t.user_id = ? ORDER BY t.date DESC, t.id DESC`)
        .all(user_id)
    },

    find_by_id({ transfer_id, user_id }) {
      return db
        .prepare(`${selectWithWallets} WHERE t.user_id = ? AND t.id = ?`)
        .get(user_id, transfer_id)
    },

    create({ user_id, from_wallet_id, to_wallet_id, amount, currency, date, note = '' }) {
      return db
        .prepare(
          `INSERT INTO transfers (user_id, from_wallet_id, to_wallet_id, amount, currency, date, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(user_id, from_wallet_id, to_wallet_id, amount, currency, date, note)
    },

    delete_by_id({ transfer_id, user_id }) {
      return db.prepare('DELETE FROM transfers WHERE id = ? AND user_id = ?').run(transfer_id, user_id)
    },

    /**
     * Sums transfers already applied to a wallet balance. Transfers created
     * before the wallet's balance anchor timestamp are excluded, mirroring how
     * entries are excluded by balance_anchor_entry_id.
     */
    get_totals_after_anchor({ user_id, wallet_id, currency, anchor_at = null }) {
      const parameters = [wallet_id, wallet_id, user_id, currency, wallet_id, wallet_id]
      let anchorClause = ''
      if (anchor_at) {
        anchorClause = 'AND t.created_at > ?'
        parameters.push(anchor_at)
      }

      const row = db
        .prepare(
          `SELECT
            COALESCE(SUM(CASE WHEN t.to_wallet_id = ? THEN t.amount ELSE 0 END), 0) AS total_in,
            COALESCE(SUM(CASE WHEN t.from_wallet_id = ? THEN t.amount ELSE 0 END), 0) AS total_out
          FROM transfers t
          WHERE t.user_id = ? AND t.currency = ?
            AND (t.from_wallet_id = ? OR t.to_wallet_id = ?)
            ${anchorClause}`,
        )
        .get(...parameters)

      return { total_in: row.total_in, total_out: row.total_out }
    },
  }
}
