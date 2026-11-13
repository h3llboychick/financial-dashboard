import { currencyInput } from '../../shared/validation/financialInput.js'

export function makeSettingsController({ settings_repo }) {
  function show(req, res) {
    res.json(settings_repo.get({ user_id: req.user.user_id }))
  }

  function update(req, res) {
    const currency = currencyInput(req.body?.currency)
    res.json(settings_repo.set_currency({ user_id: req.user.user_id, currency }))
  }

  return { show, update }
}
