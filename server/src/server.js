import './config/env.js'
import { createApp, logger } from './app.js'
import { migrator } from './infrastructure/db/migrator.js'

const PORT = process.env.PORT || 3001

await migrator.up()

const app = createApp()

export { app, logger }

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
