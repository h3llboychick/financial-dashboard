/**
 * The end date column was added to 006 after that migration had already run in
 * production, and umzug keys migrations by file name, so editing an applied
 * migration does nothing. This migration adds the column to existing databases.
 */
export function up({ context: db }) {
    const columns = db.prepare('PRAGMA table_info(recurring_rules)').all().map(column => column.name)
    if (!columns.includes('end_date')) {
        db.exec('ALTER TABLE recurring_rules ADD COLUMN end_date TEXT')
    }
}

export function down({ context: db }) {
    const columns = db.prepare('PRAGMA table_info(recurring_rules)').all().map(column => column.name)
    if (columns.includes('end_date')) {
        db.exec('ALTER TABLE recurring_rules DROP COLUMN end_date')
    }
}
