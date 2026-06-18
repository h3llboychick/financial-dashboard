import { Router } from 'express'
import { listExchangeMetadata } from './registry.js'


export function makeExchangesRouter() {
    const router = Router()
    router.get("/", (req, res) => {
        res.json(listExchangeMetadata())
    })

    return router;
}
