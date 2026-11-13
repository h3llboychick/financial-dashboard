const WEEKDAY_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SLIDE_MS = 5200

function plural(count, one, many) {
  return count === 1 ? one : many
}

function formatDate(iso) {
  const [year, month, day] = String(iso).split('-')
  return `${Number(day)} ${MONTH_EN[Number(month) - 1]} ${year}`
}

/** Amount in the currency the report was built in. */
export function money(value, currency = 'EUR') {
  const amount = Math.round(Number(value) || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function buildSlides(data) {
  const currency = data?.currency ?? 'EUR'
  const cash = value => money(value, currency)

  if (!data?.has_data) {
    return [{
      id: 'empty',
      kicker: `${data?.year ?? ''}`,
      title: 'Nothing here yet',
      body: 'No entries for this year in your main currency. Add a couple and the recap builds itself.',
    }]
  }

  const slides = []
  const monthMax = Math.max(...data.months.map(month => Math.abs(month.net)), 1)
  const bestMonth = data.months.reduce((best, month) => (best === null || month.net > best.net ? month : best), null)
  const worstMonth = data.months.reduce((worst, month) => (worst === null || month.net < worst.net ? month : worst), null)
  const positiveMonths = data.months.filter(month => month.net > 0).length

  slides.push({
    id: 'net',
    kicker: `${data.year} in numbers`,
    value: data.totals.net,
    prefix: data.totals.net > 0 ? '+' : '',
    tone: data.totals.net >= 0 ? 'green' : 'red',
    body: `You brought in ${cash(data.totals.earned)} and spent ${cash(data.totals.spent)}. ` +
      `${data.totals.entries} entries, ${positiveMonths} of ${data.months.length} ` +
      `${plural(data.months.length, 'month', 'months')} in the black.`,
  })

  slides.push({
    id: 'months',
    kicker: 'month by month',
    title: `${positiveMonths} of ${data.months.length} in the black`,
    bars: data.months.map(month => ({
      label: MONTH_EN[month.month - 1],
      value: Math.abs(month.net),
      display: `${month.net > 0 ? '+' : month.net < 0 ? '-' : ''}${cash(Math.abs(month.net))}`,
      color: month.net >= 0 ? 'from-emerald-400 to-emerald-700' : 'from-red-400 to-red-600',
    })),
    barMax: monthMax,
    body: bestMonth && worstMonth
      ? `Best ${MONTH_EN[bestMonth.month - 1]}: ${bestMonth.net > 0 ? '+' : '-'}${cash(Math.abs(bestMonth.net))}, ` +
        `worst ${MONTH_EN[worstMonth.month - 1]}: ${worstMonth.net > 0 ? '+' : '-'}${cash(Math.abs(worstMonth.net))}.`
      : '',
  })

  slides.push({
    id: 'flow',
    kicker: 'where the money went',
    bars: [
      { label: 'came in', value: data.totals.earned, color: 'from-emerald-400 to-emerald-700' },
      { label: 'went out', value: data.totals.spent, color: 'from-red-400 to-red-700' },
      { label: 'set aside', value: data.totals.invested, color: 'from-blue-400 to-blue-700' },
    ],
    barMax: Math.max(data.totals.earned, data.totals.spent, data.totals.invested, 1),
  })

  if (data.categories.length > 0) {
    const top = data.categories[0]
    slides.push({
      id: 'category',
      kicker: 'top categories',
      title: `Most of it went to ${top.name}`,
      value: top.amount,
      categories: data.categories,
      body: `${top.name} took ${Math.round(top.share)}% of everything you spent.`,
    })
  }

  if (data.biggest_day) {
    slides.push({
      id: 'biggest-day',
      kicker: 'the priciest day',
      value: data.biggest_day.amount,
      body: `${formatDate(data.biggest_day.date)}, ${data.biggest_day.entries} ` +
        `${plural(data.biggest_day.entries, 'entry', 'entries')}` +
        (data.biggest_entry ? `. Largest one: ${cash(data.biggest_entry.amount)}, ${data.biggest_entry.category}` : ''),
    })
  }

  slides.push({
    id: 'no-spend',
    kicker: 'days without spending',
    value: data.no_spend_days,
    raw: true,
    body: (data.longest_no_spend_streak?.days
      ? `Longest run: ${data.longest_no_spend_streak.days} days. `
      : '') +
      `Average spending day ${cash(data.spend_day_mean)}, median ${cash(data.spend_day_median)}.`,
    weekdays: [...data.weekdays]
      .sort((left, right) => ((left.index + 6) % 7) - ((right.index + 6) % 7))
      .map(day => ({ label: WEEKDAY_EN[(day.index + 6) % 7], ratio: day.amount / Math.max(...data.weekdays.map(item => item.amount), 1) })),
  })

  const parts = []
  if (data.subscriptions.active_rules > 0) {
    parts.push(`Subscriptions ${cash(data.subscriptions.monthly_amount)} a month across ` +
      `${data.subscriptions.active_rules} ${plural(data.subscriptions.active_rules, 'rule', 'rules')}`)
  }
  if (data.recurring_income?.active_rules > 0) {
    parts.push(`recurring income ${cash(data.recurring_income.monthly_amount)} a month`)
  }
  if (data.transfers_count > 0) {
    parts.push(`${data.transfers_count} ${plural(data.transfers_count, 'transfer', 'transfers')} between wallets`)
  }
  if (data.skipped_rules > 0) {
    parts.push(`${data.skipped_rules} ${plural(data.skipped_rules, 'rule', 'rules')} left out: no rate found`)
  }
  if (data.logging.median_hour !== null) {
    parts.push(`you usually log around ${String(data.logging.median_hour).padStart(2, '0')}:00`)
  }

  slides.push({
    id: 'habits',
    kicker: 'recurring payments',
    value: data.subscriptions.monthly_amount,
    suffix: ' a month',
    body: parts.length > 0
      ? parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('. ') + '.'
      : 'No recurring payments yet.',
  })

  slides.push({
    id: 'final',
    kicker: 'the year in one line',
    value: data.totals.net,
    prefix: data.totals.net > 0 ? '+' : '',
    tone: data.totals.net >= 0 ? 'green' : 'red',
    body: `You brought in ${cash(data.totals.earned)}, spent ${cash(data.totals.spent)} ` +
      `and set aside ${cash(data.totals.invested)}.` +
      (data.rates_date ? ` Currencies converted at the ${formatDate(data.rates_date)} rate.` : '') +
      (data.skipped_other_currency > 0
        ? ` ${data.skipped_other_currency} ${plural(data.skipped_other_currency, 'entry', 'entries')} left out: no rate found.`
        : ''),
    final: true,
  })

  return slides
}

export { SLIDE_MS }
