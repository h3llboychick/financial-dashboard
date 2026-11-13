import { Router } from 'express'
import { asyncHandler } from '../../shared/middleware/asyncHandler.js'
import { makeSettingsController } from './settings.controller.js'

export function makeSettingsRouter(repos) {
  const router = Router()
  const controller = makeSettingsController(repos)

  /**
   * @openapi
   * /settings:
   *   get:
   *     tags: [Settings]
   *     summary: Account settings
   *     responses:
   *       200:
   *         description: The currency the account reports in
   *   put:
   *     tags: [Settings]
   *     summary: Change the account currency
   *     responses:
   *       200:
   *         description: Updated settings
   *       400:
   *         description: Unsupported currency
   */
  router.get('/', asyncHandler(controller.show))
  router.put('/', asyncHandler(controller.update))

  return router
}
