const WEEKDAY_RU = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const MONTH_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const SLIDE_MS = 5200

function plural(count, one, few, many) {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function formatDate(iso) {
  const [year, month, day] = String(iso).split('-')
  return `${day}.${month}.${year}`
}

export function money(value) {
  const rounded = Math.round(Number(value) || 0)
  // ru-RU groups thousands with a non-breaking space; keep one plain space so
  // the string is the same everywhere it is rendered
  return rounded.toLocaleString('ru-RU').replace(/[\u00A0\u202F,]/g, ' ') + ' €'
}

export function buildSlides(data) {
  if (!data?.has_data) {
    return [{
      id: 'empty',
      kicker: `${data?.year ?? ''}`,
      title: 'Пока нечего показать',
      body: 'За этот год нет записей в основной валюте. Добавь пару трат, и отчёт соберётся сам.',
    }]
  }

  const slides = []
  const top = data.categories[0]
  const weekdayMax = Math.max(...data.weekdays.map(day => day.amount), 1)

  slides.push({
    id: 'net',
    kicker: `${data.year} в цифрах`,
    value: data.totals.net,
    prefix: data.totals.net > 0 ? '+' : '',
    tone: data.totals.net >= 0 ? 'green' : 'red',
    body: `Заработал ${money(data.totals.earned)}, потратил ${money(data.totals.spent)}. ` +
      `${data.totals.entries} записей, ${data.months_positive} из ${data.months.length} ${plural(data.months.length, 'месяца', 'месяцев', 'месяцев')} в плюсе.`,
  })

  const monthMax = Math.max(...data.months.map(month => Math.abs(month.net)), 1)
  const bestMonth = data.months.reduce((best, month) => (best === null || month.net > best.net ? month : best), null)
  const worstMonth = data.months.reduce((worst, month) => (worst === null || month.net < worst.net ? month : worst), null)

  slides.push({
    id: 'months',
    kicker: 'по месяцам',
    title: `${data.months.filter(month => month.net > 0).length} из ${data.months.length} в плюсе`,
    bars: data.months.map(month => ({
      label: MONTH_RU[month.month - 1],
      value: Math.abs(month.net),
      display: `${month.net > 0 ? '+' : month.net < 0 ? '−' : ''}${money(Math.abs(month.net))}`,
      color: month.net >= 0 ? 'from-emerald-400 to-emerald-700' : 'from-red-400 to-red-600',
    })),
    barMax: monthMax,
    body: bestMonth && worstMonth
      ? `Лучший ${MONTH_RU[bestMonth.month - 1]}: ${bestMonth.net > 0 ? '+' : '−'}${money(Math.abs(bestMonth.net))}, худший ${MONTH_RU[worstMonth.month - 1]}: ${worstMonth.net > 0 ? '+' : '−'}${money(Math.abs(worstMonth.net))}.`
      : '',
  })

  slides.push({
    id: 'flow',
    kicker: 'куда шли деньги',
    bars: [
      { label: 'заработал', value: data.totals.earned, color: 'from-emerald-400 to-emerald-700' },
      { label: 'потратил', value: data.totals.spent, color: 'from-red-400 to-red-700' },
      { label: 'отложил', value: data.totals.invested, color: 'from-blue-400 to-blue-700' },
    ],
    barMax: Math.max(data.totals.earned, data.totals.spent, data.totals.invested, 1),
  })

  if (top) {
    slides.push({
      id: 'category',
      kicker: 'главная статья',
      title: top.name,
      value: top.amount,
      body: `${top.share}% всех расходов года`,
      categories: data.categories.slice(0, 3),
      spendTotal: data.totals.spent,
    })
  }

  if (data.biggest_day) {
    slides.push({
      id: 'biggest-day',
      kicker: 'самый дорогой день',
      value: data.biggest_day.amount,
      body: `${data.biggest_day.date}, ${data.biggest_day.entries} записей` +
        (data.biggest_entry ? `. Крупнейшая: ${money(data.biggest_entry.amount)}, ${data.biggest_entry.category}` : ''),
    })
  }

  slides.push({
    id: 'no-spend',
    kicker: 'дни без трат',
    value: data.no_spend_days,
    raw: true,
    body: data.longest_no_spend_streak?.days
      ? `Самая длинная серия: ${data.longest_no_spend_streak.days} дней. Средний день трат ${money(data.spend_day_mean)}, медиана ${money(data.spend_day_median)}.`
      : `Средний день трат ${money(data.spend_day_mean)}, медиана ${money(data.spend_day_median)}.`,
    weekdays: [...data.weekdays]
      .sort((left, right) => ((left.index + 6) % 7) - ((right.index + 6) % 7))
      .map(day => ({ label: WEEKDAY_RU[(day.index + 6) % 7], ratio: day.amount / weekdayMax })),
  })

  const parts = []
  if (data.subscriptions.active_rules > 0) {
    parts.push(`Подписки ${money(data.subscriptions.monthly_amount)} в месяц, ${data.subscriptions.active_rules} ${plural(data.subscriptions.active_rules, 'правило', 'правила', 'правил')}`)
  }
  if (data.recurring_income?.active_rules > 0) {
    parts.push(`регулярный доход ${money(data.recurring_income.monthly_amount)} в месяц`)
  }
  if (data.transfers_count > 0) {
    parts.push(`${data.transfers_count} ${plural(data.transfers_count, 'перевод', 'перевода', 'переводов')} между кошельками`)
  }
  if (data.logging.median_hour !== null) {
    parts.push(`обычно записываешь около ${String(data.logging.median_hour).padStart(2, '0')}:00`)
  }

  slides.push({
    id: 'habits',
    kicker: 'постоянные платежи',
    value: data.subscriptions.monthly_amount,
    suffix: ' в месяц',
    body: parts.length > 0
      ? parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('. ') + '.'
      : 'Постоянных платежей пока нет.',
  })

  slides.push({
    id: 'final',
    kicker: 'итог',
    value: data.totals.net,
    prefix: data.totals.net > 0 ? '+' : '',
    tone: data.totals.net >= 0 ? 'green' : 'red',
    body: `Заработано ${money(data.totals.earned)}, потрачено ${money(data.totals.spent)}, отложено ${money(data.totals.invested)}.` +
      (data.rates_date ? ` Валюты пересчитаны по курсу на ${formatDate(data.rates_date)}.` : '') +
      (data.skipped_other_currency > 0 ? ` ${data.skipped_other_currency} записей не попали: не нашёл курс.` : ''),
    final: true,
  })

  return slides
}


export { SLIDE_MS }
