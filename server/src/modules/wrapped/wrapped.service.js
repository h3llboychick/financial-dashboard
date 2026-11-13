const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_MS = 86400000

function isoToTime(value) {
  const [year, month, day] = String(value).split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function isoDate(time) {
  return new Date(time).toISOString().slice(0, 10)
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function daysInYear(year) {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return leap ? 366 : 365
}

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

/** Currency the year is reported in: the one most entries were made in. */
export function dominantCurrencyForYear(entries, year) {
  const counts = new Map()
  for (const entry of entries) {
    if (String(entry.date).slice(0, 4) !== String(year)) continue
    counts.set(entry.currency, (counts.get(entry.currency) ?? 0) + 1)
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
}

function monthTotals(rows) {
  const months = new Map()
  for (const row of rows) {
    const month = Number(String(row.date).slice(5, 7))
    if (!months.has(month)) months.set(month, { month, earned: 0, spent: 0, invested: 0, net: 0 })
    const bucket = months.get(month)
    if (row.type === 'income') bucket.earned += row.value
    else if (row.type === 'investment') bucket.invested += row.value
    else bucket.spent += row.value
  }
  return [...months.values()]
    .sort((left, right) => left.month - right.month)
    .map(bucket => ({
      month: bucket.month,
      earned: round(bucket.earned),
      spent: round(bucket.spent),
      invested: round(bucket.invested),
      net: round(bucket.earned - bucket.spent - bucket.invested),
    }))
}

function longestPositiveStreak(months) {
  let best = 0
  let run = 0
  for (const month of months) {
    if (month.net > 0) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }
  return best
}

function noSpendStats(expenseDates, year) {
  const sorted = [...expenseDates].sort()
  const days = daysInYear(year)
  const first = Date.UTC(year, 0, 1)
  const last = Date.UTC(year, 11, 31)

  let best = { days: 0, from: null, to: null }
  let previous = first - DAY_MS

  for (const date of sorted) {
    const time = isoToTime(date)
    const gapDays = Math.round((time - previous) / DAY_MS) - 1
    if (gapDays > best.days) {
      best = { days: gapDays, from: isoDate(previous + DAY_MS), to: isoDate(time - DAY_MS) }
    }
    previous = time
  }

  const tailDays = Math.round((last - previous) / DAY_MS)
  if (tailDays > best.days) {
    best = { days: tailDays, from: isoDate(previous + DAY_MS), to: isoDate(last) }
  }

  return {
    no_spend_days: days - sorted.length,
    longest_no_spend_streak: best.days > 0 ? best : { days: 0, from: null, to: null },
  }
}

/**
 * Year in numbers for one user. Pure: arrays in, report out.
 *
 * Every entry is converted into the year's dominant currency using the supplied
 * rates. Entries whose currency has no rate are skipped and counted, so the
 * report never silently mixes currencies or drops income without saying so.
 */
export function buildWrapped({
  year,
  entries = [],
  ledgers = [],
  categories = [],
  transfers = [],
  rules = [],
  rates = null,
  rates_date = null,
}) {
  const yearEntries = entries.filter(entry => String(entry.date).slice(0, 4) === String(year))
  const currency = dominantCurrencyForYear(entries, year)
  const ledgerType = Object.fromEntries(ledgers.map(ledger => [ledger.id, ledger.type]))
  const categoryMap = Object.fromEntries(categories.map(category => [category.id, category]))

  const convert = entry => {
    if (entry.currency === currency) return entry.amount
    const rate = rates?.[entry.currency]
    return Number.isFinite(rate) ? entry.amount * rate : null
  }

  const rows = []
  let skipped = 0
  for (const entry of yearEntries) {
    const value = convert(entry)
    if (value === null) {
      skipped += 1
      continue
    }
    rows.push({
      ...entry,
      value,
      type: entry.ledger_type ?? ledgerType[entry.ledger_id],
    })
  }

  const expenseRows = rows.filter(row => row.type === 'expense')
  const incomeRows = rows.filter(row => row.type === 'income')
  const investmentRows = rows.filter(row => row.type === 'investment')

  const earned = incomeRows.reduce((sum, row) => sum + row.value, 0)
  const spent = expenseRows.reduce((sum, row) => sum + row.value, 0)
  const invested = investmentRows.reduce((sum, row) => sum + row.value, 0)

  const months = monthTotals(rows)

  const byCategory = new Map()
  for (const row of expenseRows) {
    const category = categoryMap[row.category_id] ?? { name: 'Uncategorized', color: '#6b7280' }
    const current = byCategory.get(row.category_id) ?? { name: category.name, color: category.color, amount: 0 }
    current.amount += row.value
    byCategory.set(row.category_id, current)
  }
  const categoriesRanked = [...byCategory.values()]
    .map(row => ({ ...row, amount: round(row.amount), share: spent > 0 ? round(row.amount / spent * 100) : 0 }))
    .sort((left, right) => right.amount - left.amount)

  const byDay = new Map()
  for (const row of expenseRows) {
    const current = byDay.get(row.date) ?? { date: row.date, amount: 0, entries: 0 }
    current.amount += row.value
    current.entries += 1
    byDay.set(row.date, current)
  }
  const daysRanked = [...byDay.values()].sort((left, right) => right.amount - left.amount)
  const biggestDay = daysRanked[0]
    ? { date: daysRanked[0].date, amount: round(daysRanked[0].amount), entries: daysRanked[0].entries }
    : null

  const biggestRow = expenseRows.reduce((best, row) => (best && best.value >= row.value ? best : row), null)
  const biggestEntry = biggestRow
    ? {
        date: biggestRow.date,
        amount: round(biggestRow.value),
        category: categoryMap[biggestRow.category_id]?.name ?? 'Uncategorized',
        note: biggestRow.note || '',
      }
    : null

  const { no_spend_days, longest_no_spend_streak } = noSpendStats([...byDay.keys()], Number(year))

  const dayAmounts = daysRanked.map(day => day.amount)
  const spendDayMean = dayAmounts.length > 0 ? round(dayAmounts.reduce((sum, value) => sum + value, 0) / dayAmounts.length) : 0
  const spendDayMedian = round(median(dayAmounts))

  const weekdayTotals = WEEKDAY_LABELS.map((label, index) => ({ index, label, amount: 0, days: 0 }))
  for (const day of daysRanked) {
    const weekday = new Date(isoToTime(day.date)).getUTCDay()
    weekdayTotals[weekday].amount = round(weekdayTotals[weekday].amount + day.amount)
    weekdayTotals[weekday].days += 1
  }

  const ruleRows = rules.map(rule => ({
    ...rule,
    type: rule.ledger_type ?? ledgerType[rule.ledger_id],
    value: rule.currency === currency ? rule.amount : rule.amount * (rates?.[rule.currency] ?? 1),
  }))
  const activeRules = ruleRows.filter(rule => rule.active === 1 || rule.active === true)
  const expenseRules = activeRules.filter(rule => rule.type === 'expense')
  const incomeRules = activeRules.filter(rule => rule.type === 'income')

  const hours = rows
    .map(entry => String(entry.created_at ?? '').slice(11, 13))
    .map(Number)
    .filter(hour => Number.isInteger(hour))

  const currencyShares = new Map()
  for (const entry of yearEntries) {
    currencyShares.set(entry.currency, (currencyShares.get(entry.currency) ?? 0) + 1)
  }
  const currencies = [...currencyShares.entries()]
    .map(([code, count]) => ({ code, share: round(count / yearEntries.length * 100) }))
    .sort((left, right) => right.share - left.share)

  return {
    year: Number(year),
    currency,
    has_data: rows.length > 0,
    entries_counted: rows.length,
    skipped_other_currency: skipped,
    rates_date,
    totals: {
      earned: round(earned),
      spent: round(spent),
      invested: round(invested),
      net: round(earned - spent - invested),
      entries: rows.length,
    },
    months,
    months_positive: months.filter(month => month.net > 0).length,
    months_negative: months.filter(month => month.net < 0).length,
    longest_positive_streak: longestPositiveStreak(months),
    categories: categoriesRanked.slice(0, 5),
    biggest_day: biggestDay,
    biggest_entry: biggestEntry,
    no_spend_days,
    longest_no_spend_streak,
    spend_day_mean: spendDayMean,
    spend_day_median: spendDayMedian,
    weekdays: weekdayTotals,
    subscriptions: {
      active_rules: expenseRules.length,
      monthly_amount: round(expenseRules.reduce((sum, rule) => sum + rule.value, 0)),
    },
    recurring_income: {
      active_rules: incomeRules.length,
      monthly_amount: round(incomeRules.reduce((sum, rule) => sum + rule.value, 0)),
    },
    transfers_count: transfers.length,
    logging: {
      median_hour: hours.length > 0 ? Math.round(median(hours)) : null,
      share_after_22: hours.length > 0
        ? round(hours.filter(hour => hour >= 22).length / hours.length * 100)
        : 0,
    },
    currencies,
  }
}
