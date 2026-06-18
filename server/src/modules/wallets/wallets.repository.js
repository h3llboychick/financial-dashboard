import { decryptExchangeCredentials, encryptExchangeCredentials } from '../../shared/security/envelopeEncryption.js'

export function makeWalletRepo(db) {
  return {
    list({ user_id }) {
      return db
      .prepare('SELECT * FROM wallets WHERE user_id = ? ORDER BY type ASC, name ASC')
      .all(user_id)
    },
    find_by_id({ wallet_id, user_id }) {
      return db.prepare('SELECT * FROM wallets WHERE id = ? AND user_id = ?').get(wallet_id, user_id)
    },
    create({ user_id, name, currency, type, initial_balance = 0, balance_anchor_entry_id = 0 }) {
      return db
        .prepare(
          `INSERT INTO wallets (
            user_id, name, currency, type, initial_balance, balance_anchor_entry_id, balance_anchor_at
          ) VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? > 0 THEN CURRENT_TIMESTAMP ELSE NULL END)`,
        )
        .run(user_id, name, currency, type, initial_balance, balance_anchor_entry_id, balance_anchor_entry_id)
    },
    update({ wallet_id, user_id, name, initial_balance, balance_anchor_entry_id, reset_anchor = false }) {
      return db
        .prepare(
          `UPDATE wallets SET
            name = COALESCE(?, name),
            initial_balance = COALESCE(?, initial_balance),
            balance_anchor_entry_id = CASE WHEN ? THEN ? ELSE balance_anchor_entry_id END,
            balance_anchor_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE balance_anchor_at END
          WHERE id = ? AND user_id = ?`,
        )
        .run(
          name ?? null,
          initial_balance ?? null,
          reset_anchor ? 1 : 0,
          balance_anchor_entry_id ?? 0,
          reset_anchor ? 1 : 0,
          wallet_id,
          user_id,
        )
    },
    delete_by_id({ wallet_id, user_id }) {
      return db.prepare('DELETE FROM wallets WHERE id = ? AND user_id = ?').run(wallet_id, user_id)
    },
    get_exchange_credentials({ wallet_id, user_id }) {
      const row = db
        .prepare('SELECT * FROM exchange_credentials WHERE wallet_id = ? AND user_id = ?')
        .get(wallet_id, user_id)

        if (!row) return null

        const credentials = decryptExchangeCredentials(row)
        return {
          id: row.id,
          user_id: row.user_id,
          wallet_id: row.wallet_id,
          slug: row.slug,
          credentials: credentials
        }
    },
    upsert_exchange_credentials({ user_id, wallet_id, slug, credentials }) {
      const encrypted = encryptExchangeCredentials({ user_id, wallet_id, slug, credentials })

      return db
        .prepare(
          `INSERT INTO exchange_credentials (
            user_id,
            wallet_id,
            slug,
            encrypted_dek,
            encrypted_dek_iv,
            encrypted_dek_tag,
            credentials_ciphertext,
            credentials_iv,
            credentials_tag,
            encryption_version
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, wallet_id) DO UPDATE SET
            slug = excluded.slug,
            encrypted_dek = excluded.encrypted_dek,
            encrypted_dek_iv = excluded.encrypted_dek_iv,
            encrypted_dek_tag = excluded.encrypted_dek_tag,
            credentials_ciphertext = excluded.credentials_ciphertext,
            credentials_iv = excluded.credentials_iv,
            credentials_tag = excluded.credentials_tag,
            encryption_version = excluded.encryption_version`,
        )
        .run(
          user_id,
          wallet_id,
          slug,
          encrypted.encrypted_dek,
          encrypted.encrypted_dek_iv,
          encrypted.encrypted_dek_tag,
          encrypted.credentials_ciphertext,
          encrypted.credentials_iv,
          encrypted.credentials_tag,
          encrypted.encryption_version,
        )
    },
    get_max_entry_id({ user_id }) {
      return db
        .prepare('SELECT COALESCE(MAX(id), 0) AS max_id FROM entries WHERE user_id = ?')
        .get(user_id).max_id
    },

    /** Returns income/expense/investment totals after the wallet balance anchor. */
    get_fiat_entry_totals_after_anchor({ user_id, currency, wallet_id, anchor_entry_id = 0 }) {
      return db
        .prepare(
          `SELECT
            COALESCE(SUM(CASE WHEN l.type = 'income' THEN e.amount ELSE 0 END), 0) AS total_income,
            COALESCE(SUM(CASE WHEN l.type = 'expense' THEN e.amount ELSE 0 END), 0) AS total_expense,
            COALESCE(SUM(CASE WHEN l.type = 'investment' THEN e.amount ELSE 0 END), 0) AS total_investment
          FROM entries e
          JOIN ledgers l ON l.id = e.ledger_id AND l.user_id = e.user_id
          WHERE e.user_id = ? AND e.currency = ? AND e.id > ? AND e.wallet_id = ?`,
        )
        .get(user_id, currency, anchor_entry_id, wallet_id)
    }
  }
}
