export const LEDGER_TYPES = new Set(['expense', 'income', 'investment'])

export const SUPPORTED_CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'PLN',
  'SEK',
  'NOK',
  'DKK',
  'CZK',
  'HUF',
  'RON',
  'BGN',
  'KZT',
]

export const SUPPORTED_CURRENCY_CODES = new Set(SUPPORTED_CURRENCIES)

export const DEFAULT_LEDGERS = [
  { name: 'Spending', type: 'expense', color: '#ef4444' },
  { name: 'Earnings', type: 'income', color: '#22c55e' },
  { name: 'Investments', type: 'investment', color: '#3b82f6' },
]

export const DEFAULT_CATEGORIES = {
  expense: [
    ['Food & Dining', '#ef4444'],
    ['Transport', '#f97316'],
    ['Housing', '#eab308'],
    ['Entertainment', '#22c55e'],
    ['Shopping', '#3b82f6'],
    ['Healthcare', '#8b5cf6'],
    ['Travel', '#06b6d4'],
    ['Education', '#ec4899'],
    ['Other', '#6b7280'],
  ],
  income: [
    ['Salary', '#22c55e'],
    ['Bonus', '#84cc16'],
    ['Freelance', '#14b8a6'],
    ['Interest', '#0ea5e9'],
    ['Other', '#6b7280'],
  ],
  investment: [
    ['Stocks', '#3b82f6'],
    ['Funds', '#06b6d4'],
    ['Crypto', '#8b5cf6'],
    ['Retirement', '#10b981'],
    ['Other', '#6b7280'],
  ],
}
