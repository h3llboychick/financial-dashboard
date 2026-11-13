import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSlides, money } from './wrappedSlides.js'

function payload(overrides = {}) {
  return {
    year: 2026,
    currency: 'EUR',
    has_data: true,
    entries_counted: 80,
    skipped_other_currency: 0,
    skipped_rules: 0,
    rates_date: null,
    totals: { earned: 8170, spent: 7101, invested: 600, net: 469, entries: 80 },
    months: [{ month: 1, net: 200 }, { month: 2, net: -50 }],
    months_positive: 7,
    months_negative: 2,
    longest_positive_streak: 3,
    categories: [
      { name: 'Housing', color: '#eab308', amount: 4980, share: 70.35 },
      { name: 'Transport', color: '#f97316', amount: 580, share: 8.22 },
    ],
    biggest_day: { date: '2026-04-19', amount: 580, entries: 2 },
    biggest_entry: { date: '2026-04-19', amount: 340, category: 'Transport', note: 'tickets' },
    no_spend_days: 305,
    longest_no_spend_streak: { days: 37, from: '2026-11-25', to: '2026-12-31' },
    spend_day_mean: 280,
    spend_day_median: 210,
    weekdays: Array.from({ length: 7 }, (_, index) => ({ index, label: 'x', amount: index * 10, days: 1 })),
    subscriptions: { active_rules: 2, monthly_amount: 17.49 },
    recurring_income: { active_rules: 1, monthly_amount: 500 },
    transfers_count: 0,
    logging: { median_hour: 21, share_after_22: 12.5 },
    currencies: [{ code: 'EUR', share: 100 }],
    ...overrides,
  }
}

test('puts the slides in story order', () => {
  assert.deepEqual(
    buildSlides(payload()).map(slide => slide.id),
    ['net', 'months', 'flow', 'category', 'biggest-day', 'no-spend', 'habits', 'final'],
  )
})

test('marks a positive year green and a negative one red', () => {
  assert.equal(buildSlides(payload())[0].tone, 'green')
  assert.equal(buildSlides(payload({ totals: { earned: 100, spent: 300, invested: 0, net: -200, entries: 2 } }))[0].tone, 'red')
})

test('labels the weekday strip starting on Monday', () => {
  const slide = buildSlides(payload()).find(item => item.id === 'no-spend')

  assert.deepEqual(slide.weekdays.map(day => day.label), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
})

test('skips slides that have nothing to show', () => {
  const slides = buildSlides(payload({ categories: [], biggest_day: null, biggest_entry: null }))

  assert.equal(slides.some(slide => slide.id === 'category'), false)
  assert.equal(slides.some(slide => slide.id === 'biggest-day'), false)
  assert.equal(slides.length, 6)
})

test('returns a single explanatory slide when the year is empty', () => {
  const slides = buildSlides({ year: 2024, has_data: false })

  assert.equal(slides.length, 1)
  assert.equal(slides[0].id, 'empty')
  assert.match(slides[0].title, /Nothing here yet/)
})

test('formats money in the currency the report was built in', () => {
  assert.equal(money(8170, 'EUR'), '€8,170')
  assert.equal(money(8170, 'USD'), '$8,170')
  assert.equal(money(12.4, 'EUR'), '€12')
  assert.equal(money(-200, 'EUR'), '-€200')
})

test('writes the whole story in English', () => {
  const slides = buildSlides(payload())
  const text = slides.map(slide => [slide.kicker, slide.title, slide.body].filter(Boolean).join(' ')).join(' ')

  assert.doesNotMatch(text, /[а-яА-Я]/)
  assert.match(text, /You brought in €8,170 and spent €7,101/)
})

test('shows every month with its sign', () => {
  const slide = buildSlides(payload()).find(item => item.id === 'months')

  assert.equal(slide.bars.length, 2)
  assert.equal(slide.bars[0].label, 'Jan')
  assert.equal(slide.bars[0].display, '+€200')
  assert.equal(slide.bars[1].display, '-€50')
  assert.equal(slide.bars[1].value, 50)
  assert.equal(slide.title, '1 of 2 in the black')
})

test('counts positive months from the month list, not a separate field', () => {
  const slide = buildSlides(payload({ months_positive: 99 })).find(item => item.id === 'months')

  assert.equal(slide.title, '1 of 2 in the black')
})

test('lists subscriptions and recurring income apart', () => {
  const slide = buildSlides(payload()).find(item => item.id === 'habits')

  assert.match(slide.body, /Subscriptions €17 a month across 2 rules/)
  assert.match(slide.body, /Recurring income €500 a month/)
  assert.doesNotMatch(slide.body, /517/)
})

test('says when currencies were converted and how many entries were skipped', () => {
  const slide = buildSlides(payload({ rates_date: '2026-11-13', skipped_other_currency: 3 }))
    .find(item => item.id === 'final')

  assert.match(slide.body, /converted at the 13 Nov 2026 rate/)
  assert.match(slide.body, /3 entries left out/)
})
