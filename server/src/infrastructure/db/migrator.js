import { Umzug } from "umzug";
import {db} from "./connection.js";
import {fileURLToPath} from 'url'
import {dirname, join} from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))


export const migrator = new Umzug({
    migrations: {glob: join(__dirname, 'migrations/*.js')},
    context: db,
    storage: {
        executed() {
            db.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)`)
            return db.prepare(`SELECT name FROM _migrations ORDER BY name`).all().map(r => r.name)
        },
        logMigration({ name }) {
            db.prepare(`INSERT INTO _migrations (name) VALUES (?)`).run(name)
        },
        unlogMigration({ name }) {
            db.prepare(`DELETE FROM _migrations WHERE name = ?`).run(name)
        },
    },
    logger: console
})