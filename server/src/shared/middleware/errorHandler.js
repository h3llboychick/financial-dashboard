import { RequestValidationError } from '../validation/financialInput.js'

const bodyParserErrors = new Map([
  ['entity.parse.failed', [400, 'Invalid JSON body']],
  ['entity.too.large', [413, 'Request body too large']],
  ['charset.unsupported', [415, 'Unsupported request charset']],
  ['encoding.unsupported', [415, 'Unsupported content encoding']],
])

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)
  if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message })
  // Express marks URI decode failures with both statuses; never echo its raw path/message.
  if (error instanceof URIError && error.status === 400 && error.statusCode === 400) {
    return res.status(400).json({ error: 'Invalid URL encoding' })
  }
  const knownError = bodyParserErrors.get(error.type)
  if (knownError && error.status === knownError[0] && error.statusCode === knownError[0]) {
    return res.status(knownError[0]).json({ error: knownError[1] })
  }
  return res.status(500).json({ error: 'Internal server error' })
}
