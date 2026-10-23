import { SUPPORTED_CURRENCY_CODES } from '../constants.js'

export const MAX_MONEY = 1e12
export const MAX_NAME_LENGTH = 100
export const MAX_NOTE_LENGTH = 2000
export const MAX_CREDENTIAL_LENGTH = 4096

export class RequestValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RequestValidationError'
    this.status = 400
  }
}

function reject(message) {
  throw new RequestValidationError(message)
}

export function objectInput(value, field = 'body') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    reject(`${field} must be an object`)
  }
  return value
}

export function positiveId(value, field = 'id') {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) {
    reject(`${field} must be a positive safe integer`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) reject(`${field} must be a positive safe integer`)
  return parsed
}

export function money(value, field, { positive = false } = {}) {
  if (typeof value !== 'number' && (
    typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())
  )) reject(`${field} must be a finite decimal number`)
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Math.abs(parsed) > MAX_MONEY || (positive && parsed <= 0)) {
    reject(`${field} must be ${positive ? 'positive and ' : ''}within ${MAX_MONEY}`)
  }
  return parsed
}

export function boundedString(value, field, { max, nonblank = false, trim = false }) {
  if (typeof value !== 'string' || value.length > max || (nonblank && !value.trim())) {
    reject(`${field} must be ${nonblank ? 'a nonblank' : 'a'} string of at most ${max} characters`)
  }
  return trim ? value.trim() : value
}

export function nameInput(value) {
  return boundedString(value, 'name', { max: MAX_NAME_LENGTH, nonblank: true, trim: true })
}

export function enumInput(value, allowed, field) {
  if (typeof value !== 'string' || !allowed.has(value)) reject(`Invalid ${field}`)
  return value
}

export function currencyInput(value) {
  if (typeof value !== 'string') reject('Unsupported currency')
  const code = value.trim().toUpperCase()
  if (!SUPPORTED_CURRENCY_CODES.has(code)) reject('Unsupported currency')
  return code
}

export function colorInput(value) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) reject('color must be #RRGGBB')
  return value
}

export function dateInput(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) reject('date must be a real YYYY-MM-DD date')
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (year < 1 || !Number.isFinite(parsed.getTime()) || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    reject('date must be a real YYYY-MM-DD date')
  }
  return value
}

export function entryInput(value) {
  const body = objectInput(value)
  return {
    ledger_id: positiveId(body.ledger_id, 'ledger_id'),
    wallet_id: positiveId(body.wallet_id, 'wallet_id'),
    category_id: positiveId(body.category_id, 'category_id'),
    amount: money(body.amount, 'amount', { positive: true }),
    currency: currencyInput(Object.hasOwn(body, 'currency') ? body.currency : 'EUR'),
    date: dateInput(body.date),
    note: Object.hasOwn(body, 'note') ? boundedString(body.note, 'note', { max: MAX_NOTE_LENGTH }) : '',
  }
}

export function credentialInput(value, fields) {
  const credentials = objectInput(value, 'credentials')
  const names = new Set(fields.map(field => field.name))
  if (Object.keys(credentials).some(key => !names.has(key))) reject('Unknown credential field')
  return Object.fromEntries(fields.map(({ name }) => {
    if (!Object.hasOwn(credentials, name)) reject(`Missing credential field: ${name}`)
    return [name, boundedString(credentials[name], name, { max: MAX_CREDENTIAL_LENGTH, nonblank: true })]
  }))
}

export function rateQueryInput(query) {
  const target = currencyInput(Object.hasOwn(query, 'target') ? query.target : 'EUR')
  const rawSources = Object.hasOwn(query, 'sources') ? query.sources : ''
  if (typeof rawSources !== 'string') reject('sources must be a comma-separated currency string')
  const sources = [...new Set(rawSources.split(',').map(value => value.trim()).filter(Boolean).map(currencyInput))]
  return { target, sources }
}
